import base64
import hashlib
import hmac
import json
import uuid
import csv
from datetime import timedelta
from io import StringIO

import requests
from allauth.account import app_settings as allauth_account_settings
from django.conf import settings
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from dj_rest_auth.app_settings import api_settings as dj_rest_auth_api_settings
from dj_rest_auth.registration.views import RegisterView
from dj_rest_auth.utils import jwt_encode
from rest_framework import filters, generics, mixins, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle as DRFScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    AnalyticsEvent,
    AssistedOffer,
    AssistedIntent,
    CAPanelProfile,
    CAHelpRequest,
    ExperimentExposure,
    PaymentOrder,
    PaymentPlan,
    PaymentTransaction,
    User,
    UserEntitlement,
    WeeklyKpiSnapshot,
)
from .permissions import IsSuperAdmin
from .payment_ops import grant_parser_credits_once, is_failure_status, is_order_credit_eligible, is_success_status
from .throttles import CompliaScopedRateThrottle
from .serializers import (
    AdminAssistedIntentSerializer,
    AdminCAHelpRequestSerializer,
    AdminPaymentOrderSerializer,
    AnalyticsEventSerializer,
    AssistedOfferSerializer,
    AssistedIntentSerializer,
    CAPanelProfileSerializer,
    CAHelpRequestSerializer,
    ExperimentExposureSerializer,
    PaymentOrderCreateSerializer,
    PaymentOrderSerializer,
    PaymentPlanSerializer,
    PaymentTestConfirmSerializer,
    UserDetailSerializer,
    UserEntitlementSerializer,
    WeeklyKpiSnapshotSerializer,
)

ScopedRateThrottle = CompliaScopedRateThrottle or DRFScopedRateThrottle


class EmailRegisterView(RegisterView):
    def perform_create(self, serializer):
        user = serializer.save(self.request._request)
        if allauth_account_settings.EMAIL_VERIFICATION == allauth_account_settings.EmailVerificationMethod.MANDATORY:
            return user

        if dj_rest_auth_api_settings.USE_JWT:
            self.access_token, self.refresh_token = jwt_encode(user)
        elif self.token_model:
            dj_rest_auth_api_settings.TOKEN_CREATOR(self.token_model, user, serializer)
        return user


def _window_to_start(window: str) -> timezone.datetime:
    now = timezone.now()
    if window == "30d":
        return now - timedelta(days=30)
    return now - timedelta(days=7)


def _count_distinct_sessions(event_names: list[str], start: timezone.datetime) -> int:
    return (
        AnalyticsEvent.objects.filter(event_name__in=event_names, created_at__gte=start)
        .values("session_id")
        .distinct()
        .count()
    )


def _build_funnel(window: str) -> dict:
    start = _window_to_start(window)
    steps = {
        "search_performed": _count_distinct_sessions(["search_performed", "notice_search"], start),
        "notice_opened": _count_distinct_sessions(["notice_opened", "notice_detail_viewed"], start),
        "ca_help_started": _count_distinct_sessions(["ca_help_started"], start),
        "ca_help_submitted": _count_distinct_sessions(["ca_help_submitted"], start),
        "assisted_offer_seen": _count_distinct_sessions(["assisted_offer_seen"], start),
        "assisted_offer_clicked": _count_distinct_sessions(["assisted_offer_clicked"], start),
    }
    base = steps["search_performed"] or 1
    conversion_rates = {
        step: round((count / base) * 100, 2)
        for step, count in steps.items()
    }
    return {
        "window": window,
        "from": start,
        "to": timezone.now(),
        "steps": steps,
        "conversion_rates": conversion_rates,
    }


def _weekly_bounds(reference: timezone.datetime) -> tuple:
    week_start = (reference - timedelta(days=reference.weekday())).date()
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


def _compute_kpi_metrics(window: str) -> dict:
    start = _window_to_start(window)

    unique_visitors = (
        AnalyticsEvent.objects.filter(created_at__gte=start)
        .values("session_id")
        .distinct()
        .count()
    )
    searches = AnalyticsEvent.objects.filter(created_at__gte=start, event_name__in=["search_performed", "notice_search"]).count()
    details = AnalyticsEvent.objects.filter(created_at__gte=start, event_name__in=["notice_opened", "notice_detail_viewed"]).count()
    ca_submits = AnalyticsEvent.objects.filter(created_at__gte=start, event_name="ca_help_submitted").count()
    assisted_clicks = AnalyticsEvent.objects.filter(created_at__gte=start, event_name="assisted_offer_clicked").count()

    return {
        "unique_visitors": unique_visitors,
        "search_events": searches,
        "notice_views": details,
        "ca_help_submissions": ca_submits,
        "assisted_offer_clicks": assisted_clicks,
    }


def _ensure_weekly_snapshot() -> WeeklyKpiSnapshot:
    now = timezone.now()
    week_start, week_end = _weekly_bounds(now)
    snapshot, _created = WeeklyKpiSnapshot.objects.get_or_create(
        week_start=week_start,
        defaults={
            "week_end": week_end,
            "metrics": _compute_kpi_metrics("7d"),
        },
    )
    return snapshot


def _ensure_default_payment_plan() -> PaymentPlan:
    default_key = "single_use_notice_parse"
    plan = PaymentPlan.objects.filter(key=default_key).first()
    if plan:
        if not plan.is_active:
            plan.is_active = True
            plan.save(update_fields=["is_active", "updated_at"])
        return plan

    return PaymentPlan.objects.create(
        key=default_key,
        name="Single Notice Parse",
        description="Upload one tax notice and unlock one parser result.",
        amount_paise=900,
        currency="INR",
        credits=1,
        is_active=True,
        is_default=True,
    )


def _cashfree_base_url() -> str:
    env = getattr(settings, "CASHFREE_ENV", "sandbox").strip().lower()
    if env == "production":
        return "https://api.cashfree.com/pg/orders"
    return "https://sandbox.cashfree.com/pg/orders"


def _cashfree_headers() -> dict:
    return {
        "x-client-id": settings.CASHFREE_APP_ID,
        "x-client-secret": settings.CASHFREE_SECRET_KEY,
        "x-api-version": "2023-08-01",
        "content-type": "application/json",
    }


def _payment_provider_default() -> str:
    provider = (getattr(settings, "PAYMENT_PROVIDER_DEFAULT", "cashfree") or "cashfree").strip().lower()
    if provider not in {"cashfree", "razorpay"}:
        return "cashfree"
    return provider


def _resolve_provider(requested_provider: str = "") -> str:
    requested = (requested_provider or "").strip().lower()
    if requested in {"cashfree", "razorpay"}:
        return requested
    return _payment_provider_default()


def _razorpay_order_url() -> str:
    return "https://api.razorpay.com/v1/orders"


def _razorpay_checkout_config(plan) -> dict:
    return {
        "key_id": settings.RAZORPAY_KEY_ID,
        "name": "Complia",
        "description": plan.name,
    }


def _razorpay_signature_valid(raw_body: bytes, signature: str) -> bool:
    if not settings.RAZORPAY_WEBHOOK_SECRET or not signature:
        return False

    generated = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return constant_time_compare(generated, signature.strip())


def _cashfree_signature_valid(raw_body: bytes, signature: str, timestamp: str = "") -> bool:
    if not settings.CASHFREE_WEBHOOK_SECRET:
        return False
    if not signature:
        return False

    signing_key = settings.CASHFREE_WEBHOOK_SECRET.encode("utf-8")
    signature_clean = signature.strip()
    # Accept common prefixed signatures such as "sha256=<signature>".
    if "=" in signature_clean and signature_clean.lower().startswith("sha256="):
        signature_clean = signature_clean.split("=", 1)[1].strip()

    digest = hmac.new(
        signing_key,
        raw_body,
        hashlib.sha256,
    ).digest()
    digest_hex = digest.hex()
    digest_b64 = base64.b64encode(digest).decode("utf-8")
    digest_b64_urlsafe = base64.urlsafe_b64encode(digest).decode("utf-8")
    candidates = {
        digest_hex,
        digest_hex.lower(),
        digest_b64,
        digest_b64.rstrip("="),
        digest_b64_urlsafe,
        digest_b64_urlsafe.rstrip("="),
    }
    for candidate in candidates:
        if constant_time_compare(signature_clean, candidate):
            return True

    if timestamp:
        raw_text = raw_body.decode("utf-8", errors="replace")
        timestamp_payload = f"{timestamp}{raw_text}".encode("utf-8")
        digest_ts = hmac.new(
            signing_key,
            timestamp_payload,
            hashlib.sha256,
        ).digest()
        digest_ts_hex = digest_ts.hex()
        digest_ts_b64 = base64.b64encode(digest_ts).decode("utf-8")
        digest_ts_b64_urlsafe = base64.urlsafe_b64encode(digest_ts).decode("utf-8")
        timestamp_candidates = {
            digest_ts_hex,
            digest_ts_hex.lower(),
            digest_ts_b64,
            digest_ts_b64.rstrip("="),
            digest_ts_b64_urlsafe,
            digest_ts_b64_urlsafe.rstrip("="),
        }
        for candidate in timestamp_candidates:
            if constant_time_compare(signature_clean, candidate):
                return True

    return False


def _csv_response(filename: str, headers: list[str], rows: list[list[str]]) -> HttpResponse:
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)

    response = HttpResponse(buffer.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


class GoogleLogin(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "analytics_event"

    def post(self, request):
        access_token = request.data.get("access_token")
        if not access_token:
            return Response({"detail": "access_token is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            google_response = requests.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=8,
            )
        except requests.RequestException:
            return Response({"detail": "Could not reach Google auth service."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if google_response.status_code != status.HTTP_200_OK:
            return Response({"detail": "Invalid Google access token."}, status=status.HTTP_400_BAD_REQUEST)

        profile = google_response.json()
        email = profile.get("email")
        if not email:
            return Response({"detail": "Google profile email is missing."}, status=status.HTTP_400_BAD_REQUEST)

        user, _created = User.objects.get_or_create(
            email=email,
            defaults={
                "first_name": profile.get("given_name", ""),
                "last_name": profile.get("family_name", ""),
                "user_type": "taxpayer",
            },
        )

        if email.lower() in settings.SUPERADMIN_EMAILS:
            fields_to_update = []
            if user.user_type != "admin":
                user.user_type = "admin"
                fields_to_update.append("user_type")
            if not user.is_staff:
                user.is_staff = True
                fields_to_update.append("is_staff")
            if not user.is_superuser:
                user.is_superuser = True
                fields_to_update.append("is_superuser")
            if fields_to_update:
                user.save(update_fields=fields_to_update)

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserDetailSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class CAHelpRequestCreateView(generics.CreateAPIView):
    serializer_class = CAHelpRequestSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ca_help"

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(
            user=user,
            consent_recorded_at=timezone.now(),
        )


class MyCAHelpRequestListView(generics.ListAPIView):
    serializer_class = CAHelpRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ca_help"

    def get_queryset(self):
        queryset = CAHelpRequest.objects.filter(user=self.request.user).select_related("assigned_ca")
        notice_code = (self.request.query_params.get("notice_code") or "").strip()
        if notice_code:
            queryset = queryset.filter(notice_code=notice_code)
        return queryset.order_by("-created_at")


class SuperAdminCAPanelViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CAPanelProfileSerializer
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_ops"
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["display_name", "email", "city", "icai_membership_number", "notes"]
    ordering_fields = ["display_name", "city", "turnaround_sla_hours", "updated_at", "created_at"]
    ordering = ["display_name", "email"]

    def get_queryset(self):
        eligible_users = User.objects.filter(user_type="ca", is_verified_ca=True).exclude(email="")
        existing_user_ids = set(
            CAPanelProfile.objects.exclude(user__isnull=True).values_list("user_id", flat=True)
        )
        missing_profiles = [user for user in eligible_users if user.id not in existing_user_ids]
        for user in missing_profiles:
            display_name = f"{user.first_name} {user.last_name}".strip() or user.email.split("@")[0]
            CAPanelProfile.objects.get_or_create(
                user=user,
                defaults={
                    "display_name": display_name,
                    "email": user.email,
                    "phone_number": user.phone_number or "",
                    "is_active": True,
                },
            )
        queryset = CAPanelProfile.objects.select_related("user").all()
        status_filter = (self.request.query_params.get("status") or "").strip()
        if status_filter == "active":
            queryset = queryset.filter(is_active=True)
        elif status_filter == "inactive":
            queryset = queryset.filter(is_active=False)
        return queryset.order_by("display_name", "email")


class AnalyticsEventCreateView(generics.CreateAPIView):
    serializer_class = AnalyticsEventSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "analytics_event"

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)


class AssistedIntentCreateView(generics.CreateAPIView):
    serializer_class = AssistedIntentSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "assisted_intent"

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)


class AssistedOfferConfigView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "analytics_event"

    def get(self, request):
        if not settings.ASSISTED_OFFER_ENABLED:
            return Response({"enabled": False, "offer": None})

        requested_key = (request.query_params.get("key") or settings.ASSISTED_OFFER_DEFAULT_KEY).strip()
        active_offer = AssistedOffer.objects.filter(is_active=True, key=requested_key).first()

        if active_offer is None:
            active_offer = AssistedOffer.objects.filter(is_active=True).order_by("key").first()

        if active_offer is not None:
            return Response(
                {
                    "enabled": True,
                    "offer": AssistedOfferSerializer(active_offer).data,
                }
            )

        fallback_severity = settings.ASSISTED_OFFER_TARGET_SEVERITY
        if fallback_severity not in {"all", "low", "medium", "high"}:
            fallback_severity = "high"

        return Response(
            {
                "enabled": True,
                "offer": {
                    "key": settings.ASSISTED_OFFER_DEFAULT_KEY,
                    "name": "Assisted Response Pack",
                    "description": "Get expert help to draft and review your response.",
                    "target_severity": fallback_severity,
                    "config": {},
                    "is_active": True,
                },
            }
        )


class ExperimentExposureCreateView(generics.CreateAPIView):
    serializer_class = ExperimentExposureSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "experiment_exposure"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user if request.user.is_authenticated else None

        data = serializer.validated_data
        exposure, _created = ExperimentExposure.objects.update_or_create(
            session_id=data["session_id"],
            experiment_key=data["experiment_key"],
            defaults={
                "user": user,
                "variant": data["variant"],
                "path": data.get("path", ""),
                "metadata": data.get("metadata", {}),
            },
        )
        output = self.get_serializer(exposure)
        return Response(output.data, status=status.HTTP_201_CREATED)


class PaymentPlanListView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "analytics_event"

    def get(self, request):
        _ensure_default_payment_plan()
        plans = PaymentPlan.objects.filter(is_active=True).order_by("amount_paise", "key")
        return Response(PaymentPlanSerializer(plans, many=True).data)


class PaymentOrderCreateView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "assisted_intent"
    serializer_class = PaymentOrderCreateSerializer

    def post(self, request):
        _ensure_default_payment_plan()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan_key = serializer.validated_data["plan_key"]
        provider = _resolve_provider(serializer.validated_data.get("provider", ""))

        plan = PaymentPlan.objects.filter(key=plan_key, is_active=True).first()
        if not plan:
            return Response(
                {
                    "status": "error",
                    "message": "Selected plan is not available.",
                    "code": "invalid_plan",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        order_id = f"cmp-{uuid.uuid4().hex[:24]}"
        payment_order = PaymentOrder.objects.create(
            user=request.user,
            plan=plan,
            order_id=order_id,
            provider=provider,
            amount_paise=plan.amount_paise,
            currency=plan.currency,
            credits=plan.credits,
            status="created",
            metadata={},
        )

        if provider == "cashfree":
            amount_inr = round(plan.amount_paise / 100.0, 2)
            customer_phone = (request.user.phone_number or "").strip() or "9999999999"
            return_url = getattr(settings, "CASHFREE_RETURN_URL", "").strip()
            if not return_url:
                return_url = f"{getattr(settings, 'PUBLIC_SITE_URL', '').rstrip('/')}/parser"

            payload = {
                "order_id": order_id,
                "order_amount": amount_inr,
                "order_currency": plan.currency,
                "customer_details": {
                    "customer_id": str(request.user.id),
                    "customer_email": request.user.email,
                    "customer_phone": customer_phone,
                },
                "order_meta": {
                    "return_url": f"{return_url}?order_id={order_id}",
                },
                "order_note": f"Complia {plan.key}",
            }

            credentials_ready = bool(settings.CASHFREE_APP_ID and settings.CASHFREE_SECRET_KEY)
            if not credentials_ready and settings.DEBUG:
                payment_order.status = "payment_pending"
                payment_order.payment_session_id = f"sandbox_session_{payment_order.order_id}"
                payment_order.provider_order_id = payment_order.order_id
                payment_order.metadata = {"request_payload": payload, "provider": "cashfree"}
                payment_order.save(
                    update_fields=[
                        "status",
                        "payment_session_id",
                        "provider_order_id",
                        "metadata",
                        "updated_at",
                    ]
                )
                return Response(PaymentOrderSerializer(payment_order).data, status=status.HTTP_201_CREATED)
            if not credentials_ready:
                payment_order.status = "failed"
                payment_order.failure_reason = "Cashfree credentials are not configured."
                payment_order.save(update_fields=["status", "failure_reason", "updated_at"])
                return Response(
                    {
                        "status": "error",
                        "message": "Payment provider is not configured.",
                        "code": "payment_provider_not_configured",
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

            try:
                cf_response = requests.post(
                    _cashfree_base_url(),
                    headers=_cashfree_headers(),
                    data=json.dumps(payload),
                    timeout=15,
                )
            except requests.RequestException:
                payment_order.status = "failed"
                payment_order.failure_reason = "Could not connect to Cashfree."
                payment_order.save(update_fields=["status", "failure_reason", "updated_at"])
                return Response(
                    {
                        "status": "error",
                        "message": "Could not create payment order.",
                        "code": "payment_provider_unavailable",
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

            if cf_response.status_code not in {200, 201}:
                payment_order.status = "failed"
                payment_order.failure_reason = f"Cashfree order creation failed ({cf_response.status_code})."
                payment_order.save(update_fields=["status", "failure_reason", "updated_at"])
                return Response(
                    {
                        "status": "error",
                        "message": "Payment provider rejected the request.",
                        "code": "payment_provider_error",
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            try:
                response_data = cf_response.json()
            except ValueError:
                payment_order.status = "failed"
                payment_order.failure_reason = "Cashfree returned an invalid JSON response."
                payment_order.save(update_fields=["status", "failure_reason", "updated_at"])
                return Response(
                    {
                        "status": "error",
                        "message": "Payment provider returned an invalid response.",
                        "code": "payment_provider_invalid_response",
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            payment_order.provider_order_id = response_data.get("order_id", "")
            payment_order.payment_session_id = response_data.get("payment_session_id", "")
            payment_order.checkout_url = response_data.get("order_meta", {}).get("payment_link", "")
            payment_order.status = "payment_pending"
            payment_order.metadata = {
                "provider": "cashfree",
                "request_payload": payload,
                "cashfree_response": response_data,
            }
            payment_order.save(
                update_fields=[
                    "provider_order_id",
                    "payment_session_id",
                    "checkout_url",
                    "status",
                    "metadata",
                    "updated_at",
                ]
            )
            return Response(PaymentOrderSerializer(payment_order).data, status=status.HTTP_201_CREATED)

        payload = {
            "amount": int(plan.amount_paise),
            "currency": plan.currency,
            "receipt": order_id[:40],
            "notes": {
                "complia_order_id": order_id,
                "plan_key": plan.key,
                "user_id": str(request.user.id),
                "user_email": request.user.email,
            },
        }

        credentials_ready = bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)
        if not credentials_ready and settings.DEBUG:
            payment_order.status = "payment_pending"
            payment_order.provider_order_id = f"order_sandbox_{payment_order.order_id}"
            payment_order.metadata = {
                "provider": "razorpay",
                "request_payload": payload,
                "checkout": _razorpay_checkout_config(plan),
            }
            payment_order.save(
                update_fields=["status", "provider_order_id", "metadata", "updated_at"]
            )
            return Response(PaymentOrderSerializer(payment_order).data, status=status.HTTP_201_CREATED)
        if not credentials_ready:
            payment_order.status = "failed"
            payment_order.failure_reason = "Razorpay credentials are not configured."
            payment_order.save(update_fields=["status", "failure_reason", "updated_at"])
            return Response(
                {
                    "status": "error",
                    "message": "Payment provider is not configured.",
                    "code": "payment_provider_not_configured",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            rzp_response = requests.post(
                _razorpay_order_url(),
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
                json=payload,
                timeout=15,
            )
        except requests.RequestException:
            payment_order.status = "failed"
            payment_order.failure_reason = "Could not connect to Razorpay."
            payment_order.save(update_fields=["status", "failure_reason", "updated_at"])
            return Response(
                {
                    "status": "error",
                    "message": "Could not create payment order.",
                    "code": "payment_provider_unavailable",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if rzp_response.status_code not in {200, 201}:
            payment_order.status = "failed"
            payment_order.failure_reason = f"Razorpay order creation failed ({rzp_response.status_code})."
            payment_order.save(update_fields=["status", "failure_reason", "updated_at"])
            return Response(
                {
                    "status": "error",
                    "message": "Payment provider rejected the request.",
                    "code": "payment_provider_error",
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            response_data = rzp_response.json()
        except ValueError:
            payment_order.status = "failed"
            payment_order.failure_reason = "Razorpay returned an invalid JSON response."
            payment_order.save(update_fields=["status", "failure_reason", "updated_at"])
            return Response(
                {
                    "status": "error",
                    "message": "Payment provider returned an invalid response.",
                    "code": "payment_provider_invalid_response",
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payment_order.provider_order_id = response_data.get("id", "")
        payment_order.status = "payment_pending"
        payment_order.metadata = {
            "provider": "razorpay",
            "request_payload": payload,
            "razorpay_response": response_data,
            "checkout": _razorpay_checkout_config(plan),
        }
        payment_order.save(
            update_fields=["provider_order_id", "status", "metadata", "updated_at"]
        )
        return Response(PaymentOrderSerializer(payment_order).data, status=status.HTTP_201_CREATED)


class PaymentTestConfirmView(generics.GenericAPIView):
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_ops"
    serializer_class = PaymentTestConfirmSerializer

    def post(self, request):
        if not settings.TEST_PAYMENT_API_ENABLED:
            return Response(
                {
                    "status": "error",
                    "message": "Test payment API is disabled.",
                    "code": "test_payment_api_disabled",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order_id = serializer.validated_data.get("order_id", "")
        plan_key = serializer.validated_data.get("plan_key", "")
        user_email = serializer.validated_data.get("user_email", "")
        provider_payment_id = serializer.validated_data.get("provider_payment_id", "").strip()
        provider_status = "SUCCESS"

        payment_order = None
        if order_id:
            payment_order = PaymentOrder.objects.filter(order_id=order_id).first()
            if not payment_order:
                return Response(
                    {
                        "status": "error",
                        "message": "Payment order not found.",
                        "code": "order_not_found",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            plan = PaymentPlan.objects.filter(key=plan_key, is_active=True).first()
            if not plan:
                return Response(
                    {
                        "status": "error",
                        "message": "Selected plan is not available.",
                        "code": "invalid_plan",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            target_user = request.user
            if user_email:
                target_user = User.objects.filter(email__iexact=user_email).first()
                if not target_user:
                    return Response(
                        {
                            "status": "error",
                            "message": "Target user not found.",
                            "code": "user_not_found",
                        },
                        status=status.HTTP_404_NOT_FOUND,
                    )

            generated_order_id = f"test-{uuid.uuid4().hex[:24]}"
            payment_order = PaymentOrder.objects.create(
                user=target_user,
                plan=plan,
                order_id=generated_order_id,
                provider="cashfree",
                provider_order_id=generated_order_id,
                amount_paise=plan.amount_paise,
                currency=plan.currency,
                credits=plan.credits,
                status="payment_pending",
                metadata={"source": "test_payment_api"},
            )

        idempotency_key = f"test:{payment_order.order_id}:{provider_payment_id or 'no-payment-id'}:{provider_status}"
        transaction_row, created = PaymentTransaction.objects.get_or_create(
            idempotency_key=idempotency_key,
            defaults={
                "payment_order": payment_order,
                "provider_payment_id": provider_payment_id,
                "provider_status": provider_status,
                "signature_verified": True,
                "payload": {
                    "source": "test_api",
                    "order_id": payment_order.order_id,
                    "provider_payment_id": provider_payment_id,
                    "provider_status": provider_status,
                },
                "processed_at": timezone.now(),
            },
        )

        if created:
            grant_parser_credits_once(payment_order)
            AnalyticsEvent.objects.create(
                user=payment_order.user,
                session_id=f"test-pay-{payment_order.order_id}",
                event_name="payment_success",
                path="/payments/test-confirm",
                metadata={"order_id": payment_order.order_id, "plan_key": payment_order.plan.key},
            )

        transaction_row.processed_at = timezone.now()
        transaction_row.save(update_fields=["processed_at"])

        payment_order.refresh_from_db()
        return Response(
            {
                "status": "ok",
                "duplicate": not created,
                "order": PaymentOrderSerializer(payment_order).data,
            },
            status=status.HTTP_200_OK,
        )


class CashfreeWebhookView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "analytics_event"

    def post(self, request):
        signature = (
            request.headers.get("x-webhook-signature")
            or request.headers.get("x-cf-signature")
            or request.headers.get("x-signature")
            or ""
        ).strip()
        timestamp = (request.headers.get("x-webhook-timestamp") or "").strip()
        raw_body = request.body or b""

        if not _cashfree_signature_valid(raw_body, signature, timestamp):
            return Response(
                {
                    "status": "error",
                    "message": "Invalid webhook signature.",
                    "code": "invalid_signature",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = request.data or {}
        data = payload.get("data", {})
        order_data = data.get("order", {})
        payment_data = data.get("payment", {})

        provider_order_id = (
            order_data.get("order_id")
            or payload.get("order_id")
            or payload.get("cf_order_id")
            or ""
        ).strip()
        provider_payment_id = (
            payment_data.get("cf_payment_id")
            or payment_data.get("payment_id")
            or payload.get("cf_payment_id")
            or ""
        ).strip()
        provider_status = (
            payment_data.get("payment_status")
            or order_data.get("order_status")
            or payload.get("payment_status")
            or payload.get("order_status")
            or payload.get("type")
            or ""
        ).strip()

        if not provider_order_id:
            return Response(
                {
                    "status": "error",
                    "message": "Missing order reference.",
                    "code": "missing_order_id",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment_order = PaymentOrder.objects.filter(
            Q(order_id=provider_order_id) | Q(provider_order_id=provider_order_id)
        ).first()
        if not payment_order:
            return Response({"status": "ok"}, status=status.HTTP_200_OK)

        idempotency_key = f"{provider_order_id}:{provider_payment_id or 'no-payment-id'}:{provider_status or 'unknown'}"
        transaction_row, created = PaymentTransaction.objects.get_or_create(
            idempotency_key=idempotency_key,
            defaults={
                "payment_order": payment_order,
                "provider_payment_id": provider_payment_id,
                "provider_status": provider_status,
                "signature_verified": True,
                "payload": payload,
                "processed_at": timezone.now(),
            },
        )

        if not created:
            return Response({"status": "ok", "duplicate": True}, status=status.HTTP_200_OK)

        if is_success_status(provider_status):
            grant_parser_credits_once(payment_order)
            AnalyticsEvent.objects.create(
                user=payment_order.user,
                session_id=f"pay-{payment_order.order_id}",
                event_name="payment_success",
                path="/payments/webhook",
                metadata={"order_id": payment_order.order_id, "plan_key": payment_order.plan.key},
            )
        elif is_failure_status(provider_status):
            payment_order.status = "failed"
            payment_order.failure_reason = provider_status or "Payment failed"
            payment_order.save(update_fields=["status", "failure_reason", "updated_at"])
            AnalyticsEvent.objects.create(
                user=payment_order.user,
                session_id=f"pay-{payment_order.order_id}",
                event_name="payment_failed",
                path="/payments/webhook",
                metadata={"order_id": payment_order.order_id, "plan_key": payment_order.plan.key},
            )
        else:
            payment_order.status = "payment_pending"
            payment_order.save(update_fields=["status", "updated_at"])

        transaction_row.processed_at = timezone.now()
        transaction_row.save(update_fields=["processed_at"])
        return Response({"status": "ok"}, status=status.HTTP_200_OK)


class RazorpayWebhookView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "analytics_event"

    def post(self, request):
        signature = (request.headers.get("x-razorpay-signature") or "").strip()
        raw_body = request.body or b""

        if not _razorpay_signature_valid(raw_body, signature):
            return Response(
                {
                    "status": "error",
                    "message": "Invalid webhook signature.",
                    "code": "invalid_signature",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = request.data or {}
        event_name = (payload.get("event") or "").strip()
        body_payload = payload.get("payload", {}) if isinstance(payload, dict) else {}

        payment_entity = (body_payload.get("payment", {}) or {}).get("entity", {})
        order_entity = (body_payload.get("order", {}) or {}).get("entity", {})

        provider_order_id = (
            payment_entity.get("order_id")
            or order_entity.get("id")
            or ""
        ).strip()
        provider_payment_id = (payment_entity.get("id") or "").strip()
        provider_status = (
            payment_entity.get("status")
            or order_entity.get("status")
            or event_name
            or ""
        ).strip()

        if not provider_order_id:
            return Response(
                {
                    "status": "error",
                    "message": "Missing order reference.",
                    "code": "missing_order_id",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment_order = PaymentOrder.objects.filter(
            Q(provider_order_id=provider_order_id) | Q(order_id=provider_order_id)
        ).first()
        if not payment_order:
            return Response({"status": "ok"}, status=status.HTTP_200_OK)

        success_event = event_name in {"payment.captured", "order.paid", "payment.authorized"}
        failed_event = event_name in {"payment.failed"}
        if success_event and provider_status.lower() not in {"captured", "paid", "completed"}:
            provider_status = "CAPTURED"
        elif failed_event:
            provider_status = payment_entity.get("error_reason") or "FAILED"

        idempotency_key = f"rzp:{provider_order_id}:{provider_payment_id or 'no-payment-id'}:{event_name or provider_status or 'unknown'}"
        transaction_row, created = PaymentTransaction.objects.get_or_create(
            idempotency_key=idempotency_key,
            defaults={
                "payment_order": payment_order,
                "provider_payment_id": provider_payment_id,
                "provider_status": provider_status,
                "signature_verified": True,
                "payload": payload,
                "processed_at": timezone.now(),
            },
        )
        if not created:
            return Response({"status": "ok", "duplicate": True}, status=status.HTTP_200_OK)

        if is_success_status(provider_status) or success_event:
            grant_parser_credits_once(payment_order)
            AnalyticsEvent.objects.create(
                user=payment_order.user,
                session_id=f"pay-{payment_order.order_id}",
                event_name="payment_success",
                path="/payments/webhook/razorpay",
                metadata={"order_id": payment_order.order_id, "plan_key": payment_order.plan.key},
            )
        elif is_failure_status(provider_status) or failed_event:
            payment_order.status = "failed"
            payment_order.failure_reason = provider_status or "Payment failed"
            payment_order.save(update_fields=["status", "failure_reason", "updated_at"])
            AnalyticsEvent.objects.create(
                user=payment_order.user,
                session_id=f"pay-{payment_order.order_id}",
                event_name="payment_failed",
                path="/payments/webhook/razorpay",
                metadata={"order_id": payment_order.order_id, "plan_key": payment_order.plan.key},
            )
        else:
            payment_order.status = "payment_pending"
            payment_order.save(update_fields=["status", "updated_at"])

        transaction_row.processed_at = timezone.now()
        transaction_row.save(update_fields=["processed_at"])
        return Response({"status": "ok"}, status=status.HTTP_200_OK)


class MyEntitlementsView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "analytics_event"

    def get(self, request):
        entitlement, _ = UserEntitlement.objects.get_or_create(
            user=request.user,
            defaults={
                "parser_credits": 0,
                "lifetime_purchased_credits": 0,
                "lifetime_consumed_credits": 0,
            },
        )
        return Response(UserEntitlementSerializer(entitlement).data)


class PaymentOrderGrantCreditsView(generics.GenericAPIView):
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_ops"

    def post(self, request, order_id: str):
        payment_order = PaymentOrder.objects.filter(order_id=order_id).first()
        if not payment_order:
            return Response(
                {
                    "status": "error",
                    "message": "Payment order not found.",
                    "code": "order_not_found",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if not is_order_credit_eligible(payment_order):
            payment_order.refresh_from_db()
            if payment_order.credit_granted_at:
                return Response(
                    {
                        "status": "ok",
                        "duplicate": True,
                        "order": PaymentOrderSerializer(payment_order).data,
                    },
                    status=status.HTTP_200_OK,
                )
            return Response(
                {
                    "status": "error",
                    "message": "Order is not eligible for credit grant.",
                    "code": "order_not_eligible",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        grant_parser_credits_once(payment_order)
        payment_order.refresh_from_db()
        return Response(
            {
                "status": "ok",
                "duplicate": False,
                "order": PaymentOrderSerializer(payment_order).data,
            },
            status=status.HTTP_200_OK,
        )


class SuperAdminPaymentOrderViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AdminPaymentOrderSerializer
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_ops"
    queryset = PaymentOrder.objects.select_related("user", "plan").all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["order_id", "provider_order_id", "user__email", "failure_reason", "plan__key"]
    ordering_fields = ["created_at", "updated_at", "paid_at", "amount_paise", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = (self.request.query_params.get("status") or "").strip().lower()
        stale_after_minutes = getattr(settings, "PAYMENT_PENDING_ABANDON_MINUTES", 20)
        stale_cutoff = timezone.now() - timedelta(minutes=stale_after_minutes)

        if status_filter in {"created", "payment_pending", "paid", "failed", "cancelled"}:
            return queryset.filter(status=status_filter)

        if status_filter == "success":
            return queryset.filter(status="paid")
        if status_filter == "failed":
            return queryset.filter(status="failed")
        if status_filter == "initiated":
            return queryset.filter(status__in=["created", "payment_pending"], created_at__gte=stale_cutoff)
        if status_filter == "abandoned":
            return queryset.filter(
                Q(status="cancelled")
                | Q(status__in=["created", "payment_pending"], created_at__lt=stale_cutoff)
            )
        return queryset


class SuperAdminMetricsView(generics.GenericAPIView):
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_metrics"

    def get(self, request):
        now = timezone.now()
        live_window_start = now - timedelta(minutes=2)

        total_visitors = AnalyticsEvent.objects.values("session_id").distinct().count()
        live_visitors = (
            AnalyticsEvent.objects.filter(created_at__gte=live_window_start)
            .values("session_id")
            .distinct()
            .count()
        )

        top_search = (
            AnalyticsEvent.objects.filter(event_name__in=["search_performed", "notice_search"])
            .values("metadata__query")
            .annotate(total=Count("id"))
            .order_by("-total")
            .first()
        )

        top_notice = top_search["metadata__query"] if top_search and top_search["metadata__query"] else "N/A"
        top_notice_count = top_search["total"] if top_search else 0

        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        visitors_today = (
            AnalyticsEvent.objects.filter(created_at__gte=today_start)
            .values("session_id")
            .distinct()
            .count()
        )

        total_searches = AnalyticsEvent.objects.filter(event_name__in=["search_performed", "notice_search"]).count()
        total_notice_views = AnalyticsEvent.objects.filter(event_name__in=["notice_opened", "notice_detail_viewed"]).count()
        total_ca_help_submissions = AnalyticsEvent.objects.filter(event_name="ca_help_submitted").count()

        return Response(
            {
                "total_visitors": total_visitors,
                "visitors_today": visitors_today,
                "live_visitors": live_visitors,
                "most_searched_notice": top_notice,
                "most_searched_notice_count": top_notice_count,
                "total_searches": total_searches,
                "total_notice_views": total_notice_views,
                "ca_help_submissions": total_ca_help_submissions,
            }
        )


class SuperAdminFunnelView(generics.GenericAPIView):
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_metrics"

    def get(self, request):
        window = request.query_params.get("window", "7d")
        if window not in {"7d", "30d"}:
            window = "7d"
        return Response(_build_funnel(window))


class SuperAdminKpiView(generics.GenericAPIView):
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_metrics"

    def get(self, request):
        window = request.query_params.get("window", "7d")
        if window not in {"7d", "30d"}:
            window = "7d"

        _ensure_weekly_snapshot()
        snapshots = WeeklyKpiSnapshot.objects.all()[:8]
        return Response(
            {
                "window": window,
                "current": _compute_kpi_metrics(window),
                "weekly_snapshots": WeeklyKpiSnapshotSerializer(snapshots, many=True).data,
            }
        )


class SuperAdminCsvExportView(generics.GenericAPIView):
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_ops"

    def get(self, request, report_key: str):
        report_key = (report_key or "").strip().lower()
        if report_key == "ca_requests":
            return self._export_ca_requests(request)
        if report_key == "assisted_intents":
            return self._export_assisted_intents(request)
        if report_key == "feedback":
            return self._export_feedback(request)
        if report_key == "notice_qa":
            return self._export_notice_qa(request)
        if report_key == "parser_jobs":
            return self._export_parser_jobs(request)
        return Response(
            {"detail": "Unknown report key."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def _export_ca_requests(self, request):
        queryset = CAHelpRequest.objects.select_related("assigned_ca").all().order_by("-created_at")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        rows = [
            [
                str(item.id),
                item.notice_code,
                item.name,
                item.email,
                item.phone_number or "",
                "yes" if item.consent_to_share_with_ca else "no",
                item.status,
                item.priority,
                item.assigned_ca.display_name if item.assigned_ca else "",
                item.assigned_to_email or "",
                item.assigned_at.isoformat() if item.assigned_at else "",
                item.shared_case_materials_at.isoformat() if item.shared_case_materials_at else "",
                item.contacted_at.isoformat() if item.contacted_at else "",
                item.engaged_at.isoformat() if item.engaged_at else "",
                item.closed_at.isoformat() if item.closed_at else "",
                item.created_at.isoformat(),
            ]
            for item in queryset
        ]
        return _csv_response(
            "complia_ca_requests.csv",
            [
                "id",
                "notice_code",
                "name",
                "email",
                "phone_number",
                "consent_to_share_with_ca",
                "status",
                "priority",
                "assigned_ca",
                "assigned_to",
                "assigned_at",
                "shared_case_materials_at",
                "contacted_at",
                "engaged_at",
                "closed_at",
                "created_at",
            ],
            rows,
        )

    def _export_assisted_intents(self, request):
        queryset = AssistedIntent.objects.select_related("notice", "offer").all().order_by("-created_at")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        rows = [
            [
                str(item.id),
                item.notice_code_snapshot or "",
                item.notice.title if item.notice else "",
                item.name or "",
                item.email or "",
                item.phone_number or "",
                item.status,
                item.experiment_key or "",
                item.experiment_variant or "",
                item.created_at.isoformat(),
            ]
            for item in queryset
        ]
        return _csv_response(
            "complia_assisted_intents.csv",
            [
                "id",
                "notice_code_snapshot",
                "notice_title",
                "name",
                "email",
                "phone_number",
                "status",
                "experiment_key",
                "experiment_variant",
                "created_at",
            ],
            rows,
        )

    def _export_feedback(self, request):
        from complia_backend.notices.models import NoticeFeedback

        queryset = NoticeFeedback.objects.select_related("notice").all().order_by("-created_at")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        rows = [
            [
                str(item.id),
                item.notice.code if item.notice else "",
                item.notice.title if item.notice else "",
                "yes" if item.is_helpful else "no",
                item.status,
                (item.comments or "").replace("\n", " ").strip(),
                item.created_at.isoformat(),
            ]
            for item in queryset
        ]
        return _csv_response(
            "complia_feedback.csv",
            ["id", "notice_code", "notice_title", "is_helpful", "status", "comments", "created_at"],
            rows,
        )

    def _export_notice_qa(self, request):
        from complia_backend.notices.models import NoticeType

        queryset = NoticeType.objects.all().order_by("code")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter == "stale":
            stale_cutoff = timezone.now() - timedelta(days=90)
            queryset = queryset.filter(verified_at__lt=stale_cutoff)
        elif status_filter == "unverified":
            queryset = queryset.filter(verified_at__isnull=True)

        rows = [
            [
                str(item.id),
                item.code,
                item.title,
                item.severity,
                "yes" if item.is_active else "no",
                item.verified_by or "",
                item.verified_at.isoformat() if item.verified_at else "",
                item.updated_at.isoformat(),
            ]
            for item in queryset
        ]
        return _csv_response(
            "complia_notice_qa.csv",
            ["id", "code", "title", "severity", "is_active", "verified_by", "verified_at", "updated_at"],
            rows,
        )

    def _export_parser_jobs(self, request):
        from complia_backend.notices.models import ParserJob

        queryset = ParserJob.objects.select_related("notice", "extraction").all().order_by("-created_at")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        rows = []
        for item in queryset:
            extraction = getattr(item, "extraction", None)
            rows.append(
                [
                    str(item.id),
                    item.original_filename,
                    item.notice.code if item.notice else "",
                    item.status,
                    f"{item.confidence:.4f}",
                    extraction.legal_section if extraction else "",
                    str(extraction.amount_claimed) if extraction and extraction.amount_claimed is not None else "",
                    extraction.deadline_date.isoformat() if extraction and extraction.deadline_date else "",
                    extraction.review_status if extraction else "",
                    item.created_at.isoformat(),
                ]
            )

        return _csv_response(
            "complia_parser_jobs.csv",
            [
                "id",
                "original_filename",
                "notice_code",
                "status",
                "confidence",
                "legal_section",
                "amount_claimed",
                "deadline_date",
                "extraction_review_status",
                "created_at",
            ],
            rows,
        )


class SuperAdminCAHelpRequestViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AdminCAHelpRequestSerializer
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_ops"
    queryset = CAHelpRequest.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "email", "notice_code", "phone_number", "message", "internal_notes"]
    ordering_fields = ["created_at", "updated_at", "status", "priority"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def perform_update(self, serializer):
        instance = serializer.instance
        old_status = instance.status
        old_assigned_email = instance.assigned_to_email
        old_assigned_ca_id = instance.assigned_ca_id
        updated = serializer.save()

        updates = []
        if updated.consent_to_share_with_ca and not updated.consent_recorded_at:
            updated.consent_recorded_at = timezone.now()
            updates.append("consent_recorded_at")
        if updated.assigned_ca_id and updated.assigned_ca_id != old_assigned_ca_id:
            updated.assigned_to_email = updated.assigned_ca.email
            updates.append("assigned_to_email")
        if updated.assigned_to_email and updated.assigned_to_email != old_assigned_email and not updated.assigned_at:
            updated.assigned_at = timezone.now()
            updates.append("assigned_at")
        if (
            updated.consent_to_share_with_ca
            and updated.assigned_to_email
            and updated.status in {"assigned", "contacted", "engaged", "resolved", "closed"}
            and not updated.shared_case_materials_at
        ):
            updated.shared_case_materials_at = timezone.now()
            updates.append("shared_case_materials_at")
        if old_status != updated.status:
            if updated.status == "contacted" and not updated.contacted_at:
                updated.contacted_at = timezone.now()
                updates.append("contacted_at")
            if updated.status == "engaged" and not updated.engaged_at:
                updated.engaged_at = timezone.now()
                updates.append("engaged_at")
            if updated.status in {"resolved", "closed"} and not updated.closed_at:
                updated.closed_at = timezone.now()
                updates.append("closed_at")
        if updates:
            updated.save(update_fields=updates)


class SuperAdminAssistedIntentViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AdminAssistedIntentSerializer
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_ops"
    queryset = AssistedIntent.objects.select_related("notice", "offer").all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "notice_code_snapshot",
        "email",
        "phone_number",
        "name",
        "experiment_key",
        "experiment_variant",
        "operator_notes",
    ]
    ordering_fields = ["created_at", "updated_at", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def perform_update(self, serializer):
        instance = serializer.instance
        old_status = instance.status
        updated = serializer.save()

        if old_status != updated.status:
            updates = []
            if updated.status == "contacted" and not updated.contacted_at:
                updated.contacted_at = timezone.now()
                updates.append("contacted_at")
            if updated.status in {"won", "lost", "closed"} and not updated.closed_at:
                updated.closed_at = timezone.now()
                updates.append("closed_at")
            if updates:
                updated.save(update_fields=updates)

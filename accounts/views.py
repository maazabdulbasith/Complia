from datetime import timedelta

from django.conf import settings
from django.db.models import Count
from django.utils import timezone
import requests
from rest_framework import filters, generics, mixins, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    AnalyticsEvent,
    AssistedOffer,
    AssistedIntent,
    CAHelpRequest,
    ExperimentExposure,
    User,
    WeeklyKpiSnapshot,
)
from .permissions import IsSuperAdmin
from .serializers import (
    AdminAssistedIntentSerializer,
    AdminCAHelpRequestSerializer,
    AnalyticsEventSerializer,
    AssistedOfferSerializer,
    AssistedIntentSerializer,
    CAHelpRequestSerializer,
    ExperimentExposureSerializer,
    UserDetailSerializer,
    WeeklyKpiSnapshotSerializer,
)


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
        serializer.save(user=user)


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
        updated = serializer.save()

        if old_status != updated.status:
            updates = []
            if updated.status == "contacted" and not updated.contacted_at:
                updated.contacted_at = timezone.now()
                updates.append("contacted_at")
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

from datetime import timedelta

from django.conf import settings
from django.db.models import Count
from django.utils import timezone
import requests
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.throttling import ScopedRateThrottle

from .models import AnalyticsEvent, User
from .serializers import AnalyticsEventSerializer, CAHelpRequestSerializer, UserDetailSerializer


class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_superuser or getattr(request.user, "user_type", "") == "admin")
        )


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


class SuperAdminMetricsView(generics.GenericAPIView):
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_metrics"

    def get(self, request):
        now = timezone.now()
        live_window_start = now - timedelta(minutes=2)

        total_visitors = (
            AnalyticsEvent.objects.values("session_id")
            .distinct()
            .count()
        )

        live_on_dashboard = (
            AnalyticsEvent.objects.filter(
                event_name="admin_dashboard_heartbeat",
                created_at__gte=live_window_start,
            )
            .values("session_id")
            .distinct()
            .count()
        )

        top_search = (
            AnalyticsEvent.objects.filter(event_name="notice_search")
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

        total_searches = AnalyticsEvent.objects.filter(event_name="notice_search").count()
        total_notice_views = AnalyticsEvent.objects.filter(event_name="notice_detail_viewed").count()
        total_ca_help_submissions = AnalyticsEvent.objects.filter(event_name="ca_help_submitted").count()

        return Response(
            {
                "total_visitors": total_visitors,
                "visitors_today": visitors_today,
                "live_on_dashboard": live_on_dashboard,
                "most_searched_notice": top_notice,
                "most_searched_notice_count": top_notice_count,
                "total_searches": total_searches,
                "total_notice_views": total_notice_views,
                "ca_help_submissions": total_ca_help_submissions,
            }
        )

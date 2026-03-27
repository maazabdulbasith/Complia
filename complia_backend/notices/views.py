from django.utils import timezone
from rest_framework import filters, mixins, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle

from accounts.permissions import IsSuperAdmin
from .models import NoticeFeedback, NoticeType, SavedNotice
from .serializers import AdminFeedbackSerializer, FeedbackSerializer, NoticeTypeSerializer, SavedNoticeSerializer


class NoticeTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only endpoint for listing/searching active notice types.

    Supports:
    - full-text search on code/title/summary/trigger keywords
    - severity filtering via `?severity=low|medium|high`
    - ordering on selected fields
    - global pagination from REST_FRAMEWORK settings
    """

    queryset = NoticeType.objects.filter(is_active=True).prefetch_related("triggers").order_by("code")
    serializer_class = NoticeTypeSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "title", "triggers__keyword", "summary"]
    ordering = ["code"]
    ordering_fields = ["code", "title", "updated_at", "severity"]
    lookup_field = "code"
    throttle_classes = [AnonRateThrottle, UserRateThrottle]

    def get_queryset(self):
        queryset = super().get_queryset()
        severity = self.request.query_params.get("severity")
        if severity in {"low", "medium", "high"}:
            queryset = queryset.filter(severity=severity)
        return queryset

class FeedbackViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    Write-only endpoint to capture anonymous feedback for a notice page.
    """

    queryset = NoticeFeedback.objects.all()
    serializer_class = FeedbackSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "feedback"
    permission_classes = [permissions.AllowAny]


class SavedNoticeViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Authenticated endpoint for a user's saved notices.
    """

    serializer_class = SavedNoticeSerializer
    throttle_classes = [AnonRateThrottle, UserRateThrottle]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SavedNotice.objects.filter(user=self.request.user).select_related("notice")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notice = serializer.validated_data["notice"]

        saved_notice, created = SavedNotice.objects.get_or_create(
            user=request.user,
            notice=notice,
        )
        output_serializer = self.get_serializer(saved_notice)
        response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(output_serializer.data, status=response_status)


class SuperAdminFeedbackViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AdminFeedbackSerializer
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_ops"
    queryset = NoticeFeedback.objects.select_related("notice").all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["notice__code", "notice__title", "comments", "internal_notes"]
    ordering_fields = ["created_at", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def perform_update(self, serializer):
        serializer.save(reviewed_at=timezone.now())

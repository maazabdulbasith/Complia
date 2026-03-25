from rest_framework import filters, mixins, viewsets
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from .models import NoticeType, NoticeFeedback
from .serializers import NoticeTypeSerializer, FeedbackSerializer


class NoticeTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only endpoint for listing/searching active notice types.

    Supports:
    - full-text search on code/title/summary/trigger keywords
    - ordering on selected fields
    - global pagination from REST_FRAMEWORK settings
    """

    queryset = NoticeType.objects.filter(is_active=True).prefetch_related("triggers").order_by("code")
    serializer_class = NoticeTypeSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["code", "title", "triggers__keyword", "summary"]
    ordering = ["code"]
    ordering_fields = ["code", "title", "updated_at", "severity"]
    lookup_field = "code"
    throttle_classes = [AnonRateThrottle, UserRateThrottle]


class FeedbackViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    Write-only endpoint to capture anonymous feedback for a notice page.
    """

    queryset = NoticeFeedback.objects.all()
    serializer_class = FeedbackSerializer
    throttle_classes = [AnonRateThrottle, UserRateThrottle]

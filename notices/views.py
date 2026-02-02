from rest_framework import viewsets, filters # type: ignore
from .models import NoticeType, NoticeFeedback
from .serializers import NoticeTypeSerializer, FeedbackSerializer

class NoticeTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows notices to be viewed or searched.
    Search by 'code' or 'triggers__keyword'.
    """
    queryset = NoticeType.objects.filter(is_active=True).order_by('code')
    serializer_class = NoticeTypeSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['code', 'title', 'triggers__keyword', 'summary']
    lookup_field = 'code'

class FeedbackViewSet(viewsets.GenericViewSet, viewsets.mixins.CreateModelMixin):
    """
    API endpoint to submit feedback (Is this helpful? Yes/No)
    """
    queryset = NoticeFeedback.objects.all()
    serializer_class = FeedbackSerializer

from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from notices.views import NoticeTypeViewSet, FeedbackViewSet

router = DefaultRouter()
router.register(r'notices', NoticeTypeViewSet)
router.register(r'feedback', FeedbackViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
]

from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from complia_backend.notices.views import FeedbackViewSet, NoticeTypeViewSet, SavedNoticeViewSet
from complia_backend.health import health_check, readiness_check
from accounts.views import AnalyticsEventCreateView, CAHelpRequestCreateView, GoogleLogin, SuperAdminMetricsView

# API v1 Router
router_v1 = routers.DefaultRouter()
router_v1.register(r'notices', NoticeTypeViewSet)
router_v1.register(r'feedback', FeedbackViewSet, basename='feedback')
router_v1.register(r'saved-notices', SavedNoticeViewSet, basename='saved-notice')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/health/', health_check, name='health-check'),
    path('api/v1/ready/', readiness_check, name='readiness-check'),
    
    # API v1 Namespace
    path('api/v1/', include([
        path('', include(router_v1.urls)),
        path('ca-help/', CAHelpRequestCreateView.as_view(), name='ca-help-create'),
        path('analytics/events/', AnalyticsEventCreateView.as_view(), name='analytics-event-create'),
        path('admin/metrics/', SuperAdminMetricsView.as_view(), name='superadmin-metrics'),
        
        # Authentication & Accounts
        path('auth/', include([
            path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
            path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
            path('google/', GoogleLogin.as_view(), name='google_login'),
            path('', include('dj_rest_auth.urls')),
            path('registration/', include('dj_rest_auth.registration.urls')),
        ])),
    ])),
]

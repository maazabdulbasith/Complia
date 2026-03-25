from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from complia_backend.notices.views import NoticeTypeViewSet, FeedbackViewSet
from accounts.views import GoogleLogin

# API v1 Router
router_v1 = routers.DefaultRouter()
router_v1.register(r'notices', NoticeTypeViewSet)
router_v1.register(r'feedback', FeedbackViewSet, basename='feedback')

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API v1 Namespace
    path('api/v1/', include([
        path('', include(router_v1.urls)),
        
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

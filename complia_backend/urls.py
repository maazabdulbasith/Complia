from django.urls import path, include
from rest_framework import routers
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from complia_backend.notices.views import (
    FeedbackViewSet,
    NoticeTypeViewSet,
    ParserResultDetailView,
    ParserUploadView,
    SavedNoticeViewSet,
    SuperAdminNoticeTypeViewSet,
    SuperAdminParserBenchmarkRunViewSet,
    SuperAdminParserJobViewSet,
    SuperAdminFeedbackViewSet,
)
from complia_backend.health import health_check, readiness_check
from complia_backend.seo import robots_txt, sitemap_xml
from accounts.views import (
    AssistedOfferConfigView,
    AssistedIntentCreateView,
    AdminCAPanelListView,
    AnalyticsEventCreateView,
    CashfreeWebhookView,
    CAHelpRequestCreateView,
    ExperimentExposureCreateView,
    GoogleLogin,
    MyEntitlementsView,
    MyCAHelpRequestListView,
    PaymentOrderCreateView,
    PaymentOrderGrantCreditsView,
    PaymentPlanListView,
    PaymentTestConfirmView,
    SuperAdminAssistedIntentViewSet,
    SuperAdminCAHelpRequestViewSet,
    SuperAdminCsvExportView,
    SuperAdminFunnelView,
    SuperAdminKpiView,
    SuperAdminMetricsView,
    SuperAdminPaymentOrderViewSet,
)

# API v1 Router
router_v1 = routers.DefaultRouter()
router_v1.register(r'notices', NoticeTypeViewSet)
router_v1.register(r'feedback', FeedbackViewSet, basename='feedback')
router_v1.register(r'saved-notices', SavedNoticeViewSet, basename='saved-notice')

admin_router_v1 = routers.DefaultRouter()
admin_router_v1.register(r'ca-requests', SuperAdminCAHelpRequestViewSet, basename='admin-ca-request')
admin_router_v1.register(r'feedback', SuperAdminFeedbackViewSet, basename='admin-feedback')
admin_router_v1.register(r'assisted-intents', SuperAdminAssistedIntentViewSet, basename='admin-assisted-intent')
admin_router_v1.register(r'notices', SuperAdminNoticeTypeViewSet, basename='admin-notice')
admin_router_v1.register(r'parser-jobs', SuperAdminParserJobViewSet, basename='admin-parser-job')
admin_router_v1.register(r'parser-benchmarks', SuperAdminParserBenchmarkRunViewSet, basename='admin-parser-benchmark')
admin_router_v1.register(r'payment-orders', SuperAdminPaymentOrderViewSet, basename='admin-payment-order')

urlpatterns = [
    path('robots.txt', robots_txt, name='robots-txt'),
    path('sitemap.xml', sitemap_xml, name='sitemap-xml'),
    path('api/v1/health/', health_check, name='health-check'),
    path('api/v1/ready/', readiness_check, name='readiness-check'),
    
    # API v1 Namespace
    path('api/v1/', include([
        path('', include(router_v1.urls)),
        path('ca-help/', CAHelpRequestCreateView.as_view(), name='ca-help-create'),
        path('ca-help/my/', MyCAHelpRequestListView.as_view(), name='ca-help-my-list'),
        path('assisted-offer/', AssistedOfferConfigView.as_view(), name='assisted-offer-config'),
        path('assisted-intent/', AssistedIntentCreateView.as_view(), name='assisted-intent-create'),
        path('payments/plans/', PaymentPlanListView.as_view(), name='payment-plans'),
        path('payments/orders/', PaymentOrderCreateView.as_view(), name='payment-orders-create'),
        path('admin/payments/<str:order_id>/grant-credits/', PaymentOrderGrantCreditsView.as_view(), name='admin-payment-grant-credits'),
        path('payments/test/confirm/', PaymentTestConfirmView.as_view(), name='payment-test-confirm'),
        path('payments/webhooks/cashfree/', CashfreeWebhookView.as_view(), name='payment-webhook-cashfree'),
        path('payments/me/entitlements/', MyEntitlementsView.as_view(), name='payment-me-entitlements'),
        path('experiments/exposure/', ExperimentExposureCreateView.as_view(), name='experiment-exposure-create'),
        path('parser/upload/', ParserUploadView.as_view(), name='parser-upload'),
        path('parser/results/<int:pk>/', ParserResultDetailView.as_view(), name='parser-result-detail'),
        path('analytics/events/', AnalyticsEventCreateView.as_view(), name='analytics-event-create'),
        path('admin/metrics/', SuperAdminMetricsView.as_view(), name='superadmin-metrics'),
        path('admin/funnel/', SuperAdminFunnelView.as_view(), name='superadmin-funnel'),
        path('admin/kpis/', SuperAdminKpiView.as_view(), name='superadmin-kpis'),
        path('admin/ca-panel/', AdminCAPanelListView.as_view(), name='admin-ca-panel'),
        path('admin/exports/<str:report_key>/', SuperAdminCsvExportView.as_view(), name='superadmin-export-csv'),
        path('admin/', include(admin_router_v1.urls)),
        
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

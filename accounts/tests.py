import hashlib
import hmac
import json
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import Mock, patch

from .models import (
    AnalyticsEvent,
    AssistedOffer,
    AssistedIntent,
    CAHelpRequest,
    ExperimentExposure,
    PaymentOrder,
    PaymentPlan,
    PaymentTransaction,
    User,
    UserEntitlement,
    WeeklyKpiSnapshot,
)


class UserModelTests(TestCase):
    def test_create_user_with_email(self):
        user = User.objects.create_user(email="user@complia.in", password="pass123456")
        self.assertEqual(user.email, "user@complia.in")
        self.assertTrue(user.check_password("pass123456"))
        self.assertEqual(user.user_type, "taxpayer")

    def test_create_superuser(self):
        admin = User.objects.create_superuser(email="admin@complia.in", password="pass123456")
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)
        self.assertEqual(admin.user_type, "admin")

    def test_create_user_without_email_raises(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(email="", password="pass123456")


class CAHelpRequestTests(APITestCase):
    def test_create_ca_help_request_anonymous(self):
        payload = {
            "notice_code": "GST-DRC-01",
            "name": "Ravi Kumar",
            "email": "ravi@example.com",
            "phone_number": "9876543210",
            "message": "Need help replying within deadline.",
        }
        response = self.client.post("/api/v1/ca-help/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "new")

    def test_create_ca_help_request_invalid_payload(self):
        response = self.client.post("/api/v1/ca-help/", {"email": "x@example.com"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["status"], "error")
        self.assertEqual(response.data["message"], "Validation failed.")
        self.assertIn("name", response.data["errors"])

    def test_create_ca_help_request_invalid_phone(self):
        payload = {
            "name": "Ravi Kumar",
            "email": "ravi@example.com",
            "phone_number": "abc123",
        }
        response = self.client.post("/api/v1/ca-help/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["status"], "error")
        self.assertIn("phone_number", response.data["errors"])


class AnalyticsTests(APITestCase):
    def test_create_analytics_event_anonymous(self):
        payload = {
            "event_name": "page_view",
            "path": "/",
            "session_id": "sess-12345678",
            "metadata": {"page": "home"},
        }
        response = self.client.post("/api/v1/analytics/events/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(AnalyticsEvent.objects.count(), 1)

    def test_create_analytics_event_requires_schema_for_search(self):
        payload = {
            "event_name": "search_performed",
            "path": "/",
            "session_id": "sess-12345678",
            "metadata": {"query": "DRC-01"},
        }
        response = self.client.post("/api/v1/analytics/events/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("metadata", response.data["errors"])

    def test_superadmin_metrics_requires_admin(self):
        user = User.objects.create_user(email="user@complia.in", password="pass123456", user_type="taxpayer")
        self.client.force_authenticate(user=user)
        response = self.client.get("/api/v1/admin/metrics/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superadmin_metrics_admin_access(self):
        admin = User.objects.create_user(email="admin@complia.in", password="pass123456", user_type="admin")
        AnalyticsEvent.objects.create(
            user=admin,
            event_name="notice_search",
            session_id="sess-a1b2c3d4",
            path="/",
            metadata={"query": "DRC-01"},
        )
        AnalyticsEvent.objects.create(
            user=admin,
            event_name="admin_dashboard_heartbeat",
            session_id="sess-a1b2c3d4",
            path="/superadmin",
            metadata={},
        )

        self.client.force_authenticate(user=admin)
        response = self.client.get("/api/v1/admin/metrics/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["most_searched_notice"], "DRC-01")
        self.assertGreaterEqual(response.data["total_visitors"], 1)
        self.assertGreaterEqual(response.data["live_visitors"], 1)


class GoogleLoginTests(APITestCase):
    @patch("accounts.views.requests.get")
    def test_google_login_success(self, mock_get):
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "email": "newuser@complia.in",
            "given_name": "New",
            "family_name": "User",
        }
        mock_get.return_value = mock_resp

        response = self.client.post("/api/v1/auth/google/", {"access_token": "token123"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["email"], "newuser@complia.in")

    def test_google_login_missing_access_token(self):
        response = self.client.post("/api/v1/auth/google/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(SUPERADMIN_EMAILS={"maazabdulbasith@gmail.com"})
    @patch("accounts.views.requests.get")
    def test_google_login_superadmin_auto_promote(self, mock_get):
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "email": "maazabdulbasith@gmail.com",
            "given_name": "Maaz",
            "family_name": "Abdul Basith",
        }
        mock_get.return_value = mock_resp

        response = self.client.post("/api/v1/auth/google/", {"access_token": "token123"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        user = User.objects.get(email="maazabdulbasith@gmail.com")
        self.assertEqual(user.user_type, "admin")
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)


class SuperAdminCARequestOpsTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email="admin@complia.in", password="pass123456", user_type="admin")
        self.user = User.objects.create_user(email="user@complia.in", password="pass123456", user_type="taxpayer")
        self.request_item = CAHelpRequest.objects.create(
            user=self.user,
            notice_code="GST-DRC-01",
            name="Ravi Kumar",
            email="ravi@example.com",
            phone_number="9876543210",
            message="Need urgent help",
            status="new",
        )

    def test_non_admin_cannot_list_ca_requests(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/v1/admin/ca-requests/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_list_and_update_ca_requests(self):
        self.client.force_authenticate(user=self.admin)
        list_response = self.client.get("/api/v1/admin/ca-requests/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 1)

        update_response = self.client.patch(
            f"/api/v1/admin/ca-requests/{self.request_item.id}/",
            {"status": "contacted", "priority": "high", "internal_notes": "Called customer"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.request_item.refresh_from_db()
        self.assertEqual(self.request_item.status, "contacted")
        self.assertEqual(self.request_item.priority, "high")
        self.assertEqual(self.request_item.internal_notes, "Called customer")
        self.assertIsNotNone(self.request_item.contacted_at)


class SuperAdminFunnelAndKpiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email="admin@complia.in", password="pass123456", user_type="admin")
        AnalyticsEvent.objects.create(
            user=self.admin,
            event_name="search_performed",
            session_id="sess-phase2a",
            path="/",
            metadata={"query": "DRC-01", "result_count": 4},
        )
        AnalyticsEvent.objects.create(
            user=self.admin,
            event_name="notice_opened",
            session_id="sess-phase2a",
            path="/notice/GST-DRC-01",
            metadata={"notice_code": "GST-DRC-01", "severity": "high"},
        )
        AnalyticsEvent.objects.create(
            user=self.admin,
            event_name="ca_help_submitted",
            session_id="sess-phase2a",
            path="/ca-help",
            metadata={"notice_code": "GST-DRC-01"},
        )

    def test_funnel_endpoint_admin_access(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v1/admin/funnel/?window=7d")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("steps", response.data)
        self.assertGreaterEqual(response.data["steps"]["search_performed"], 1)

    def test_funnel_endpoint_30d_window(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v1/admin/funnel/?window=30d")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["window"], "30d")

    def test_kpis_endpoint_generates_snapshot(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v1/admin/kpis/?window=7d")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("current", response.data)
        self.assertIn("weekly_snapshots", response.data)
        self.assertGreaterEqual(WeeklyKpiSnapshot.objects.count(), 1)


class AssistedIntentAndExperimentTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email="admin@complia.in", password="pass123456", user_type="admin")
        self.user = User.objects.create_user(email="user@complia.in", password="pass123456", user_type="taxpayer")

    def test_create_assisted_intent(self):
        offer = AssistedOffer.objects.create(
            key="assisted_offer_v1",
            name="Assisted Response Pack",
            target_severity="high",
            is_active=True,
        )
        payload = {
            "offer_key": "assisted_offer_v1",
            "name": "Ravi",
            "email": "ravi@example.com",
            "notice_code_snapshot": "GST-DRC-01",
            "severity_snapshot": "high",
            "source_path": "/notice/GST-DRC-01",
            "experiment_key": "assisted_offer_v1",
            "experiment_variant": "control",
            "metadata": {"source": "notice_detail"},
        }
        response = self.client.post("/api/v1/assisted-intent/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(AssistedIntent.objects.count(), 1)
        self.assertEqual(AssistedIntent.objects.first().offer_id, offer.id)

    def test_experiment_exposure_upsert(self):
        payload = {
            "session_id": "sess-phase2-exp",
            "experiment_key": "assisted_offer_v1",
            "variant": "control",
            "path": "/notice/GST-DRC-01",
            "metadata": {"severity": "high"},
        }
        first = self.client.post("/api/v1/experiments/exposure/", payload, format="json")
        second = self.client.post("/api/v1/experiments/exposure/", payload, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ExperimentExposure.objects.count(), 1)

    def test_superadmin_assisted_intent_update(self):
        intent = AssistedIntent.objects.create(
            name="Ravi",
            email="ravi@example.com",
            notice_code_snapshot="GST-DRC-01",
            severity_snapshot="high",
        )
        self.client.force_authenticate(user=self.admin)
        list_response = self.client.get("/api/v1/admin/assisted-intents/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 1)

        patch_response = self.client.patch(
            f"/api/v1/admin/assisted-intents/{intent.id}/",
            {"status": "contacted", "operator_notes": "Called and shared package details."},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        intent.refresh_from_db()
        self.assertEqual(intent.status, "contacted")
        self.assertIsNotNone(intent.contacted_at)

    @override_settings(ASSISTED_OFFER_ENABLED=False)
    def test_assisted_offer_config_disabled(self):
        response = self.client.get("/api/v1/assisted-offer/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["enabled"])
        self.assertIsNone(response.data["offer"])

    @override_settings(
        ASSISTED_OFFER_ENABLED=True,
        ASSISTED_OFFER_DEFAULT_KEY="assisted_response_pack_v1",
        ASSISTED_OFFER_TARGET_SEVERITY="high",
    )
    def test_assisted_offer_config_fallback_enabled(self):
        response = self.client.get("/api/v1/assisted-offer/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["enabled"])
        self.assertEqual(response.data["offer"]["key"], "assisted_response_pack_v1")


class PaymentsPhase3ATests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="payer@complia.in", password="pass123456")
        self.plan, _ = PaymentPlan.objects.get_or_create(
            key="single_use_notice_parse",
            defaults={
                "name": "Single Use Parse",
                "amount_paise": 900,
                "currency": "INR",
                "credits": 1,
                "is_active": True,
                "is_default": True,
            },
        )
        self.client.force_authenticate(user=self.user)

    def test_list_payment_plans(self):
        response = self.client.get("/api/v1/payments/plans/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_create_payment_order_invalid_plan(self):
        response = self.client.post("/api/v1/payments/orders/", {"plan_key": "invalid_key"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["status"], "error")

    @override_settings(CASHFREE_APP_ID="", CASHFREE_SECRET_KEY="", DEBUG=False)
    def test_create_payment_order_fails_when_provider_not_configured(self):
        response = self.client.post(
            "/api/v1/payments/orders/",
            {"plan_key": "single_use_notice_parse"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["code"], "payment_provider_not_configured")

    @override_settings(CASHFREE_APP_ID="cf_app_test", CASHFREE_SECRET_KEY="cf_secret_test")
    @patch("accounts.views.requests.post")
    def test_create_payment_order_success(self, mock_post):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "order_id": "cmp-provider-123",
            "payment_session_id": "session_123",
            "order_meta": {"payment_link": "https://payments.example/checkout"},
        }
        mock_post.return_value = mock_response

        response = self.client.post(
            "/api/v1/payments/orders/",
            {"plan_key": "single_use_notice_parse"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "payment_pending")
        self.assertEqual(response.data["payment_session_id"], "session_123")

    @override_settings(CASHFREE_WEBHOOK_SECRET="whsec_test")
    def test_cashfree_webhook_rejects_invalid_signature(self):
        payment_order = PaymentOrder.objects.create(
            user=self.user,
            plan=self.plan,
            order_id="cmp-webhook-001",
            provider="cashfree",
            amount_paise=900,
            currency="INR",
            credits=1,
            status="payment_pending",
        )
        payload = {
            "type": "PAYMENT_SUCCESS_WEBHOOK",
            "data": {
                "order": {"order_id": payment_order.order_id},
                "payment": {"cf_payment_id": "123", "payment_status": "SUCCESS"},
            },
        }
        response = self.client.post(
            "/api/v1/payments/webhooks/cashfree/",
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_WEBHOOK_SIGNATURE="invalid",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(CASHFREE_WEBHOOK_SECRET="whsec_test")
    def test_cashfree_webhook_idempotent_credit_grant(self):
        payment_order = PaymentOrder.objects.create(
            user=self.user,
            plan=self.plan,
            order_id="cmp-webhook-002",
            provider="cashfree",
            amount_paise=900,
            currency="INR",
            credits=1,
            status="payment_pending",
        )
        payload = {
            "type": "PAYMENT_SUCCESS_WEBHOOK",
            "data": {
                "order": {"order_id": payment_order.order_id},
                "payment": {"cf_payment_id": "cfpay_001", "payment_status": "SUCCESS"},
            },
        }
        payload_json = json.dumps(payload)
        signature = hmac.new(
            b"whsec_test",
            payload_json.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        first = self.client.post(
            "/api/v1/payments/webhooks/cashfree/",
            data=payload_json,
            content_type="application/json",
            HTTP_X_WEBHOOK_SIGNATURE=signature,
        )
        second = self.client.post(
            "/api/v1/payments/webhooks/cashfree/",
            data=payload_json,
            content_type="application/json",
            HTTP_X_WEBHOOK_SIGNATURE=signature,
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)

        entitlement = UserEntitlement.objects.get(user=self.user)
        self.assertEqual(entitlement.parser_credits, 1)
        self.assertEqual(entitlement.lifetime_purchased_credits, 1)
        self.assertEqual(PaymentTransaction.objects.count(), 1)

    def test_get_my_entitlements(self):
        UserEntitlement.objects.create(
            user=self.user,
            parser_credits=2,
            lifetime_purchased_credits=3,
            lifetime_consumed_credits=1,
        )
        response = self.client.get("/api/v1/payments/me/entitlements/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["parser_credits"], 2)

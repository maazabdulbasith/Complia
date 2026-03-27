from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import Mock, patch

from .models import AnalyticsEvent, User


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

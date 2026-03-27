from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from .models import User


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

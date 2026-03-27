from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .models import NoticeType, TriggerKeyword, NoticeFeedback
from accounts.models import User

class NoticeAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="tester@complia.in", password="testpass123")
        # Create a sample notice
        self.notice = NoticeType.objects.create(
            code="TEST-001",
            title="Test Notice Title",
            summary="Test Summary",
            detailed_explanation="Detailed Explanation",
            consequences_of_ignoring="Bad things",
            next_steps="Step 1, Step 2",
            severity="medium",
            is_active=True
        )
        # Create a trigger keyword
        TriggerKeyword.objects.create(
            notice_type=self.notice,
            keyword="scrutiny"
        )
        
        # Create an inactive notice
        self.inactive_notice = NoticeType.objects.create(
            code="HIDDEN-001",
            title="Hidden Notice",
            detailed_explanation="Explanation",
            consequences_of_ignoring="Bad things",
            next_steps="Step 1",
            is_active=False
        )

        self.high_severity_notice = NoticeType.objects.create(
            code="HIGH-001",
            title="High Severity Notice",
            detailed_explanation="Explanation",
            consequences_of_ignoring="Bad things",
            next_steps="Step 1",
            severity="high",
            is_active=True,
        )

    def test_list_notices(self):
        """Verify only active notices are listed."""
        url = reverse('noticetype-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Test pagination (two notices are active in setUp)
        self.assertEqual(response.data['count'], 2)
        result_codes = [row["code"] for row in response.data["results"]]
        self.assertIn("TEST-001", result_codes)
        self.assertIn("HIGH-001", result_codes)

    def test_search_notices_by_code(self):
        """Search by notice code."""
        url = reverse('noticetype-list')
        response = self.client.get(url, {'search': 'TEST-001'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['code'], "TEST-001")

    def test_filter_notices_by_severity(self):
        url = reverse("noticetype-list")
        response = self.client.get(url, {"severity": "high"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["code"], "HIGH-001")

    def test_search_notices_by_keyword(self):
        """Search by trigger keyword."""
        url = reverse('noticetype-list')
        response = self.client.get(url, {'search': 'scrutiny'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['code'], "TEST-001")

    def test_get_notice_detail(self):
        """Retrieve a specific notice by code."""
        url = reverse('noticetype-detail', kwargs={'code': 'TEST-001'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], "Test Notice Title")

    def test_submit_valid_feedback(self):
        """Submit helpful feedback."""
        url = reverse('feedback-list')
        data = {
            "notice": self.notice.id,
            "is_helpful": True
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(NoticeFeedback.objects.count(), 1)

    def test_submit_invalid_feedback(self):
        """Submit feedback without required fields."""
        url = reverse('feedback-list')
        data = {
            "is_helpful": True
            # Missing notice ID (required foreign key)
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["status"], "error")
        self.assertEqual(response.data["message"], "Validation failed.")
        self.assertIn("notice", response.data["errors"])

    def test_submit_negative_feedback_without_comments(self):
        url = reverse("feedback-list")
        data = {
            "notice": self.notice.id,
            "is_helpful": False,
            "comments": "",
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["status"], "error")
        self.assertIn("comments", response.data["errors"])

    def test_pagination(self):
        """Verify pagination works (set to 20 in settings)."""
        # Create 25 more notices
        for i in range(25):
            NoticeType.objects.create(
                code=f"PAG-{i}",
                title=f"Title {i}",
                detailed_explanation="...",
                consequences_of_ignoring="...",
                next_steps="...",
                is_active=True
            )
        
        url = reverse('noticetype-list')
        response = self.client.get(url)
        # 27 active notices total (2 from setUp + 25)
        self.assertEqual(response.data['count'], 27)
        # Should only return 20 per page (limit set in settings.py)
        self.assertEqual(len(response.data['results']), 20)
        self.assertIsNotNone(response.data['next'])

    def test_save_notice_requires_auth(self):
        url = reverse("saved-notice-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_save_notice_create_and_list(self):
        self.client.force_authenticate(user=self.user)

        create_url = reverse("saved-notice-list")
        create_response = self.client.post(create_url, {"notice_id": self.notice.id}, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        list_response = self.client.get(create_url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 1)
        self.assertEqual(list_response.data["results"][0]["notice"]["code"], self.notice.code)

    def test_save_notice_delete(self):
        self.client.force_authenticate(user=self.user)
        create_url = reverse("saved-notice-list")
        create_response = self.client.post(create_url, {"notice_id": self.notice.id}, format="json")
        saved_notice_id = create_response.data["id"]

        delete_url = reverse("saved-notice-detail", kwargs={"pk": saved_notice_id})
        delete_response = self.client.delete(delete_url)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_save_notice_duplicate_rejected(self):
        self.client.force_authenticate(user=self.user)
        create_url = reverse("saved-notice-list")
        first = self.client.post(create_url, {"notice_id": self.notice.id}, format="json")
        second = self.client.post(create_url, {"notice_id": self.notice.id}, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)

    def test_health_check_endpoint(self):
        response = self.client.get(reverse("health-check"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload["status"], "ok")

    def test_readiness_check_endpoint(self):
        response = self.client.get(reverse("readiness-check"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["checks"]["database"], "ok")

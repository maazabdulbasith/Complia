from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from .models import NoticeType, TriggerKeyword, NoticeFeedback

class NoticeAPITests(APITestCase):
    def setUp(self):
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

    def test_list_notices(self):
        """Verify only active notices are listed."""
        url = reverse('noticetype-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Test pagination (should be 1 because only one is active)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['code'], "TEST-001")

    def test_search_notices_by_code(self):
        """Search by notice code."""
        url = reverse('noticetype-list')
        response = self.client.get(url, {'search': 'TEST-001'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['code'], "TEST-001")

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
        url = reverse('noticefeedback-list')
        data = {
            "notice": self.notice.id,
            "is_helpful": True
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(NoticeFeedback.objects.count(), 1)

    def test_submit_invalid_feedback(self):
        """Submit feedback without required fields."""
        url = reverse('noticefeedback-list')
        data = {
            "is_helpful": True
            # Missing notice ID (required foreign key)
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

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
        # 26 active notices total (1 from setUp + 25)
        self.assertEqual(response.data['count'], 26)
        # Should only return 20 per page (limit set in settings.py)
        self.assertEqual(len(response.data['results']), 20)
        self.assertIsNotNone(response.data['next'])

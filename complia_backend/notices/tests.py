from rest_framework import status
from rest_framework.test import APITestCase

from .models import NoticeFeedback, NoticeType, TriggerKeyword


class NoticeAPITests(APITestCase):
    def setUp(self):
        self.notice = NoticeType.objects.create(
            code="GST-ASMT-10",
            title="Scrutiny of Returns",
            summary="Scrutiny notice for return discrepancies.",
            detailed_explanation="Detailed explanation for ASMT-10.",
            why_received="Mismatch in return filings.",
            common_mistakes="Ignoring the first notice.",
            consequences_of_ignoring="Demand order may follow.",
            next_steps="Reply with supporting details.",
            severity="medium",
            source_section="CGST Act Section 61",
            verified_by="QA",
            is_active=True,
        )
        TriggerKeyword.objects.create(notice_type=self.notice, keyword="ASMT 10")

        self.inactive_notice = NoticeType.objects.create(
            code="IT-148",
            title="Income Escaping Assessment",
            summary="Reassessment notice.",
            detailed_explanation="Detailed explanation for IT-148.",
            why_received="Possible undisclosed income.",
            common_mistakes="Ignoring it.",
            consequences_of_ignoring="Reassessment + penalty.",
            next_steps="Respond via e-filing portal.",
            severity="high",
            source_section="Income Tax Act Section 148",
            verified_by="QA",
            is_active=False,
        )

    def test_noticetype_model_creation(self):
        self.assertEqual(self.notice.code, "GST-ASMT-10")
        self.assertTrue(self.notice.is_active)

    def test_triggerkeyword_relationship(self):
        self.assertEqual(self.notice.triggers.count(), 1)
        self.assertEqual(self.notice.triggers.first().keyword, "ASMT 10")

    def test_search_api_returns_results(self):
        response = self.client.get("/api/notices/?search=ASMT")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["code"], "GST-ASMT-10")

    def test_search_api_no_results(self):
        response = self.client.get("/api/notices/?search=DOES-NOT-EXIST")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(len(response.data["results"]), 0)

    def test_notice_detail_by_code(self):
        response = self.client.get(f"/api/notices/{self.notice.code}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["code"], self.notice.code)

    def test_feedback_submission_valid(self):
        payload = {
            "notice": self.notice.id,
            "is_helpful": True,
            "comments": "Very clear explanation.",
        }
        response = self.client.post("/api/feedback/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(NoticeFeedback.objects.count(), 1)

    def test_feedback_submission_invalid_missing_fields(self):
        payload = {"comments": "Missing required fields"}
        response = self.client.post("/api/feedback/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("notice", response.data)
        self.assertIn("is_helpful", response.data)

    def test_pagination_works(self):
        # We already have one active notice, create enough to force multiple pages.
        for idx in range(1, 26):
            NoticeType.objects.create(
                code=f"GST-AUTO-{idx}",
                title=f"Auto Notice {idx}",
                summary="Auto-generated summary for pagination test.",
                detailed_explanation="Auto-generated detailed explanation.",
                why_received="Auto-generated reason.",
                common_mistakes="Auto-generated common mistake.",
                consequences_of_ignoring="Auto-generated consequence.",
                next_steps="Auto-generated next steps.",
                severity="low",
                source_section="Auto Section",
                verified_by="QA",
                is_active=True,
            )

        response = self.client.get("/api/notices/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("results", response.data)
        self.assertEqual(len(response.data["results"]), 20)
        self.assertGreater(response.data["count"], 20)

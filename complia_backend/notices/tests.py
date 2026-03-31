import json
import os
import tempfile
from datetime import timedelta

from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from .models import NoticeFeedback, NoticeType, ParserBenchmarkRun, ParserJob, TriggerKeyword
from accounts.models import User, UserEntitlement

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

    def test_robots_and_sitemap_routes(self):
        robots = self.client.get(reverse("robots-txt"))
        sitemap = self.client.get(reverse("sitemap-xml"))
        self.assertEqual(robots.status_code, status.HTTP_200_OK)
        self.assertEqual(sitemap.status_code, status.HTTP_200_OK)
        self.assertIn("Sitemap:", robots.content.decode())
        self.assertIn("<urlset", sitemap.content.decode())

    def test_readiness_check_endpoint(self):
        response = self.client.get(reverse("readiness-check"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["checks"]["database"], "ok")

    def test_superadmin_feedback_requires_admin(self):
        response = self.client.get("/api/v1/admin/feedback/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.force_authenticate(user=self.user)
        denied = self.client.get("/api/v1/admin/feedback/")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_superadmin_feedback_list_and_update(self):
        admin = User.objects.create_user(email="admin@complia.in", password="pass123456", user_type="admin")
        feedback = NoticeFeedback.objects.create(
            notice=self.notice,
            is_helpful=False,
            comments="Need clearer explanation.",
        )

        self.client.force_authenticate(user=admin)
        list_response = self.client.get("/api/v1/admin/feedback/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 1)

        update_response = self.client.patch(
            f"/api/v1/admin/feedback/{feedback.id}/",
            {"status": "reviewed", "internal_notes": "Updated notice wording."},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        feedback.refresh_from_db()
        self.assertEqual(feedback.status, "reviewed")
        self.assertEqual(feedback.internal_notes, "Updated notice wording.")
        self.assertIsNotNone(feedback.reviewed_at)

    def test_parser_upload_forbidden_when_private_beta_disabled(self):
        beta_user = User.objects.create_user(email="beta@complia.in", password="pass123456", user_type="taxpayer")
        self.client.force_authenticate(user=beta_user)
        upload = SimpleUploadedFile("notice.txt", b"Section 73 INR 12345", content_type="text/plain")
        response = self.client.post("/api/v1/parser/upload/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_parser_upload_admin_allowed_when_private_beta_disabled(self):
        admin = User.objects.create_user(
            email="admin-beta-off@complia.in",
            password="pass123456",
            user_type="admin",
            is_superuser=True,
            is_staff=True,
        )
        self.client.force_authenticate(user=admin)
        upload = SimpleUploadedFile(
            "GST-DRC-01-admin.txt",
            b"Demand notice under Section 73 with INR 1000.",
            content_type="text/plain",
        )
        response = self.client.post("/api/v1/parser/upload/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    @override_settings(PARSER_PRIVATE_BETA_ENABLED=True, PARSER_BETA_EMAILS={"beta@complia.in"})
    def test_parser_upload_and_result_flow(self):
        beta_user = User.objects.create_user(email="beta@complia.in", password="pass123456", user_type="taxpayer")
        UserEntitlement.objects.create(
            user=beta_user,
            parser_credits=1,
            lifetime_purchased_credits=1,
            lifetime_consumed_credits=0,
        )
        self.client.force_authenticate(user=beta_user)
        upload = SimpleUploadedFile(
            "GST-DRC-01-notice.txt",
            b"This is a demand notice. Section 73. INR 125000 due.",
            content_type="text/plain",
        )
        response = self.client.post("/api/v1/parser/upload/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("extraction", response.data)
        parser_job_id = response.data["id"]

        detail = self.client.get(f"/api/v1/parser/results/{parser_job_id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertIn("confidence", detail.data)
        entitlement = UserEntitlement.objects.get(user=beta_user)
        self.assertEqual(entitlement.parser_credits, 0)
        self.assertEqual(entitlement.lifetime_consumed_credits, 1)

    @override_settings(PARSER_PRIVATE_BETA_ENABLED=True, PARSER_BETA_EMAILS={"betaasmt@complia.in"})
    def test_parser_upload_extracts_notice_section_and_deadline_from_asmt_style_text(self):
        beta_user = User.objects.create_user(email="betaasmt@complia.in", password="pass123456", user_type="taxpayer")
        UserEntitlement.objects.create(
            user=beta_user,
            parser_credits=1,
            lifetime_purchased_credits=1,
            lifetime_consumed_credits=0,
        )
        NoticeType.objects.create(
            code="GST-ASMT-10",
            title="Scrutiny of Returns",
            summary="Scrutiny notice",
            detailed_explanation="Explanation",
            consequences_of_ignoring="Penalty",
            next_steps="Reply",
            severity="medium",
            is_active=True,
        )
        self.client.force_authenticate(user=beta_user)
        asmt_text = (
            "GST ASMT - 10 [See rule 99(1)]\n"
            "Notice for intimating discrepancies in the return after scrutiny.\n"
            "Section under which notice is issued: 61\n"
            "Date by which reply has to be submitted: 23/12/2024\n"
            "Type of Return: GSTR-3B\n"
        )
        upload = SimpleUploadedFile("ASMT10.txt", asmt_text.encode("utf-8"), content_type="text/plain")
        response = self.client.post("/api/v1/parser/upload/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["notice_code"], "GST-ASMT-10")
        self.assertEqual(response.data["extraction"]["legal_section"], "Section 61")
        self.assertEqual(response.data["extraction"]["deadline_date"], "2024-12-23")

    @override_settings(PARSER_PRIVATE_BETA_ENABLED=True, PARSER_BETA_EMAILS={"beta2@complia.in"})
    def test_parser_upload_returns_402_when_no_credits(self):
        beta_user = User.objects.create_user(email="beta2@complia.in", password="pass123456", user_type="taxpayer")
        self.client.force_authenticate(user=beta_user)
        upload = SimpleUploadedFile(
            "GST-DRC-01-notice.txt",
            b"This is a demand notice. Section 73. INR 125000 due.",
            content_type="text/plain",
        )
        response = self.client.post("/api/v1/parser/upload/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_402_PAYMENT_REQUIRED)
        self.assertEqual(response.data["code"], "PAYMENT_REQUIRED")

    @override_settings(PARSER_PRIVATE_BETA_ENABLED=True, PARSER_BETA_EMAILS={"beta3@complia.in"})
    def test_parser_upload_handles_oversized_amount_without_500(self):
        beta_user = User.objects.create_user(email="beta3@complia.in", password="pass123456", user_type="taxpayer")
        UserEntitlement.objects.create(
            user=beta_user,
            parser_credits=1,
            lifetime_purchased_credits=1,
            lifetime_consumed_credits=0,
        )
        self.client.force_authenticate(user=beta_user)
        upload = SimpleUploadedFile(
            "amount-overflow.txt",
            b"Notice text with Section 73 and INR 12345678901234567890.",
            content_type="text/plain",
        )
        response = self.client.post("/api/v1/parser/upload/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data["extraction"]["amount_claimed"])

    @override_settings(PARSER_PRIVATE_BETA_ENABLED=True, PARSER_BETA_EMAILS={"beta4@complia.in"})
    def test_parser_upload_handles_oversized_section_without_500(self):
        beta_user = User.objects.create_user(email="beta4@complia.in", password="pass123456", user_type="taxpayer")
        UserEntitlement.objects.create(
            user=beta_user,
            parser_credits=1,
            lifetime_purchased_credits=1,
            lifetime_consumed_credits=0,
        )
        self.client.force_authenticate(user=beta_user)
        large_section_token = "A" * 400
        upload = SimpleUploadedFile(
            "section-overflow.txt",
            f"Notice text with section {large_section_token}".encode("utf-8"),
            content_type="text/plain",
        )
        response = self.client.post("/api/v1/parser/upload/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertLessEqual(len(response.data["extraction"]["legal_section"] or ""), 120)

    @override_settings(PARSER_PRIVATE_BETA_ENABLED=True, PARSER_BETA_EMAILS={"beta5@complia.in"})
    def test_parser_upload_sanitizes_nul_bytes_for_text_payload(self):
        beta_user = User.objects.create_user(email="beta5@complia.in", password="pass123456", user_type="taxpayer")
        UserEntitlement.objects.create(
            user=beta_user,
            parser_credits=1,
            lifetime_purchased_credits=1,
            lifetime_consumed_credits=0,
        )
        self.client.force_authenticate(user=beta_user)
        text_with_nul_bytes = (
            b"\x00This notice under section sixty one requests a detailed response before deadline"
            b"\x00 amount INR 12345 and tax discrepancy explanation required immediately\x00"
        )
        upload = SimpleUploadedFile(
            "notice.txt",
            text_with_nul_bytes,
            content_type="text/plain",
        )
        response = self.client.post("/api/v1/parser/upload/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("\x00", response.data["extraction"]["raw_text_excerpt"])

    @override_settings(PARSER_PRIVATE_BETA_ENABLED=True, PARSER_BETA_EMAILS={"beta6@complia.in"})
    def test_parser_upload_unreadable_binary_returns_400_and_refunds_credit(self):
        beta_user = User.objects.create_user(email="beta6@complia.in", password="pass123456", user_type="taxpayer")
        UserEntitlement.objects.create(
            user=beta_user,
            parser_credits=1,
            lifetime_purchased_credits=1,
            lifetime_consumed_credits=0,
        )
        self.client.force_authenticate(user=beta_user)
        unreadable_binary = b"\x00\x01\x02\x03\xff\xd8\xff\xe0\x00\x10WEBP\x00\x00\x00\x01\x02\x03\x04"
        upload = SimpleUploadedFile("scan.jpg", unreadable_binary, content_type="image/jpeg")
        response = self.client.post("/api/v1/parser/upload/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Image/PDF parsing is not enabled yet", response.data["detail"])
        entitlement = UserEntitlement.objects.get(user=beta_user)
        self.assertEqual(entitlement.parser_credits, 1)
        self.assertEqual(entitlement.lifetime_consumed_credits, 0)

    @override_settings(PARSER_PRIVATE_BETA_ENABLED=True, PARSER_BETA_EMAILS={"beta7@complia.in"})
    def test_parser_upload_image_rejected_even_if_decodable(self):
        beta_user = User.objects.create_user(email="beta7@complia.in", password="pass123456", user_type="taxpayer")
        UserEntitlement.objects.create(
            user=beta_user,
            parser_credits=1,
            lifetime_purchased_credits=1,
            lifetime_consumed_credits=0,
        )
        self.client.force_authenticate(user=beta_user)
        image_like_with_ascii = b"RIFFWEBPVP8 this looks decodable but is still an image payload"
        upload = SimpleUploadedFile("scan.webp", image_like_with_ascii, content_type="image/webp")
        response = self.client.post("/api/v1/parser/upload/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Image/PDF parsing is not enabled yet", response.data["detail"])
        entitlement = UserEntitlement.objects.get(user=beta_user)
        self.assertEqual(entitlement.parser_credits, 1)
        self.assertEqual(entitlement.lifetime_consumed_credits, 0)

    @override_settings(PARSER_PRIVATE_BETA_ENABLED=True)
    def test_superadmin_parser_review_update(self):
        admin = User.objects.create_user(email="admin@complia.in", password="pass123456", user_type="admin")
        parser_job = ParserJob.objects.create(
            user=admin,
            notice=self.notice,
            original_filename="mock.txt",
            status="review_required",
            confidence=0.4,
            is_private_beta=True,
            delete_after=self.notice.updated_at,
        )
        self.client.force_authenticate(user=admin)
        list_response = self.client.get("/api/v1/admin/parser-jobs/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 1)

        patch_response = self.client.patch(
            f"/api/v1/admin/parser-jobs/{parser_job.id}/",
            {"status": "completed", "review_notes": "Approved by reviewer."},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        parser_job.refresh_from_db()
        self.assertEqual(parser_job.status, "completed")

    def test_superadmin_parser_benchmark_list(self):
        admin = User.objects.create_user(email="admin2@complia.in", password="pass123456", user_type="admin")
        ParserBenchmarkRun.objects.create(
            sample_count=10,
            notice_precision=0.7,
            notice_recall=0.8,
            section_precision=0.6,
            section_recall=0.7,
            amount_precision=0.5,
            amount_recall=0.6,
            overall_f1=0.66,
            metrics={"note": "test"},
            generated_by=admin,
        )

        self.client.force_authenticate(user=admin)
        response = self.client.get("/api/v1/admin/parser-benchmarks/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_cleanup_expired_parser_jobs_command(self):
        admin = User.objects.create_user(email="cleanup@complia.in", password="pass123456", user_type="admin")
        ParserJob.objects.create(
            user=admin,
            notice=self.notice,
            original_filename="expired.txt",
            status="completed",
            confidence=0.8,
            is_private_beta=True,
            delete_after=timezone.now() - timedelta(hours=2),
            processed_at=timezone.now(),
        )
        ParserJob.objects.create(
            user=admin,
            notice=self.notice,
            original_filename="active.txt",
            status="completed",
            confidence=0.8,
            is_private_beta=True,
            delete_after=timezone.now() + timedelta(hours=2),
            processed_at=timezone.now(),
        )

        call_command("cleanup_expired_parser_jobs")
        self.assertEqual(ParserJob.objects.count(), 1)
        self.assertEqual(ParserJob.objects.first().original_filename, "active.txt")

    def test_run_parser_benchmark_command_stores_run(self):
        sample_payload = [
            {
                "filename": "GST-DRC-01-test.txt",
                "text": "GST-DRC-01 under Section 73 for INR 1000.",
                "expected_notice_code": "GST-DRC-01",
                "expected_legal_section": "Section 73",
                "expected_amount": "1000",
            }
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as tmp:
            json.dump(sample_payload, tmp)
            tmp_path = tmp.name

        try:
            call_command("run_parser_benchmark", "--dataset", tmp_path)
            self.assertEqual(ParserBenchmarkRun.objects.count(), 1)
            self.assertEqual(ParserBenchmarkRun.objects.first().sample_count, 1)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def test_ensure_notice_baseline_command(self):
        call_command("ensure_notice_baseline", "--target", "30", "--verified-by", "QA Team")
        self.assertGreaterEqual(NoticeType.objects.filter(is_active=True).count(), 30)
        self.assertGreaterEqual(NoticeType.objects.filter(is_active=True, verified_at__isnull=False).count(), 30)

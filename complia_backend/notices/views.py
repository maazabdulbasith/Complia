import os
import string
import tempfile
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import filters, generics, mixins, permissions, status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from accounts.models import AnalyticsEvent, UserEntitlement
from accounts.permissions import IsParserBetaUser, IsSuperAdmin
from .models import NoticeFeedback, NoticeType, ParserBenchmarkRun, ParserExtraction, ParserJob, SavedNotice
from .ocr_utils import OCRProcessingError, extract_text_from_binary_document, sanitize_ocr_text
from .parser_utils import parse_notice_document
from .serializers import (
    AdminFeedbackSerializer,
    AdminNoticeTypeSerializer,
    AdminParserBenchmarkRunSerializer,
    AdminParserJobSerializer,
    FeedbackSerializer,
    NoticeTypeSerializer,
    ParserJobSerializer,
    ParserUploadSerializer,
    SavedNoticeSerializer,
)

class NoticeTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only endpoint for listing/searching active notice types.

    Supports:
    - full-text search on code/title/summary/trigger keywords
    - severity filtering via `?severity=low|medium|high`
    - ordering on selected fields
    - global pagination from REST_FRAMEWORK settings
    """

    queryset = NoticeType.objects.filter(is_active=True).prefetch_related("triggers").order_by("code")
    serializer_class = NoticeTypeSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "slug", "title", "triggers__keyword", "summary"]
    ordering = ["code"]
    ordering_fields = ["code", "title", "updated_at", "severity"]
    lookup_field = "code"
    throttle_classes = [AnonRateThrottle, UserRateThrottle]

    def get_queryset(self):
        queryset = super().get_queryset()
        severity = self.request.query_params.get("severity")
        if severity in {"low", "medium", "high"}:
            queryset = queryset.filter(severity=severity)
        return queryset


class FeedbackViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    Write-only endpoint to capture anonymous feedback for a notice page.
    """

    queryset = NoticeFeedback.objects.all()
    serializer_class = FeedbackSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "feedback"
    permission_classes = [permissions.AllowAny]


class SavedNoticeViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Authenticated endpoint for a user's saved notices.
    """

    serializer_class = SavedNoticeSerializer
    throttle_classes = [AnonRateThrottle, UserRateThrottle]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SavedNotice.objects.filter(user=self.request.user).select_related("notice")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notice = serializer.validated_data["notice"]

        saved_notice, created = SavedNotice.objects.get_or_create(
            user=request.user,
            notice=notice,
        )
        output_serializer = self.get_serializer(saved_notice)
        response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(output_serializer.data, status=response_status)


class SuperAdminFeedbackViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AdminFeedbackSerializer
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_ops"
    queryset = NoticeFeedback.objects.select_related("notice").all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["notice__code", "notice__title", "comments", "internal_notes"]
    ordering_fields = ["created_at", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def perform_update(self, serializer):
        serializer.save(reviewed_at=timezone.now(), reviewed_by=self.request.user)


class SuperAdminNoticeTypeViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AdminNoticeTypeSerializer
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_ops"
    queryset = NoticeType.objects.prefetch_related("triggers").all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "title", "slug", "verified_by", "meta_title", "meta_description"]
    ordering_fields = ["updated_at", "verified_at", "severity", "code"]
    ordering = ["code"]

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter == "stale":
            stale_cutoff = timezone.now() - timedelta(days=90)
            queryset = queryset.filter(verified_at__lt=stale_cutoff)
        if status_filter == "unverified":
            queryset = queryset.filter(verified_at__isnull=True)
        return queryset


class ParserUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsParserBetaUser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "parser_upload"
    parser_classes = [MultiPartParser, FormParser]

    @staticmethod
    def _looks_like_readable_text(raw_text: str) -> bool:
        compact = "".join(ch for ch in raw_text if not ch.isspace())
        if len(compact) < 30:
            return False
        alpha_count = sum(ch.isalpha() for ch in compact)
        alpha_ratio = alpha_count / max(len(compact), 1)
        printable_count = sum(ch in string.printable for ch in raw_text)
        printable_ratio = printable_count / max(len(raw_text), 1)
        return alpha_count >= 30 and alpha_ratio >= 0.2 and printable_ratio >= 0.7

    def post(self, request):
        is_admin_bypass = request.user.is_superuser or getattr(request.user, "user_type", "") == "admin"

        serializer = ParserUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        upload = serializer.validated_data["file"]
        max_size_bytes = settings.PARSER_MAX_UPLOAD_MB * 1024 * 1024
        if upload.size > max_size_bytes:
            return Response({"detail": "Uploaded file exceeds size limit."}, status=status.HTTP_400_BAD_REQUEST)

        credit_reserved = False
        if not is_admin_bypass:
            with transaction.atomic():
                entitlement, _ = UserEntitlement.objects.select_for_update().get_or_create(
                    user=request.user,
                    defaults={
                        "parser_credits": 0,
                        "lifetime_purchased_credits": 0,
                        "lifetime_consumed_credits": 0,
                    },
                )
                if entitlement.parser_credits < 1:
                    return Response(
                        {
                            "status": "error",
                            "message": "Payment required before parser upload.",
                            "code": "PAYMENT_REQUIRED",
                            "credits": entitlement.parser_credits,
                        },
                        status=status.HTTP_402_PAYMENT_REQUIRED,
                    )
                entitlement.parser_credits -= 1
                entitlement.lifetime_consumed_credits += 1
                entitlement.save(
                    update_fields=[
                        "parser_credits",
                        "lifetime_consumed_credits",
                        "updated_at",
                    ]
                )
                credit_reserved = True

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(upload.name)[1]) as tmp:
                for chunk in upload.chunks():
                    tmp.write(chunk)
                temp_path = tmp.name

            with open(temp_path, "rb") as temp_file:
                raw_bytes = temp_file.read()

            mime_type = (getattr(upload, "content_type", "") or "").lower()
            file_name = (upload.name or "").lower()
            is_binary_doc = mime_type.startswith("image/") or mime_type == "application/pdf" or file_name.endswith(".pdf")
            ocr_metadata = {
                "ocr_engine": "none",
                "ocr_pages_processed": 0,
                "ocr_used": False,
                "ocr_text_chars": 0,
            }
            if is_binary_doc:
                raw_text, ocr_metadata = extract_text_from_binary_document(
                    raw_bytes=raw_bytes,
                    mime_type=mime_type,
                    filename=upload.name,
                )
            else:
                raw_text = raw_bytes[:60000].decode("utf-8", errors="ignore")
                raw_text = sanitize_ocr_text(raw_text)
                ocr_metadata["ocr_text_chars"] = len("".join(ch for ch in raw_text if not ch.isspace()))
            if not self._looks_like_readable_text(raw_text):
                raise ValueError(
                    "Could not extract readable text from this file. Please upload a clearer scan or .txt file."
                )
            notice_code = serializer.validated_data.get("notice_code", "").strip()
            parsed = parse_notice_document(raw_text, upload.name, notice_code)
            deadline_date = parsed["deadline_date"]
            legal_section = parsed["legal_section"]
            amount_claimed = parsed["amount_claimed"]
            notice = parsed["notice"]
            confidence = parsed["confidence"]

            now = timezone.now()
            requires_review = confidence < settings.PARSER_REVIEW_THRESHOLD
            parser_job = ParserJob.objects.create(
                user=request.user,
                notice=notice,
                original_filename=upload.name,
                mime_type=mime_type,
                status="review_required" if requires_review else "completed",
                confidence=confidence,
                is_private_beta=True,
                delete_after=now + timedelta(hours=settings.PARSER_EPHEMERAL_TTL_HOURS),
                processed_at=now,
            )

            payload = {
                "notice_code_detected": notice.code if notice else "",
                "deadline_date": deadline_date.isoformat() if deadline_date else "",
                "legal_section": legal_section,
                "amount_claimed": str(amount_claimed) if amount_claimed is not None else "",
                "confidence": confidence,
                "ocr_engine": ocr_metadata["ocr_engine"],
                "ocr_pages_processed": ocr_metadata["ocr_pages_processed"],
                "ocr_used": ocr_metadata["ocr_used"],
                "ocr_text_chars": ocr_metadata["ocr_text_chars"],
            }

            ParserExtraction.objects.create(
                parser_job=parser_job,
                deadline_date=deadline_date,
                legal_section=legal_section,
                amount_claimed=amount_claimed,
                notice_type_detected=(notice.title if notice else "Unknown")[:120],
                confidence=confidence,
                normalized_payload=payload,
                raw_text_excerpt=raw_text[:1200],
                review_status="pending" if requires_review else "approved",
            )

            if credit_reserved:
                AnalyticsEvent.objects.create(
                    user=request.user,
                    session_id=f"parser-{parser_job.id}",
                    event_name="credit_consumed",
                    path="/parser/upload",
                    metadata={"parser_job_id": parser_job.id, "credits_used": 1},
                )

            return Response(ParserJobSerializer(parser_job).data, status=status.HTTP_201_CREATED)
        except Exception as exc:
            if credit_reserved:
                with transaction.atomic():
                    entitlement, _ = UserEntitlement.objects.select_for_update().get_or_create(
                        user=request.user,
                        defaults={
                            "parser_credits": 0,
                            "lifetime_purchased_credits": 0,
                            "lifetime_consumed_credits": 0,
                        },
                    )
                    entitlement.parser_credits += 1
                    if entitlement.lifetime_consumed_credits > 0:
                        entitlement.lifetime_consumed_credits -= 1
                    entitlement.save(
                        update_fields=[
                            "parser_credits",
                            "lifetime_consumed_credits",
                            "updated_at",
                        ]
                    )
            if isinstance(exc, (ValueError, OCRProcessingError)):
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            raise
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)


class ParserResultDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ParserJobSerializer

    def get_queryset(self):
        queryset = ParserJob.objects.select_related("notice", "extraction")
        user = self.request.user
        if user.is_superuser or getattr(user, "user_type", "") == "admin":
            return queryset
        return queryset.filter(user=user)


class SuperAdminParserJobViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AdminParserJobSerializer
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_ops"
    queryset = ParserJob.objects.select_related("notice", "extraction").all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["original_filename", "notice__code", "notice__title", "review_notes"]
    ordering_fields = ["created_at", "updated_at", "status", "confidence"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def perform_update(self, serializer):
        updated = serializer.save(reviewed_by=self.request.user, reviewed_at=timezone.now())
        extraction_status = self.request.data.get("extraction_review_status")
        if extraction_status in {"pending", "approved", "rejected"} and hasattr(updated, "extraction"):
            extraction = updated.extraction
            extraction.review_status = extraction_status
            extraction.reviewed_at = timezone.now()
            extraction.reviewed_by = self.request.user
            extraction.save(update_fields=["review_status", "reviewed_at", "reviewed_by"])

        if updated.status in {"completed", "failed"} and not updated.processed_at:
            updated.processed_at = timezone.now()
            updated.save(update_fields=["processed_at"])


class SuperAdminParserBenchmarkRunViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = AdminParserBenchmarkRunSerializer
    permission_classes = [IsSuperAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin_ops"
    queryset = ParserBenchmarkRun.objects.all()
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_at", "overall_f1", "sample_count"]
    ordering = ["-created_at"]

from django.utils import timezone
from rest_framework import serializers

from .models import (
    NoticeFeedback,
    NoticeType,
    ParserBenchmarkRun,
    ParserExtraction,
    ParserJob,
    SavedNotice,
    TriggerKeyword,
)


class TriggerKeywordSerializer(serializers.ModelSerializer):
    class Meta:
        model = TriggerKeyword
        fields = ["keyword"]


class NoticeTypeSerializer(serializers.ModelSerializer):
    triggers = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = NoticeType
        fields = [
            "id",
            "code",
            "slug",
            "title",
            "summary",
            "detailed_explanation",
            "why_received",
            "common_mistakes",
            "source_section",
            "consequences_of_ignoring",
            "next_steps",
            "severity",
            "triggers",
            "verified_by",
            "verified_at",
            "meta_title",
            "meta_description",
            "updated_at",
        ]


class AdminNoticeTypeSerializer(serializers.ModelSerializer):
    trigger_keywords = serializers.SerializerMethodField()
    is_stale = serializers.SerializerMethodField()

    class Meta:
        model = NoticeType
        fields = [
            "id",
            "code",
            "slug",
            "title",
            "severity",
            "is_active",
            "verified_by",
            "verified_at",
            "meta_title",
            "meta_description",
            "updated_at",
            "is_stale",
            "trigger_keywords",
        ]
        read_only_fields = ["id", "code", "updated_at", "is_stale", "trigger_keywords"]

    def get_trigger_keywords(self, obj):
        return list(obj.triggers.values_list("keyword", flat=True))

    def get_is_stale(self, obj):
        if not obj.verified_at:
            return True
        age_days = (timezone.now() - obj.verified_at).days
        return age_days > 90


class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoticeFeedback
        fields = ["notice", "is_helpful", "comments", "created_at"]
    def validate(self, attrs):
        is_helpful = attrs.get("is_helpful")
        comments = (attrs.get("comments") or "").strip()

        if is_helpful is False and not comments:
            raise serializers.ValidationError(
                {"comments": ["Please tell us what was unclear!"]}
            )

        return attrs


class AdminFeedbackSerializer(serializers.ModelSerializer):
    notice_code = serializers.CharField(source="notice.code", read_only=True)
    notice_title = serializers.CharField(source="notice.title", read_only=True)

    class Meta:
        model = NoticeFeedback
        fields = [
            "id",
            "notice",
            "notice_code",
            "notice_title",
            "is_helpful",
            "comments",
            "status",
            "internal_notes",
            "reviewed_at",
            "created_at",
        ]
        read_only_fields = ["id", "notice", "notice_code", "notice_title", "reviewed_at", "created_at"]


class SavedNoticeSerializer(serializers.ModelSerializer):
    notice = NoticeTypeSerializer(read_only=True)
    notice_id = serializers.PrimaryKeyRelatedField(
        queryset=NoticeType.objects.filter(is_active=True),
        source="notice",
        write_only=True,
    )

    class Meta:
        model = SavedNotice
        fields = ["id", "notice", "notice_id", "created_at"]


class ParserUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    notice_code = serializers.CharField(max_length=80, required=False, allow_blank=True)


class ParserExtractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParserExtraction
        fields = [
            "id",
            "deadline_date",
            "legal_section",
            "amount_claimed",
            "notice_type_detected",
            "confidence",
            "normalized_payload",
            "raw_text_excerpt",
            "review_status",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]


class ParserJobSerializer(serializers.ModelSerializer):
    extraction = ParserExtractionSerializer(read_only=True)
    notice_code = serializers.CharField(source="notice.code", read_only=True)

    class Meta:
        model = ParserJob
        fields = [
            "id",
            "notice",
            "notice_code",
            "original_filename",
            "mime_type",
            "status",
            "confidence",
            "is_private_beta",
            "delete_after",
            "processed_at",
            "error_message",
            "review_notes",
            "reviewed_at",
            "created_at",
            "updated_at",
            "extraction",
        ]
        read_only_fields = [
            "id",
            "notice",
            "notice_code",
            "original_filename",
            "mime_type",
            "status",
            "confidence",
            "is_private_beta",
            "delete_after",
            "processed_at",
            "error_message",
            "reviewed_at",
            "created_at",
            "updated_at",
            "extraction",
        ]


class AdminParserJobSerializer(serializers.ModelSerializer):
    extraction = ParserExtractionSerializer(read_only=True)
    notice_code = serializers.CharField(source="notice.code", read_only=True)

    class Meta:
        model = ParserJob
        fields = [
            "id",
            "notice",
            "notice_code",
            "original_filename",
            "status",
            "confidence",
            "review_notes",
            "reviewed_at",
            "created_at",
            "updated_at",
            "extraction",
        ]
        read_only_fields = ["id", "notice", "notice_code", "original_filename", "confidence", "created_at", "updated_at", "extraction"]


class AdminParserBenchmarkRunSerializer(serializers.ModelSerializer):
    generated_by_email = serializers.CharField(source="generated_by.email", read_only=True)

    class Meta:
        model = ParserBenchmarkRun
        fields = [
            "id",
            "sample_count",
            "notice_precision",
            "notice_recall",
            "section_precision",
            "section_recall",
            "amount_precision",
            "amount_recall",
            "overall_f1",
            "metrics",
            "generated_by",
            "generated_by_email",
            "created_at",
        ]
        read_only_fields = fields
=======
        fields = ['notice', 'is_helpful', 'comments', 'created_at']
    def validate(self, data):
        if data.get('is_helpful') == False and not data.get('comments', '').strip():
            raise serializers.ValidationError({
                'comments': 'Comments are required when feedback is not helpful.'
            })
        return data    
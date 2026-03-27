from rest_framework import serializers
from .models import NoticeType, NoticeFeedback, SavedNotice, TriggerKeyword

class TriggerKeywordSerializer(serializers.ModelSerializer):
    class Meta:
        model = TriggerKeyword
        fields = ['keyword']

class NoticeTypeSerializer(serializers.ModelSerializer):
    triggers = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = NoticeType
        fields = [
            'id', 'code', 'title', 'summary', 'detailed_explanation',
            'why_received', 'common_mistakes', 'source_section',
            'consequences_of_ignoring', 'next_steps', 'severity',
            'triggers', 'verified_by', 'verified_at', 'updated_at'
        ]

class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoticeFeedback
        fields = ['notice', 'is_helpful', 'comments', 'created_at']

    def validate(self, attrs):
        is_helpful = attrs.get("is_helpful")
        comments = (attrs.get("comments") or "").strip()

        if is_helpful is False and not comments:
            raise serializers.ValidationError(
                {"comments": ["Please tell us what was unclear."]}
            )

        return attrs


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

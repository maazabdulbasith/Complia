from rest_framework import serializers
from .models import AnalyticsEvent, CAHelpRequest, User


class UserDetailSerializer(serializers.ModelSerializer):
    """
    Serializes the Custom User model for standard API responses.
    Included in dj-rest-auth calls for profile/login.
    """
    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'first_name',
            'last_name',
            'user_type',
            'phone_number',
            'is_verified_ca'
        )
        read_only_fields = ('email', 'is_verified_ca')


class CAHelpRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = CAHelpRequest
        fields = [
            "id",
            "notice_code",
            "name",
            "email",
            "phone_number",
            "message",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]

    def validate_name(self, value):
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise serializers.ValidationError("Name must contain at least 2 characters.")
        return cleaned

    def validate_phone_number(self, value):
        cleaned = value.strip()
        if not cleaned:
            return cleaned

        normalized = cleaned.replace(" ", "").replace("-", "")
        if normalized.startswith("+"):
            normalized = normalized[1:]

        if not normalized.isdigit() or not 10 <= len(normalized) <= 15:
            raise serializers.ValidationError("Phone number must be 10 to 15 digits.")
        return cleaned


class AnalyticsEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalyticsEvent
        fields = [
            "event_name",
            "path",
            "metadata",
            "session_id",
        ]

    def validate_session_id(self, value):
        cleaned = value.strip()
        if len(cleaned) < 8:
            raise serializers.ValidationError("Invalid session id.")
        return cleaned

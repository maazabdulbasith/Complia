from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .models import (
    AnalyticsEvent,
    AssistedOffer,
    AssistedIntent,
    CAPanelProfile,
    CAHelpRequest,
    ExperimentExposure,
    PaymentOrder,
    PaymentPlan,
    User,
    UserEntitlement,
    WeeklyKpiSnapshot,
)


class UserDetailSerializer(serializers.ModelSerializer):
    """
    Serializes the Custom User model for standard API responses.
    Included in dj-rest-auth calls for profile/login.
    """

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "user_type",
            "phone_number",
            "is_verified_ca",
        )
        read_only_fields = ("email", "is_verified_ca")


class CAHelpRequestSerializer(serializers.ModelSerializer):
    assigned_ca = serializers.IntegerField(source="assigned_ca.id", read_only=True)
    assigned_ca_name = serializers.CharField(source="assigned_ca.display_name", read_only=True)

    class Meta:
        model = CAHelpRequest
        fields = [
            "id",
            "notice_code",
            "name",
            "email",
            "phone_number",
            "message",
            "consent_to_share_with_ca",
            "consent_recorded_at",
            "status",
            "priority",
            "assigned_ca",
            "assigned_ca_name",
            "assigned_to_email",
            "assigned_at",
            "shared_case_materials_at",
            "internal_notes",
            "contacted_at",
            "engaged_at",
            "closed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "consent_recorded_at",
            "status",
            "priority",
            "assigned_to_email",
            "assigned_at",
            "shared_case_materials_at",
            "internal_notes",
            "contacted_at",
            "engaged_at",
            "closed_at",
            "created_at",
            "updated_at",
        ]

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

    def validate_notice_code(self, value):
        return (value or "").strip()

    def validate_message(self, value):
        return (value or "").strip()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if not attrs.get("consent_to_share_with_ca"):
            raise serializers.ValidationError(
                {
                    "consent_to_share_with_ca": [
                        "Please confirm that Complia may share this case with one assigned CA."
                    ]
                }
            )
        return attrs


class AnalyticsEventSerializer(serializers.ModelSerializer):
    EVENT_ALIASES = {
        "notice_search": "search_performed",
        "notice_detail_viewed": "notice_opened",
    }

    REQUIRED_METADATA_KEYS = {
        "search_performed": ("query", "result_count"),
        "notice_opened": ("notice_code", "severity"),
        "ca_help_started": ("notice_code",),
        "ca_help_submitted": ("notice_code",),
        "assisted_offer_seen": ("notice_code", "offer_key", "variant"),
        "assisted_offer_clicked": ("notice_code", "offer_key", "variant"),
    }

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

    def validate(self, attrs):
        original_event_name = attrs.get("event_name")
        canonical_event_name = self.EVENT_ALIASES.get(original_event_name, original_event_name)
        attrs["event_name"] = canonical_event_name

        metadata = attrs.get("metadata") or {}
        required_keys = self.REQUIRED_METADATA_KEYS.get(canonical_event_name, ())
        missing = [
            key
            for key in required_keys
            if metadata.get(key) in (None, "")
        ]
        if missing:
            raise serializers.ValidationError(
                {
                    "metadata": [
                        f"Missing required keys for '{canonical_event_name}': {', '.join(missing)}"
                    ]
                }
            )

        return attrs


class AdminCAHelpRequestSerializer(serializers.ModelSerializer):
    assigned_ca_name = serializers.CharField(source="assigned_ca.display_name", read_only=True)

    class Meta:
        model = CAHelpRequest
        fields = [
            "id",
            "notice_code",
            "name",
            "email",
            "phone_number",
            "message",
            "consent_to_share_with_ca",
            "consent_recorded_at",
            "status",
            "priority",
            "assigned_ca",
            "assigned_ca_name",
            "assigned_to_email",
            "assigned_at",
            "shared_case_materials_at",
            "internal_notes",
            "contacted_at",
            "engaged_at",
            "closed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class CAPanelProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CAPanelProfile
        fields = [
            "id",
            "display_name",
            "email",
            "phone_number",
            "icai_membership_number",
            "city",
            "specialties",
            "turnaround_sla_hours",
            "is_active",
        ]
        read_only_fields = fields


class AssistedIntentSerializer(serializers.ModelSerializer):
    notice_id = serializers.IntegerField(write_only=True, required=False)
    offer_key = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = AssistedIntent
        fields = [
            "id",
            "notice_id",
            "offer_key",
            "notice",
            "offer",
            "name",
            "email",
            "phone_number",
            "notice_code_snapshot",
            "severity_snapshot",
            "source_path",
            "experiment_key",
            "experiment_variant",
            "metadata",
            "status",
            "operator_notes",
            "contacted_at",
            "closed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "notice",
            "status",
            "operator_notes",
            "contacted_at",
            "closed_at",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        notice_id = validated_data.pop("notice_id", None)
        offer_key = validated_data.pop("offer_key", "").strip()
        notice = None
        offer = None
        if notice_id:
            from complia_backend.notices.models import NoticeType

            notice = NoticeType.objects.filter(id=notice_id).first()
        if offer_key:
            offer = AssistedOffer.objects.filter(key=offer_key, is_active=True).first()
        elif validated_data.get("experiment_key"):
            offer = AssistedOffer.objects.filter(
                key=validated_data["experiment_key"],
                is_active=True,
            ).first()
        return AssistedIntent.objects.create(notice=notice, offer=offer, **validated_data)


class AdminAssistedIntentSerializer(serializers.ModelSerializer):
    notice_title = serializers.CharField(source="notice.title", read_only=True)

    class Meta:
        model = AssistedIntent
        fields = [
            "id",
            "notice",
            "notice_title",
            "offer",
            "name",
            "email",
            "phone_number",
            "notice_code_snapshot",
            "severity_snapshot",
            "source_path",
            "experiment_key",
            "experiment_variant",
            "metadata",
            "status",
            "operator_notes",
            "contacted_at",
            "closed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "notice_title", "created_at", "updated_at"]


class ExperimentExposureSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExperimentExposure
        fields = [
            "id",
            "session_id",
            "experiment_key",
            "variant",
            "path",
            "metadata",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
        validators = []

    def validate_session_id(self, value):
        cleaned = value.strip()
        if len(cleaned) < 8:
            raise serializers.ValidationError("Invalid session id.")
        return cleaned


class WeeklyKpiSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyKpiSnapshot
        fields = ["week_start", "week_end", "metrics", "created_at"]


class AssistedOfferSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistedOffer
        fields = ["key", "name", "description", "target_severity", "config", "is_active"]


class PaymentPlanSerializer(serializers.ModelSerializer):
    amount_inr = serializers.SerializerMethodField()

    class Meta:
        model = PaymentPlan
        fields = [
            "key",
            "name",
            "description",
            "amount_paise",
            "amount_inr",
            "currency",
            "credits",
            "is_active",
            "is_default",
        ]

    def get_amount_inr(self, obj):
        return float(obj.amount_paise) / 100.0


class PaymentOrderCreateSerializer(serializers.Serializer):
    plan_key = serializers.CharField(max_length=80)

    def validate_plan_key(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Plan key is required.")
        if not PaymentPlan.objects.filter(key=cleaned, is_active=True).exists():
            raise serializers.ValidationError("Invalid plan key.")
        return cleaned


class PaymentTestConfirmSerializer(serializers.Serializer):
    order_id = serializers.CharField(max_length=80, required=False, allow_blank=True)
    plan_key = serializers.CharField(max_length=80, required=False, allow_blank=True)
    user_email = serializers.EmailField(required=False, allow_blank=True)
    provider_payment_id = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def validate(self, attrs):
        order_id = (attrs.get("order_id") or "").strip()
        plan_key = (attrs.get("plan_key") or "").strip()
        if not order_id and not plan_key:
            raise serializers.ValidationError("Provide either order_id or plan_key.")
        if order_id:
            attrs["order_id"] = order_id
        if plan_key:
            attrs["plan_key"] = plan_key
        attrs["user_email"] = (attrs.get("user_email") or "").strip().lower()
        return attrs


class PaymentOrderSerializer(serializers.ModelSerializer):
    plan_key = serializers.CharField(source="plan.key", read_only=True)
    amount_inr = serializers.SerializerMethodField()

    class Meta:
        model = PaymentOrder
        fields = [
            "id",
            "order_id",
            "status",
            "plan_key",
            "amount_paise",
            "amount_inr",
            "currency",
            "credits",
            "provider",
            "provider_order_id",
            "payment_session_id",
            "checkout_url",
            "paid_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_amount_inr(self, obj):
        return float(obj.amount_paise) / 100.0


class AdminPaymentOrderSerializer(serializers.ModelSerializer):
    plan_key = serializers.CharField(source="plan.key", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True, allow_null=True)
    amount_inr = serializers.SerializerMethodField()
    admin_status = serializers.SerializerMethodField()

    class Meta:
        model = PaymentOrder
        fields = [
            "id",
            "order_id",
            "status",
            "admin_status",
            "plan_key",
            "user_email",
            "amount_paise",
            "amount_inr",
            "currency",
            "credits",
            "provider",
            "provider_order_id",
            "payment_session_id",
            "checkout_url",
            "paid_at",
            "credit_granted_at",
            "failure_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_amount_inr(self, obj):
        return float(obj.amount_paise) / 100.0

    def get_admin_status(self, obj):
        if obj.status == "paid":
            return "success"
        if obj.status == "failed":
            return "failed"
        if obj.status == "cancelled":
            return "abandoned"

        stale_after_minutes = getattr(settings, "PAYMENT_PENDING_ABANDON_MINUTES", 20)
        cutoff = timezone.now() - timedelta(minutes=stale_after_minutes)
        if obj.status in {"created", "payment_pending"} and obj.created_at < cutoff:
            return "abandoned"
        return "initiated"


class UserEntitlementSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserEntitlement
        fields = [
            "parser_credits",
            "lifetime_purchased_credits",
            "lifetime_consumed_credits",
            "updated_at",
        ]


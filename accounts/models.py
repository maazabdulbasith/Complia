from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

class UserManager(BaseUserManager):
    """
    Custom manager for the User model where email is the unique identifier.
    """
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('user_type', 'admin')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    """
    Enhanced User model for the Complia ecosystem.
    """
    USER_TYPE_CHOICES = (
        ('taxpayer', 'Individual Taxpayer'),
        ('ca', 'Chartered Accountant'),
        ('admin', 'Complia Admin'),
    )

    username = None  # Remove username field
    email = models.EmailField('Email Address', unique=True)

    user_type = models.CharField(
        max_length=20,
        choices=USER_TYPE_CHOICES,
        default='taxpayer'
    )

    phone_number = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        help_text="Optional: For WhatsApp notifications/login"
    )

    is_verified_ca = models.BooleanField(
        default=False,
        help_text="Only applicable for CA user types"
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []  # Email & Password are required by default

    objects = UserManager()

    def __str__(self):
        return f"{self.email} ({self.get_user_type_display()})"


class CAPanelProfile(models.Model):
    user = models.OneToOneField(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ca_panel_profile",
    )
    display_name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=20, blank=True)
    icai_membership_number = models.CharField(max_length=60, blank=True)
    city = models.CharField(max_length=80, blank=True)
    specialties = models.JSONField(default=list, blank=True)
    turnaround_sla_hours = models.PositiveIntegerField(default=24)
    is_active = models.BooleanField(default=True, db_index=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_name", "email"]

    def __str__(self):
        return f"{self.display_name} ({self.email})"


class CAHelpRequest(models.Model):
    STATUS_CHOICES = (
        ("new", "New"),
        ("triaged", "Triaged"),
        ("assigned", "Assigned"),
        ("contacted", "Contacted"),
        ("engaged", "Engaged"),
        ("resolved", "Resolved"),
        ("closed", "Closed"),
    )
    PRIORITY_CHOICES = (
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
    )

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ca_help_requests",
    )
    notice_code = models.CharField(max_length=100, blank=True)
    name = models.CharField(max_length=120)
    email = models.EmailField()
    phone_number = models.CharField(max_length=20, blank=True)
    message = models.TextField(blank=True)
    consent_to_share_with_ca = models.BooleanField(default=False)
    consent_recorded_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="new")
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="medium")
    assigned_ca = models.ForeignKey(
        "accounts.CAPanelProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_requests",
    )
    assigned_to_email = models.EmailField(blank=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    shared_case_materials_at = models.DateTimeField(null=True, blank=True)
    internal_notes = models.TextField(blank=True)
    contacted_at = models.DateTimeField(null=True, blank=True)
    engaged_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.email} - {self.notice_code or 'general'} ({self.status})"


class AnalyticsEvent(models.Model):
    EVENT_CHOICES = (
        ("page_view", "Page View"),
        ("search_performed", "Search Performed"),
        ("notice_opened", "Notice Opened"),
        ("ca_help_started", "CA Help Started"),
        ("search_result_clicked", "Search Result Clicked"),
        ("notice_saved", "Notice Saved"),
        ("notice_unsaved", "Notice Unsaved"),
        ("ca_help_submitted", "CA Help Submitted"),
        ("assisted_offer_seen", "Assisted Offer Seen"),
        ("assisted_offer_clicked", "Assisted Offer Clicked"),
        ("payment_plan_viewed", "Payment Plan Viewed"),
        ("payment_order_created", "Payment Order Created"),
        ("payment_checkout_opened", "Payment Checkout Opened"),
        ("payment_success", "Payment Success"),
        ("payment_failed", "Payment Failed"),
        ("credit_consumed", "Credit Consumed"),
        ("paid_parser_result_viewed", "Paid Parser Result Viewed"),
        ("admin_dashboard_viewed", "Admin Dashboard Viewed"),
        ("admin_dashboard_heartbeat", "Admin Dashboard Heartbeat"),
        ("admin_ca_request_updated", "Admin CA Request Updated"),
        ("admin_feedback_updated", "Admin Feedback Updated"),
    )

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="analytics_events",
    )
    session_id = models.CharField(max_length=64, db_index=True)
    event_name = models.CharField(max_length=64, choices=EVENT_CHOICES, db_index=True)
    path = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event_name} ({self.session_id})"


class AssistedOffer(models.Model):
    TARGET_SEVERITY_CHOICES = (
        ("all", "All"),
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
    )

    key = models.CharField(max_length=60, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    target_severity = models.CharField(max_length=20, choices=TARGET_SEVERITY_CHOICES, default="high")
    is_active = models.BooleanField(default=True)
    config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return self.key


class AssistedIntent(models.Model):
    STATUS_CHOICES = (
        ("new", "New"),
        ("triaged", "Triaged"),
        ("contacted", "Contacted"),
        ("won", "Won"),
        ("lost", "Lost"),
        ("closed", "Closed"),
    )

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assisted_intents",
    )
    notice = models.ForeignKey(
        "notices.NoticeType",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assisted_intents",
    )
    offer = models.ForeignKey(
        AssistedOffer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="intents",
    )
    name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    notice_code_snapshot = models.CharField(max_length=80, blank=True)
    severity_snapshot = models.CharField(max_length=20, blank=True)
    source_path = models.CharField(max_length=255, blank=True)
    experiment_key = models.CharField(max_length=80, blank=True)
    experiment_variant = models.CharField(max_length=40, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="new", db_index=True)
    operator_notes = models.TextField(blank=True)
    contacted_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.notice_code_snapshot or 'unknown'} - {self.status}"


class ExperimentExposure(models.Model):
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="experiment_exposures",
    )
    session_id = models.CharField(max_length=64, db_index=True)
    experiment_key = models.CharField(max_length=80, db_index=True)
    variant = models.CharField(max_length=40)
    path = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("session_id", "experiment_key")

    def __str__(self):
        return f"{self.experiment_key}:{self.variant}"


class WeeklyKpiSnapshot(models.Model):
    week_start = models.DateField(unique=True)
    week_end = models.DateField()
    metrics = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-week_start"]

    def __str__(self):
        return f"Week of {self.week_start}"


class PaymentPlan(models.Model):
    key = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    amount_paise = models.PositiveIntegerField(default=900)
    currency = models.CharField(max_length=10, default="INR")
    credits = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True, db_index=True)
    is_default = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["amount_paise", "key"]

    def __str__(self):
        return f"{self.key} ({self.amount_paise} paise)"


class PaymentOrder(models.Model):
    STATUS_CHOICES = (
        ("created", "Created"),
        ("payment_pending", "Payment Pending"),
        ("paid", "Paid"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    )

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_orders",
    )
    plan = models.ForeignKey(
        PaymentPlan,
        on_delete=models.PROTECT,
        related_name="orders",
    )
    order_id = models.CharField(max_length=80, unique=True, db_index=True)
    provider = models.CharField(max_length=40, default="cashfree")
    provider_order_id = models.CharField(max_length=120, blank=True, db_index=True)
    payment_session_id = models.CharField(max_length=180, blank=True)
    checkout_url = models.URLField(blank=True)
    amount_paise = models.PositiveIntegerField()
    currency = models.CharField(max_length=10, default="INR")
    credits = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="created", db_index=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    credit_granted_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.order_id} ({self.status})"


class PaymentTransaction(models.Model):
    payment_order = models.ForeignKey(
        PaymentOrder,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    provider_payment_id = models.CharField(max_length=120, blank=True, db_index=True)
    provider_status = models.CharField(max_length=60, blank=True)
    idempotency_key = models.CharField(max_length=200, unique=True)
    signature_verified = models.BooleanField(default=False)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.idempotency_key}"


class UserEntitlement(models.Model):
    user = models.OneToOneField(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="entitlement",
    )
    parser_credits = models.PositiveIntegerField(default=0)
    lifetime_purchased_credits = models.PositiveIntegerField(default=0)
    lifetime_consumed_credits = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user.email} credits={self.parser_credits}"

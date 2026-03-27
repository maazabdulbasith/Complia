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


class CAHelpRequest(models.Model):
    STATUS_CHOICES = (
        ("new", "New"),
        ("triaged", "Triaged"),
        ("contacted", "Contacted"),
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
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="new")
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="medium")
    assigned_to_email = models.EmailField(blank=True)
    internal_notes = models.TextField(blank=True)
    contacted_at = models.DateTimeField(null=True, blank=True)
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
        ("notice_search", "Notice Search"),
        ("search_result_clicked", "Search Result Clicked"),
        ("notice_detail_viewed", "Notice Detail Viewed"),
        ("notice_saved", "Notice Saved"),
        ("notice_unsaved", "Notice Unsaved"),
        ("ca_help_submitted", "CA Help Submitted"),
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

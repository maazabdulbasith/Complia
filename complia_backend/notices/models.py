from django.db import models
from django.conf import settings
from django.utils.text import slugify

class NoticeType(models.Model):
    SEVERITY_CHOICES = [
        ('low', 'Low - Informational'),
        ('medium', 'Medium - Action Required'),
        ('high', 'High - Urgent / Penalty Risk'),
    ]

    code = models.CharField(max_length=50, unique=True, help_text="e.g., GST-ASMT-10")
    title = models.CharField(max_length=200, help_text="Official title of the notice")
    slug = models.SlugField(max_length=140, unique=True, null=True, blank=True, db_index=True)
    
    # Content V2 Fields
    summary = models.TextField(help_text="2-3 sentence overview (Searchable)", blank=True)
    detailed_explanation = models.TextField(help_text="Full deep-dive explanation (Not searchable)")
    why_received = models.TextField(help_text="Why did I get this? (Emotional context)", blank=True)
    common_mistakes = models.TextField(help_text="What do people usually do wrong?", blank=True)
    source_section = models.CharField(max_length=100, help_text="e.g. CGST Act Section 61", blank=True)
    meta_title = models.CharField(max_length=255, blank=True)
    meta_description = models.CharField(max_length=320, blank=True)

    consequences_of_ignoring = models.TextField(help_text="What happens if the user does nothing?")
    next_steps = models.TextField(help_text="Bulleted list of immediate next steps")
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='medium')
    
    # Resilience / Validation Fields
    verified_by = models.CharField(max_length=100, blank=True, null=True, help_text="Name of the expert who verified this")
    verified_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=False, help_text="Only active notices are shown to users")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.code}: {self.title}"

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.code or self.title)[:120] or "notice"
            candidate = base_slug
            idx = 2
            while NoticeType.objects.exclude(pk=self.pk).filter(slug=candidate).exists():
                candidate = f"{base_slug}-{idx}"
                idx += 1
            self.slug = candidate
        super().save(*args, **kwargs)

class TriggerKeyword(models.Model):
    notice_type = models.ForeignKey(NoticeType, on_delete=models.CASCADE, related_name='triggers')
    keyword = models.CharField(max_length=100, help_text="Keyword or phrase that identifies this notice")
    
    def __str__(self):
        return f"'{self.keyword}' -> {self.notice_type.code}"

class NoticeFeedback(models.Model):
    STATUS_CHOICES = [
        ("new", "New"),
        ("reviewed", "Reviewed"),
        ("resolved", "Resolved"),
    ]

    notice = models.ForeignKey(NoticeType, on_delete=models.CASCADE, related_name='feedback')
    is_helpful = models.BooleanField(help_text="Did this help? (Yes/No)")
    comments = models.TextField(blank=True, null=True, help_text="Optional comments (only if No)")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="new", db_index=True)
    internal_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_feedback",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.notice.code} - {'Helpful' if self.is_helpful else 'Not Helpful'}"


class SavedNotice(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_notices",
    )
    notice = models.ForeignKey(
        NoticeType,
        on_delete=models.CASCADE,
        related_name="saved_by_users",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "notice")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} saved {self.notice.code}"


class ParserJob(models.Model):
    STATUS_CHOICES = [
        ("queued", "Queued"),
        ("completed", "Completed"),
        ("review_required", "Review Required"),
        ("failed", "Failed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="parser_jobs",
    )
    notice = models.ForeignKey(
        NoticeType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="parser_jobs",
    )
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="queued", db_index=True)
    confidence = models.FloatField(default=0.0)
    is_private_beta = models.BooleanField(default=True)
    delete_after = models.DateTimeField()
    processed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    review_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_parser_jobs",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"ParserJob#{self.id} {self.status}"


class ParserExtraction(models.Model):
    REVIEW_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    parser_job = models.OneToOneField(
        ParserJob,
        on_delete=models.CASCADE,
        related_name="extraction",
    )
    deadline_date = models.DateField(null=True, blank=True)
    legal_section = models.CharField(max_length=120, blank=True)
    amount_claimed = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    notice_type_detected = models.CharField(max_length=120, blank=True)
    confidence = models.FloatField(default=0.0)
    normalized_payload = models.JSONField(default=dict, blank=True)
    raw_text_excerpt = models.TextField(blank=True)
    review_status = models.CharField(max_length=20, choices=REVIEW_STATUS_CHOICES, default="pending", db_index=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_extractions",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Extraction#{self.id} ({self.review_status})"


class ParserBenchmarkRun(models.Model):
    sample_count = models.PositiveIntegerField(default=0)
    notice_precision = models.FloatField(default=0.0)
    notice_recall = models.FloatField(default=0.0)
    section_precision = models.FloatField(default=0.0)
    section_recall = models.FloatField(default=0.0)
    amount_precision = models.FloatField(default=0.0)
    amount_recall = models.FloatField(default=0.0)
    overall_f1 = models.FloatField(default=0.0)
    metrics = models.JSONField(default=dict, blank=True)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="parser_benchmark_runs",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"ParserBenchmarkRun#{self.id} ({self.overall_f1:.2f})"

from django.db import models
from django.utils import timezone

class NoticeType(models.Model):
    SEVERITY_CHOICES = [
        ('low', 'Low - Informational'),
        ('medium', 'Medium - Action Required'),
        ('high', 'High - Urgent / Penalty Risk'),
    ]

    code = models.CharField(max_length=50, unique=True, help_text="e.g., GST-ASMT-10")
    title = models.CharField(max_length=200, help_text="Official title of the notice")
    
    # Content V2 Fields
    summary = models.TextField(help_text="2-3 sentence overview (Searchable)", blank=True)
    detailed_explanation = models.TextField(help_text="Full deep-dive explanation (Not searchable)")
    why_received = models.TextField(help_text="Why did I get this? (Emotional context)", blank=True)
    common_mistakes = models.TextField(help_text="What do people usually do wrong?", blank=True)
    source_section = models.CharField(max_length=100, help_text="e.g. CGST Act Section 61", blank=True)

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

class TriggerKeyword(models.Model):
    notice_type = models.ForeignKey(NoticeType, on_delete=models.CASCADE, related_name='triggers')
    keyword = models.CharField(max_length=100, help_text="Keyword or phrase that identifies this notice")
    
    def __str__(self):
        return f"'{self.keyword}' -> {self.notice_type.code}"

class NoticeFeedback(models.Model):
    notice = models.ForeignKey(NoticeType, on_delete=models.CASCADE, related_name='feedback')
    is_helpful = models.BooleanField(help_text="Did this help? (Yes/No)")
    comments = models.TextField(blank=True, null=True, help_text="Optional comments (only if No)")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.notice.code} - {'Helpful' if self.is_helpful else 'Not Helpful'}"

from django.contrib import admin
from .models import NoticeType, TriggerKeyword

class TriggerKeywordInline(admin.TabularInline):
    model = TriggerKeyword
    extra = 1

@admin.register(NoticeType)
class NoticeTypeAdmin(admin.ModelAdmin):
    list_display = ('code', 'title', 'severity', 'is_active', 'verified_by')
    list_filter = ('severity', 'is_active', 'verified_by')
    search_fields = ('code', 'title', 'plain_english_explanation')
    inlines = [TriggerKeywordInline]
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Identification', {
            'fields': ('code', 'title', 'is_active')
        }),
        ('Explanation', {
            'fields': ('plain_english_explanation', 'consequences_of_ignoring', 'next_steps')
        }),
        ('Classification', {
            'fields': ('severity',)
        }),
        ('Verification', {
            'fields': ('verified_by', 'verified_at')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at')
        }),
    )

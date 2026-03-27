from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CAHelpRequest, User

class CustomUserAdmin(UserAdmin):
    """
    Custom Admin interface to show our new fields (User Type, Phone, etc.)
    in the Superadmin monitoring dashboard.
    """
    model = User
    list_display = ['email', 'user_type', 'phone_number', 'is_verified_ca', 'is_staff']
    list_filter = ['user_type', 'is_verified_ca', 'is_staff']
    fieldsets = UserAdmin.fieldsets + (
        ('Complia Specific', {'fields': ('user_type', 'phone_number', 'is_verified_ca')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Complia Specific', {'fields': ('user_type', 'phone_number', 'is_verified_ca')}),
    )
    ordering = ['email']

admin.site.register(User, CustomUserAdmin)


@admin.register(CAHelpRequest)
class CAHelpRequestAdmin(admin.ModelAdmin):
    list_display = ("email", "notice_code", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("email", "name", "notice_code", "phone_number")
    readonly_fields = ("created_at",)

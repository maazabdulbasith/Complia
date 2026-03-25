from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

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

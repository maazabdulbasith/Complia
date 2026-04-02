from django.conf import settings
from rest_framework import permissions


class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_superuser or getattr(request.user, "user_type", "") == "admin")
        )


class IsParserBetaUser(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if not settings.PARSER_PRIVATE_BETA_ENABLED:
            # Public parser mode: any authenticated user can access parser endpoints.
            return True
        if user.is_superuser or getattr(user, "user_type", "") == "admin":
            return True
        return user.email.lower() in settings.PARSER_BETA_EMAILS

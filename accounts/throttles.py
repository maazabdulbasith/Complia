from rest_framework.throttling import ScopedRateThrottle


class CompliaScopedRateThrottle(ScopedRateThrottle):
    """
    Keeps throttling enabled for normal/public users, but removes scoped throttle
    limits for authenticated superadmins/admin users.
    """

    def allow_request(self, request, view):
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            if getattr(user, "is_superuser", False) or getattr(user, "user_type", "") == "admin":
                return True
        return super().allow_request(request, view)

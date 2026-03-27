from __future__ import annotations

from django.db import connections
from django.db.utils import OperationalError
from django.http import JsonResponse


def health_check(_request):
    """
    Liveness probe: confirms the process is up.
    """
    return JsonResponse(
        {
            "status": "ok",
            "service": "complia-api",
        }
    )


def readiness_check(_request):
    """
    Readiness probe: confirms dependencies required to serve traffic.
    """
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except OperationalError:
        return JsonResponse(
            {
                "status": "error",
                "message": "Database unavailable.",
            },
            status=503,
        )

    return JsonResponse(
        {
            "status": "ok",
            "checks": {
                "database": "ok",
            },
        }
    )

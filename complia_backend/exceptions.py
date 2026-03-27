from __future__ import annotations

from collections.abc import Mapping

from rest_framework import status
from rest_framework.exceptions import ErrorDetail
from rest_framework.response import Response
from rest_framework.views import exception_handler


def _normalize_error_details(value):
    if isinstance(value, list):
        return [_normalize_error_details(item) for item in value]
    if isinstance(value, Mapping):
        return {key: _normalize_error_details(item) for key, item in value.items()}
    if isinstance(value, ErrorDetail):
        return str(value)
    return value


def _derive_message(http_status_code: int, details) -> str:
    if isinstance(details, Mapping) and "detail" in details:
        detail_value = details["detail"]
        if isinstance(detail_value, list):
            detail_value = detail_value[0] if detail_value else "Request failed."
        return str(detail_value)
    if http_status_code == status.HTTP_400_BAD_REQUEST:
        return "Validation failed."
    if http_status_code == status.HTTP_404_NOT_FOUND:
        return "Resource not found."
    if http_status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        return "Too many requests."
    if http_status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
        return "Internal server error."
    return "Request failed."


def custom_exception_handler(exc, context):
    """
    Return API errors in a consistent envelope for easier frontend handling.
    """
    response = exception_handler(exc, context)
    if response is None:
        return Response(
            {
                "status": "error",
                "message": "Internal server error.",
                "code": "server_error",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    normalized_details = _normalize_error_details(response.data)
    message = _derive_message(response.status_code, normalized_details)

    payload = {
        "status": "error",
        "message": message,
        "code": getattr(exc, "default_code", "api_error"),
    }

    # Keep field-level details for form UIs when available.
    if isinstance(normalized_details, Mapping):
        payload["errors"] = normalized_details
    elif normalized_details:
        payload["details"] = normalized_details

    response.data = payload
    return response

import base64
import time
from typing import Any

import fitz
import requests
from django.conf import settings


class OCRProcessingError(ValueError):
    """Raised when OCR extraction fails with a user-actionable message."""


def _readable_char_count(text: str) -> int:
    compact = "".join(ch for ch in text if not ch.isspace())
    return len(compact)


def sanitize_ocr_text(text: str) -> str:
    return (text or "").replace("\x00", " ").strip()


def _assert_ocr_configured() -> None:
    if not settings.OCR_ENABLED:
        raise OCRProcessingError(
            "OCR is disabled for image/PDF uploads. Set OCR_ENABLED=true or upload a .txt file."
        )
    provider = settings.OCR_PROVIDER
    if provider not in {"google_vision", "azure_vision"}:
        raise OCRProcessingError(
            "Unsupported OCR provider. Use OCR_PROVIDER=google_vision or OCR_PROVIDER=azure_vision."
        )
    if provider == "google_vision" and not settings.GOOGLE_VISION_API_KEY:
        raise OCRProcessingError(
            "OCR is not configured. Add GOOGLE_VISION_API_KEY to process image/PDF uploads."
        )
    if provider == "azure_vision":
        if not settings.AZURE_VISION_API_KEY:
            raise OCRProcessingError(
                "OCR is not configured. Add AZURE_VISION_API_KEY to process image/PDF uploads."
            )
        if not settings.AZURE_VISION_ENDPOINT:
            raise OCRProcessingError(
                "OCR is not configured. Add AZURE_VISION_ENDPOINT to process image/PDF uploads."
            )


def _vision_ocr_image_bytes(image_bytes: bytes) -> str:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "requests": [
            {
                "image": {"content": encoded},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
            }
        ]
    }
    endpoint = (
        "https://vision.googleapis.com/v1/images:annotate"
        f"?key={settings.GOOGLE_VISION_API_KEY}"
    )
    timeout_sec = max(int(settings.OCR_REQUEST_TIMEOUT_SEC), 1)
    try:
        response = requests.post(endpoint, json=payload, timeout=timeout_sec)
    except requests.RequestException as exc:
        raise OCRProcessingError(
            "OCR request failed. Please retry in a moment or upload a clearer file."
        ) from exc

    try:
        body: dict[str, Any] = response.json()
    except ValueError as exc:
        raise OCRProcessingError("OCR service returned an invalid response. Please retry.") from exc

    if response.status_code >= 400:
        provider_message = body.get("error", {}).get("message") or ""
        message = (
            f"OCR service rejected the file: {provider_message}"
            if provider_message
            else "OCR service rejected the file. Please retry with a clearer document."
        )
        raise OCRProcessingError(message)

    responses = body.get("responses") or []
    first = responses[0] if responses else {}
    if "error" in first:
        provider_message = first.get("error", {}).get("message") or ""
        raise OCRProcessingError(
            f"OCR service error: {provider_message}" if provider_message else "OCR service error."
        )

    text = (
        first.get("fullTextAnnotation", {}).get("text")
        or (
            first.get("textAnnotations", [{}])[0].get("description")
            if first.get("textAnnotations")
            else ""
        )
        or ""
    )
    sanitized = sanitize_ocr_text(text)
    if not sanitized:
        raise OCRProcessingError(
            "Could not extract readable text from this image. Upload a clearer scan or a text file."
        )
    return sanitized


def _azure_read_ocr_image_bytes(image_bytes: bytes) -> str:
    endpoint = f"{settings.AZURE_VISION_ENDPOINT}/vision/v3.2/read/analyze"
    headers = {
        "Ocp-Apim-Subscription-Key": settings.AZURE_VISION_API_KEY,
        "Content-Type": "application/octet-stream",
    }
    timeout_sec = max(int(settings.OCR_REQUEST_TIMEOUT_SEC), 1)
    try:
        analyze_resp = requests.post(
            endpoint,
            headers=headers,
            data=image_bytes,
            timeout=timeout_sec,
        )
    except requests.RequestException as exc:
        raise OCRProcessingError(
            "Azure OCR request failed. Please retry in a moment or upload a clearer file."
        ) from exc

    if analyze_resp.status_code not in (200, 202):
        try:
            body = analyze_resp.json()
        except ValueError:
            body = {}
        provider_message = (
            body.get("error", {}).get("message")
            or body.get("message")
            or ""
        )
        message = (
            f"OCR service rejected the file: {provider_message}"
            if provider_message
            else "OCR service rejected the file. Please retry with a clearer document."
        )
        raise OCRProcessingError(message)

    operation_location = analyze_resp.headers.get("Operation-Location", "")
    if not operation_location:
        raise OCRProcessingError("OCR service did not return a valid operation ID.")

    deadline = time.monotonic() + max(timeout_sec, 8)
    while time.monotonic() < deadline:
        try:
            result_resp = requests.get(
                operation_location,
                headers={"Ocp-Apim-Subscription-Key": settings.AZURE_VISION_API_KEY},
                timeout=timeout_sec,
            )
        except requests.RequestException as exc:
            raise OCRProcessingError("OCR status check failed. Please retry.") from exc

        try:
            result_body = result_resp.json()
        except ValueError:
            result_body = {}

        if result_resp.status_code >= 400:
            provider_message = (
                result_body.get("error", {}).get("message")
                or result_body.get("message")
                or ""
            )
            raise OCRProcessingError(
                f"OCR service error: {provider_message}" if provider_message else "OCR service error."
            )

        state = (result_body.get("status") or "").lower()
        if state == "succeeded":
            pages = result_body.get("analyzeResult", {}).get("readResults", [])
            lines: list[str] = []
            for page in pages:
                for line in page.get("lines", []):
                    line_text = (line.get("text") or "").strip()
                    if line_text:
                        lines.append(line_text)
            extracted = sanitize_ocr_text("\n".join(lines))
            if not extracted:
                raise OCRProcessingError(
                    "Could not extract readable text from this image. Upload a clearer scan or a text file."
                )
            return extracted
        if state == "failed":
            provider_message = result_body.get("analyzeResult", {}).get("message", "")
            raise OCRProcessingError(
                f"OCR processing failed: {provider_message}" if provider_message else "OCR processing failed."
            )

        time.sleep(1)

    raise OCRProcessingError("OCR request timed out. Please retry with a smaller or clearer file.")


def _provider_ocr_image_bytes(image_bytes: bytes) -> str:
    if settings.OCR_PROVIDER == "azure_vision":
        return _azure_read_ocr_image_bytes(image_bytes)
    return _vision_ocr_image_bytes(image_bytes)


def _extract_pdf_embedded_text(pdf_doc: fitz.Document, page_limit: int) -> tuple[str, int]:
    page_count = min(max(page_limit, 1), pdf_doc.page_count)
    parts: list[str] = []
    for page_index in range(page_count):
        parts.append(pdf_doc[page_index].get_text("text") or "")
    return sanitize_ocr_text("\n\n".join(parts)), page_count


def _extract_pdf_via_raster_ocr(pdf_doc: fitz.Document, page_limit: int) -> tuple[str, int]:
    page_count = min(max(page_limit, 1), pdf_doc.page_count)
    parts: list[str] = []
    for page_index in range(page_count):
        page = pdf_doc[page_index]
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        image_bytes = pixmap.tobytes("png")
        parts.append(_provider_ocr_image_bytes(image_bytes))
    return sanitize_ocr_text("\n\n".join(parts)), page_count


def extract_text_from_binary_document(
    raw_bytes: bytes,
    mime_type: str,
    filename: str,
) -> tuple[str, dict[str, Any]]:
    """
    Extract text from binary notice uploads using OCR + PDF fallback strategy.

    Returns:
        tuple[text, metadata]:
            metadata keys: ocr_engine, ocr_pages_processed, ocr_used, ocr_text_chars
    """

    _assert_ocr_configured()

    mime = (mime_type or "").lower()
    lower_name = (filename or "").lower()
    page_limit = max(int(settings.OCR_MAX_PAGES), 1)
    min_text_chars = max(int(settings.OCR_MIN_TEXT_CHARS), 20)

    if mime.startswith("image/"):
        image_text = _provider_ocr_image_bytes(raw_bytes)
        text_chars = _readable_char_count(image_text)
        if text_chars < min_text_chars:
            raise OCRProcessingError(
                "OCR extracted too little text from this image. Upload a clearer file or .txt."
            )
        metadata = {
            "ocr_engine": settings.OCR_PROVIDER,
            "ocr_pages_processed": 1,
            "ocr_used": True,
            "ocr_text_chars": text_chars,
        }
        return image_text, metadata

    if mime == "application/pdf" or lower_name.endswith(".pdf"):
        try:
            with fitz.open(stream=raw_bytes, filetype="pdf") as pdf_doc:
                if pdf_doc.page_count < 1:
                    raise OCRProcessingError("The PDF appears empty. Please upload a valid notice file.")

                embedded_text, processed_pages = _extract_pdf_embedded_text(pdf_doc, page_limit)
                embedded_chars = _readable_char_count(embedded_text)
                if embedded_chars >= min_text_chars:
                    metadata = {
                        "ocr_engine": "pymupdf_text",
                        "ocr_pages_processed": processed_pages,
                        "ocr_used": False,
                        "ocr_text_chars": embedded_chars,
                    }
                    return embedded_text, metadata

                ocr_text, ocr_pages = _extract_pdf_via_raster_ocr(pdf_doc, page_limit)
                ocr_chars = _readable_char_count(ocr_text)
                if ocr_chars < min_text_chars:
                    raise OCRProcessingError(
                        "Could not extract enough readable text from this PDF. Upload a clearer scan."
                    )
                metadata = {
                    "ocr_engine": settings.OCR_PROVIDER,
                    "ocr_pages_processed": ocr_pages,
                    "ocr_used": True,
                    "ocr_text_chars": ocr_chars,
                }
                return ocr_text, metadata
        except OCRProcessingError:
            raise
        except Exception as exc:  # pragma: no cover - defensive fallback
            raise OCRProcessingError(
                "Could not process this PDF. Please retry with a cleaner file."
            ) from exc

    raise OCRProcessingError(
        "Unsupported binary format for OCR. Upload PDF, PNG, JPG, JPEG, WEBP, or TXT."
    )

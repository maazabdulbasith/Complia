import re
from decimal import Decimal, InvalidOperation

from .models import NoticeType


def extract_amount(text: str):
    amount_match = re.search(r"(?i)(?:rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)", text)
    if not amount_match:
        return None
    raw = amount_match.group(1).replace(",", "")
    try:
        return Decimal(raw)
    except (InvalidOperation, ValueError):
        return None


def extract_legal_section(text: str) -> str:
    section_match = re.search(r"(?i)section\s+([0-9A-Za-z\-/]+)", text)
    if section_match:
        return f"Section {section_match.group(1)}"
    return ""


def detect_notice_type(text: str, filename: str):
    haystack = f"{filename} {text}".lower()
    for notice in NoticeType.objects.filter(is_active=True):
        if notice.code.lower() in haystack:
            return notice
    return None


def parse_notice_document(raw_text: str, filename: str, notice_code_hint: str = ""):
    legal_section = extract_legal_section(raw_text)
    amount_claimed = extract_amount(raw_text)

    notice = None
    if notice_code_hint:
        notice = NoticeType.objects.filter(code__iexact=notice_code_hint, is_active=True).first()
    if notice is None:
        notice = detect_notice_type(raw_text, filename)

    confidence = 0.48
    if notice:
        confidence += 0.25
    if legal_section:
        confidence += 0.12
    if amount_claimed is not None:
        confidence += 0.08
    confidence = min(confidence, 0.95)

    return {
        "notice": notice,
        "legal_section": legal_section,
        "amount_claimed": amount_claimed,
        "confidence": confidence,
    }

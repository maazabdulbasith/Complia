import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

from .models import NoticeType


def _normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _non_empty_lines(text: str):
    return [line.strip() for line in text.splitlines() if line.strip()]


def extract_amount(text: str):
    contextual_patterns = [
        r"(?i)(?:amount|tax|demand|penalty|interest|liability|short[\s-]?paid|payable)[^\n]{0,60}?(?:rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)",
        r"(?i)(?:amount|tax|demand|penalty|interest|liability|short[\s-]?paid|payable)[^\n]{0,40}?([\d,]+(?:\.\d{1,2})?)",
        r"(?i)(?:demand\s+of|liability\s+of|tax\s+payable\s+of)[^\n]{0,30}?([\d,]+(?:\.\d{1,2})?)",
    ]
    fallback_pattern = r"(?i)(?:rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)"

    for pattern in contextual_patterns:
        amount_match = re.search(pattern, text)
        if amount_match:
            parsed = _parse_amount_candidate(amount_match.group(1))
            if parsed is not None:
                return parsed

    for line in _non_empty_lines(text):
        if not re.search(r"(?i)(amount|tax|demand|penalty|interest|liability|payable|short[\s-]?paid)", line):
            continue
        amount_match = re.search(fallback_pattern, line)
        if amount_match:
            parsed = _parse_amount_candidate(amount_match.group(1))
            if parsed is not None:
                return parsed

    return None


def _parse_amount_candidate(raw_value: str):
    raw = raw_value.replace(",", "").strip()
    parts = raw.split(".", 1)
    integer_part = parts[0].lstrip("0") or "0"
    fractional_part = parts[1] if len(parts) > 1 else ""
    # Ignore tiny OCR garbage such as isolated section/rule numbers wrongly read as amounts.
    if not fractional_part and integer_part.isdigit() and int(integer_part) < 100:
        return None
    # ParserExtraction.amount_claimed uses DecimalField(max_digits=14, decimal_places=2),
    # so cap to 12 digits before decimal and 2 after to avoid DB overflow errors.
    if len(integer_part) > 12 or len(fractional_part) > 2:
        return None
    try:
        return Decimal(raw)
    except (InvalidOperation, ValueError):
        return None


def extract_legal_section(text: str) -> str:
    patterns = [
        r"(?i)section\s+under\s+which\s+notice\s+is\s+issued\s*[:\-]?\s*([0-9A-Za-z()\-/.]+)",
        r"(?i)act\s*/?\s*rules?\s+provisions?\s*[:\-]?\s*([0-9A-Za-z()\-/.]+)",
        r"(?i)\bu/s\.?\s*([0-9A-Za-z()\-/.]+)",
        r"(?i)\bsec(?:tion)?\.?\s*([0-9]{1,3}[A-Za-z]?(?:\([0-9A-Za-z]+\))?)",
        r"(?i)\bsection\s+([0-9]{1,3}[A-Za-z]?(?:\([0-9A-Za-z]+\))?)",
    ]
    for pattern in patterns:
        section_match = re.search(pattern, text)
        if section_match:
            token = _clean_legal_token(section_match.group(1))
            if token:
                if token.lower().startswith(("section ", "rule ")):
                    return token[:120]
                return f"Section {token}"[:120]

    rule_match = re.search(r"(?i)\brule\s+([0-9]{1,3}(?:\([0-9A-Za-z]+\))?)", text)
    if rule_match:
        token = _clean_legal_token(rule_match.group(1))
        if token:
            return f"Rule {token}"[:120]

    for line in _non_empty_lines(text):
        normalized_line = re.sub(r"\s+", " ", line).strip()
        explicit_match = re.search(
            r"(?i)(section|rule)\s*(?:under\s+which\s+notice\s+is\s+issued)?\s*[:\-]?\s*([0-9]{1,3}[A-Za-z]?(?:\([0-9A-Za-z]+\))?)",
            normalized_line,
        )
        if explicit_match:
            prefix = explicit_match.group(1).title()
            token = _clean_legal_token(explicit_match.group(2))
            if token:
                return f"{prefix} {token}"[:120]
    return ""


def _clean_legal_token(token: str) -> str:
    cleaned = token.strip().strip(":.-,;")
    if not cleaned:
        return ""
    match = re.search(r"([0-9]{1,3}[A-Za-z]?(?:\([0-9A-Za-z]+\))?)", cleaned)
    if match:
        return match.group(1)[:100]
    return cleaned[:100]


def detect_notice_type(text: str, filename: str):
    haystack = f"{filename} {text}".lower()
    haystack_normalized = _normalize_text(haystack)

    best_notice = None
    best_score = 0
    notices = NoticeType.objects.filter(is_active=True).prefetch_related("triggers")
    for notice in notices:
        score = 0
        normalized_code = _normalize_text(notice.code)
        if normalized_code and normalized_code in haystack_normalized:
            score += 5

        title = (notice.title or "").lower()
        if title and title in haystack:
            score += 2

        for trigger in notice.triggers.all():
            keyword = (trigger.keyword or "").strip().lower()
            if not keyword:
                continue
            if keyword in haystack:
                score += 1

        if score > best_score:
            best_notice = notice
            best_score = score

    return best_notice if best_score > 0 else None


def extract_deadline_date(text: str):
    patterns = [
        r"(?i)(?:date\s+by\s+which\s+reply(?:\s+has\s+to\s+be)?\s+submitted|reply\s+by|last\s+date|due\s+date)[^\d]{0,30}(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        r"(?i)(?:respond\s+before|reply\s+before|submit\s+before)[^\d]{0,20}(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        r"(?i)(?:hearing\s+date|date\s+of\s+hearing)[^\d]{0,30}(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if not match:
            continue
        raw_date = match.group(1)
        for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"):
            try:
                return datetime.strptime(raw_date, fmt).date()
            except ValueError:
                continue
    return None


def parse_notice_document(raw_text: str, filename: str, notice_code_hint: str = ""):
    legal_section = extract_legal_section(raw_text)
    amount_claimed = extract_amount(raw_text)
    deadline_date = extract_deadline_date(raw_text)

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
    if deadline_date is not None:
        confidence += 0.08
    confidence = min(confidence, 0.95)

    return {
        "notice": notice,
        "deadline_date": deadline_date,
        "legal_section": legal_section,
        "amount_claimed": amount_claimed,
        "confidence": confidence,
    }

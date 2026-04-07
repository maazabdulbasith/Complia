import hashlib
import re
from typing import Iterable

import requests
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from complia_backend.notices.models import NoticeType

USER_AGENT = "CompliaSourceMonitor/1.0 (+https://complia.in/contact-us)"


def _normalize_html_content(raw_bytes: bytes) -> bytes:
    text = raw_bytes.decode("utf-8", errors="ignore")
    text = re.sub(r"<script.*?</script>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<style.*?</style>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<!--.*?-->", " ", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text.encode("utf-8")


def _hash_response_content(raw_bytes: bytes, content_type: str) -> str:
    normalized_bytes = raw_bytes
    if "html" in content_type.lower() or b"<html" in raw_bytes[:512].lower():
        normalized_bytes = _normalize_html_content(raw_bytes)
    return hashlib.sha256(normalized_bytes).hexdigest()


class Command(BaseCommand):
    help = "Checks official source URLs for notice changes and flags notices that need review."

    def add_arguments(self, parser):
        parser.add_argument("--code", help="Check a single notice by code")
        parser.add_argument("--limit", type=int, default=0, help="Limit the number of notices processed")
        parser.add_argument("--include-inactive", action="store_true", help="Include inactive notices in the check")
        parser.add_argument("--timeout", type=int, default=getattr(settings, "NOTICE_SOURCE_CHECK_TIMEOUT_SEC", 15))

    def handle(self, *args, **options):
        queryset = NoticeType.objects.exclude(source_url="").exclude(source_url__isnull=True).order_by("code")
        if not options["include_inactive"]:
            queryset = queryset.filter(is_active=True)
        if options.get("code"):
            queryset = queryset.filter(code=options["code"])
        if options["limit"]:
            queryset = queryset[: options["limit"]]

        notices: Iterable[NoticeType] = list(queryset)
        if not notices:
            self.stdout.write(self.style.WARNING("No notices with source URLs matched this check."))
            return

        checked = 0
        changed = 0
        unchanged = 0
        failures = 0
        newly_monitored = 0
        timeout = max(int(options["timeout"]), 3)

        for notice in notices:
            checked += 1
            now = timezone.now()
            try:
                response = requests.get(
                    notice.source_url,
                    headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/pdf,*/*"},
                    timeout=timeout,
                    allow_redirects=True,
                )
                response.raise_for_status()
                content_hash = _hash_response_content(response.content, response.headers.get("Content-Type", ""))

                previous_hash = notice.source_content_hash or ""
                notice.source_last_checked_at = now
                notice.source_check_error = ""

                if not previous_hash:
                    notice.source_content_hash = content_hash
                    if notice.review_status not in {"trusted", "needs_review", "watch"}:
                        notice.review_status = "watch"
                    notice.save(
                        update_fields=[
                            "source_content_hash",
                            "source_last_checked_at",
                            "source_check_error",
                            "updated_at",
                        ]
                    )
                    newly_monitored += 1
                    self.stdout.write(self.style.SUCCESS(f"[{notice.code}] baseline hash stored"))
                    continue

                if previous_hash != content_hash:
                    notice.source_content_hash = content_hash
                    notice.source_last_changed_at = now
                    notice.source_check_error = ""
                    notice.review_status = "needs_review"
                    notice.save(
                        update_fields=[
                            "source_content_hash",
                            "source_last_checked_at",
                            "source_last_changed_at",
                            "source_check_error",
                            "review_status",
                            "updated_at",
                        ]
                    )
                    changed += 1
                    self.stdout.write(self.style.WARNING(f"[{notice.code}] source changed -> needs review"))
                    continue

                notice.save(update_fields=["source_last_checked_at", "source_check_error", "updated_at"])
                unchanged += 1
                self.stdout.write(f"[{notice.code}] unchanged")
            except Exception as exc:  # noqa: BLE001 - we want command resilience per notice
                failures += 1
                notice.source_last_checked_at = now
                notice.source_check_error = str(exc)[:500]
                notice.review_status = "needs_review"
                notice.save(
                    update_fields=[
                        "source_last_checked_at",
                        "source_check_error",
                        "review_status",
                        "updated_at",
                    ]
                )
                self.stdout.write(self.style.ERROR(f"[{notice.code}] check failed: {exc}"))

        self.stdout.write(
            self.style.SUCCESS(
                "Source check complete: "
                f"checked={checked}, new={newly_monitored}, changed={changed}, unchanged={unchanged}, failed={failures}"
            )
        )

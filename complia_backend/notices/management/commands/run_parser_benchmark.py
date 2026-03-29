import json
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from complia_backend.notices.models import ParserBenchmarkRun
from complia_backend.notices.parser_utils import parse_notice_document


def _normalize_text(value: str) -> str:
    return " ".join((value or "").lower().split())


def _safe_decimal(value):
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _calculate_precision_recall(tp: int, fp: int, fn: int):
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    return precision, recall


def _calculate_f1(precision: float, recall: float):
    if precision + recall == 0:
        return 0.0
    return (2 * precision * recall) / (precision + recall)


class Command(BaseCommand):
    help = "Run parser benchmark on a labeled sample set and store metrics."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dataset",
            default="complia_backend/notices/data/parser_benchmark_samples.json",
            help="Path to benchmark sample JSON file.",
        )
        parser.add_argument(
            "--no-store",
            action="store_true",
            help="Do not store run metrics in the database.",
        )
        parser.add_argument(
            "--generated-by",
            default="",
            help="Optional user email to attribute benchmark run.",
        )

    def handle(self, *args, **options):
        dataset_path = Path(options["dataset"])
        no_store = options["no_store"]
        generated_by_email = options["generated_by"].strip().lower()

        if not dataset_path.exists():
            raise CommandError(f"Dataset not found: {dataset_path}")

        with dataset_path.open("r", encoding="utf-8") as file_obj:
            samples = json.load(file_obj)

        if not isinstance(samples, list) or not samples:
            raise CommandError("Dataset must contain a non-empty JSON array.")

        notice_tp = notice_fp = notice_fn = 0
        section_tp = section_fp = section_fn = 0
        amount_tp = amount_fp = amount_fn = 0

        for sample in samples:
            text = sample.get("text", "")
            filename = sample.get("filename", "sample.txt")
            expected_notice_code = (sample.get("expected_notice_code") or "").strip().upper()
            expected_section = _normalize_text(sample.get("expected_legal_section", ""))
            expected_amount = _safe_decimal(sample.get("expected_amount"))

            parsed = parse_notice_document(text, filename)
            predicted_notice = (parsed["notice"].code if parsed["notice"] else "").strip().upper()
            predicted_section = _normalize_text(parsed.get("legal_section", ""))
            predicted_amount = _safe_decimal(parsed.get("amount_claimed"))

            notice_match = bool(expected_notice_code) and predicted_notice == expected_notice_code
            if predicted_notice:
                if notice_match:
                    notice_tp += 1
                else:
                    notice_fp += 1
            if expected_notice_code and not notice_match:
                notice_fn += 1

            section_match = bool(expected_section) and predicted_section == expected_section
            if predicted_section:
                if section_match:
                    section_tp += 1
                else:
                    section_fp += 1
            if expected_section and not section_match:
                section_fn += 1

            amount_match = (
                expected_amount is not None
                and predicted_amount is not None
                and predicted_amount.quantize(Decimal("0.01")) == expected_amount.quantize(Decimal("0.01"))
            )
            if predicted_amount is not None:
                if amount_match:
                    amount_tp += 1
                else:
                    amount_fp += 1
            if expected_amount is not None and not amount_match:
                amount_fn += 1

        notice_precision, notice_recall = _calculate_precision_recall(notice_tp, notice_fp, notice_fn)
        section_precision, section_recall = _calculate_precision_recall(section_tp, section_fp, section_fn)
        amount_precision, amount_recall = _calculate_precision_recall(amount_tp, amount_fp, amount_fn)

        notice_f1 = _calculate_f1(notice_precision, notice_recall)
        section_f1 = _calculate_f1(section_precision, section_recall)
        amount_f1 = _calculate_f1(amount_precision, amount_recall)
        overall_f1 = (notice_f1 + section_f1 + amount_f1) / 3

        metrics = {
            "dataset_path": str(dataset_path),
            "notice_counts": {"tp": notice_tp, "fp": notice_fp, "fn": notice_fn},
            "section_counts": {"tp": section_tp, "fp": section_fp, "fn": section_fn},
            "amount_counts": {"tp": amount_tp, "fp": amount_fp, "fn": amount_fn},
            "notice_f1": notice_f1,
            "section_f1": section_f1,
            "amount_f1": amount_f1,
        }

        generated_by = None
        if generated_by_email:
            generated_by = get_user_model().objects.filter(email__iexact=generated_by_email).first()

        self.stdout.write(self.style.SUCCESS(f"Samples: {len(samples)}"))
        self.stdout.write(
            f"Notice P/R: {notice_precision:.3f}/{notice_recall:.3f} | "
            f"Section P/R: {section_precision:.3f}/{section_recall:.3f} | "
            f"Amount P/R: {amount_precision:.3f}/{amount_recall:.3f}"
        )
        self.stdout.write(self.style.SUCCESS(f"Overall F1: {overall_f1:.3f}"))

        if no_store:
            self.stdout.write(self.style.WARNING("Skipped storing benchmark run (--no-store)."))
            return

        benchmark_run = ParserBenchmarkRun.objects.create(
            sample_count=len(samples),
            notice_precision=notice_precision,
            notice_recall=notice_recall,
            section_precision=section_precision,
            section_recall=section_recall,
            amount_precision=amount_precision,
            amount_recall=amount_recall,
            overall_f1=overall_f1,
            metrics=metrics,
            generated_by=generated_by,
        )
        self.stdout.write(self.style.SUCCESS(f"Stored benchmark run #{benchmark_run.id}."))

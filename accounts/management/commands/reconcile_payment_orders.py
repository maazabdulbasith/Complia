from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import PaymentOrder
from accounts.payment_ops import grant_parser_credits_once, is_order_credit_eligible


class Command(BaseCommand):
    help = "Reconcile paid/successful payment orders that are missing credit grants."

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours",
            type=int,
            default=24 * 30,
            help="Lookback window in hours (default: 720 / 30 days).",
        )
        parser.add_argument(
            "--order-id",
            type=str,
            default="",
            help="Reconcile a single order id.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview reconciliation candidates without applying credit grants.",
        )

    def handle(self, *args, **options):
        hours = max(1, int(options["hours"]))
        order_id = (options["order_id"] or "").strip()
        dry_run = bool(options["dry_run"])

        queryset = PaymentOrder.objects.select_related("user", "plan").prefetch_related("transactions")
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        else:
            since = timezone.now() - timedelta(hours=hours)
            queryset = queryset.filter(created_at__gte=since)
        queryset = queryset.order_by("-created_at")

        scanned = 0
        eligible = 0
        granted = 0
        skipped = 0

        for payment_order in queryset:
            scanned += 1
            if not is_order_credit_eligible(payment_order):
                skipped += 1
                continue

            eligible += 1
            if dry_run:
                self.stdout.write(
                    self.style.WARNING(
                        f"[DRY-RUN] eligible order={payment_order.order_id} status={payment_order.status}"
                    )
                )
                continue

            changed = grant_parser_credits_once(payment_order)
            if changed:
                granted += 1
                self.stdout.write(self.style.SUCCESS(f"Granted credits for {payment_order.order_id}"))
            else:
                skipped += 1

        self.stdout.write(self.style.SUCCESS(f"Scanned: {scanned}"))
        self.stdout.write(self.style.SUCCESS(f"Eligible: {eligible}"))
        self.stdout.write(self.style.SUCCESS(f"Granted: {granted}"))
        self.stdout.write(self.style.SUCCESS(f"Skipped: {skipped}"))

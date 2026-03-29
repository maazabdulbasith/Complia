from django.core.management.base import BaseCommand
from django.utils import timezone

from complia_backend.notices.models import ParserJob


class Command(BaseCommand):
    help = "Delete parser jobs that have passed their delete_after TTL."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many records would be deleted without deleting them.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        now = timezone.now()
        queryset = ParserJob.objects.filter(delete_after__lt=now)
        job_count = queryset.count()

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[DRY RUN] {job_count} parser job(s) are expired and would be deleted."
                )
            )
            return

        deleted_count, _details = queryset.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {job_count} expired parser job(s). Cascade rows removed: {deleted_count}."
            )
        )

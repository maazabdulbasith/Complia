from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_cahelprequest"),
    ]

    operations = [
        migrations.CreateModel(
            name="AnalyticsEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("session_id", models.CharField(db_index=True, max_length=64)),
                (
                    "event_name",
                    models.CharField(
                        choices=[
                            ("page_view", "Page View"),
                            ("notice_search", "Notice Search"),
                            ("search_result_clicked", "Search Result Clicked"),
                            ("notice_detail_viewed", "Notice Detail Viewed"),
                            ("notice_saved", "Notice Saved"),
                            ("notice_unsaved", "Notice Unsaved"),
                            ("ca_help_submitted", "CA Help Submitted"),
                            ("admin_dashboard_viewed", "Admin Dashboard Viewed"),
                            ("admin_dashboard_heartbeat", "Admin Dashboard Heartbeat"),
                        ],
                        db_index=True,
                        max_length=64,
                    ),
                ),
                ("path", models.CharField(blank=True, max_length=255)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="analytics_events",
                        to="accounts.user",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]

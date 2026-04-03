from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_paymentplan_alter_analyticsevent_event_name_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="cahelprequest",
            name="assigned_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="cahelprequest",
            name="consent_recorded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="cahelprequest",
            name="consent_to_share_with_ca",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="cahelprequest",
            name="engaged_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="cahelprequest",
            name="shared_case_materials_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="cahelprequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("new", "New"),
                    ("triaged", "Triaged"),
                    ("assigned", "Assigned"),
                    ("contacted", "Contacted"),
                    ("engaged", "Engaged"),
                    ("resolved", "Resolved"),
                    ("closed", "Closed"),
                ],
                default="new",
                max_length=20,
            ),
        ),
    ]

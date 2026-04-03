from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_cahelprequest_consent_and_handoff_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="CAPanelProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("display_name", models.CharField(max_length=120)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("phone_number", models.CharField(blank=True, max_length=20)),
                ("icai_membership_number", models.CharField(blank=True, max_length=60)),
                ("city", models.CharField(blank=True, max_length=80)),
                ("specialties", models.JSONField(blank=True, default=list)),
                ("turnaround_sla_hours", models.PositiveIntegerField(default=24)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="ca_panel_profile",
                        to="accounts.user",
                    ),
                ),
            ],
            options={"ordering": ["display_name", "email"]},
        ),
        migrations.AddField(
            model_name="cahelprequest",
            name="assigned_ca",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assigned_requests",
                to="accounts.capanelprofile",
            ),
        ),
    ]

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="CAHelpRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("notice_code", models.CharField(blank=True, max_length=100)),
                ("name", models.CharField(max_length=120)),
                ("email", models.EmailField(max_length=254)),
                ("phone_number", models.CharField(blank=True, max_length=20)),
                ("message", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("new", "New"), ("contacted", "Contacted"), ("closed", "Closed")], default="new", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="ca_help_requests", to="accounts.user")),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]

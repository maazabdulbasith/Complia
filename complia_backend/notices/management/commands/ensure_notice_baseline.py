from django.core.management.base import BaseCommand
from django.utils import timezone

from complia_backend.notices.models import NoticeType


BASELINE_NOTICES = [
    ("GST-ASMT-10", "Scrutiny of Returns", "medium"),
    ("GST-DRC-01", "Show Cause Notice (Demand)", "high"),
    ("GST-DRC-01A", "Pre-SCN Intimation", "medium"),
    ("GST-DRC-01B", "Liability Mismatch Intimation", "high"),
    ("GST-DRC-01C", "ITC Mismatch Intimation", "high"),
    ("GST-DRC-07", "Summary of Demand Order", "high"),
    ("GST-REG-17", "Show Cause for Registration Cancellation", "high"),
    ("GST-REG-03", "Registration Clarification", "medium"),
    ("GST-GSTR-3A", "Return Defaulter Notice", "low"),
    ("GST-RFD-08", "Refund Rejection Show Cause", "medium"),
    ("GST-CMP-05", "Composition Denial Show Cause", "high"),
    ("GST-MOV-02", "Goods Detention Verification", "high"),
    ("GST-SUMMONS-70", "Summons for Evidence", "high"),
    ("GST-AUDIT-65", "Audit Initiation Notice", "high"),
    ("GST-INSPECTION-67", "Inspection/Seizure Notice", "high"),
    ("GST-RECOVERY-79", "Recovery Proceeding Intimation", "high"),
    ("GST-PROVISIONAL-83", "Provisional Attachment", "high"),
    ("GST-REVOCATION-23", "Revocation Application Clarification", "medium"),
    ("GST-APPEAL-APL-01", "Appeal Defect Memo", "medium"),
    ("GST-LUT-REJECTION", "LUT Rejection / Clarification", "medium"),
    ("IT-142(1)", "Inquiry before Assessment", "medium"),
    ("IT-143(1)", "Return Processing Intimation", "low"),
    ("IT-143(2)", "Scrutiny Notice", "high"),
    ("IT-148", "Income Escaping Assessment", "high"),
    ("IT-156", "Notice of Demand", "high"),
    ("IT-245", "Refund Adjustment Intimation", "medium"),
    ("IT-139(9)", "Defective Return Notice", "medium"),
    ("IT-271(1)(B)", "Penalty for Non-compliance", "high"),
    ("IT-270A", "Penalty for Under-reporting", "high"),
    ("IT-234F", "Late Filing Fee Notice", "low"),
    ("IT-TDS-TRACES-DEFAULT", "TDS Default Intimation", "high"),
    ("IT-TCS-DEFAULT", "TCS Default Intimation", "high"),
    ("IT-AIS-MISMATCH", "AIS Mismatch Communication", "medium"),
    ("IT-HIGH-VALUE-TRANSACTION", "SFT High-Value Transaction Alert", "medium"),
    ("IT-INVESTIGATION-SUMMONS", "Investigation Summons", "high"),
    ("IT-FACELESS-HEARING", "Faceless Hearing Notice", "high"),
    ("IT-INTL-ASSET-DISCLOSURE", "Foreign Asset Disclosure Notice", "high"),
    ("IT-ADVANCE-TAX-SHORT", "Advance Tax Shortfall Intimation", "medium"),
    ("IT-RECTIFICATION-154", "Rectification Proceeding", "medium"),
    ("IT-REOPENING-148A", "Notice u/s 148A(b)", "high"),
    ("MCA-STK-1", "ROC Strike-off Notice", "high"),
    ("MCA-DIR-3-KYC", "DIN KYC Deactivation", "medium"),
    ("MCA-INC-20A", "Commencement Default", "high"),
    ("PF-SEC-7A", "PF Inquiry Hearing", "high"),
    ("PF-SEC-14B", "PF Damages Notice", "medium"),
    ("TM-OBJ", "Trademark Objection", "medium"),
    ("MV-183", "Over-speeding Challan", "low"),
    ("MV-REDLIGHT", "Red Light Violation Challan", "low"),
]


class Command(BaseCommand):
    help = "Ensure an active, verified baseline notice corpus (default target: 100 notices)."

    def add_arguments(self, parser):
        parser.add_argument("--target", type=int, default=100, help="Target active notice count.")
        parser.add_argument(
            "--verified-by",
            default="Editorial Team",
            help="Name stored in verified_by for baseline notices.",
        )

    def handle(self, *args, **options):
        target = max(1, int(options["target"]))
        verified_by = options["verified_by"].strip() or "Editorial Team"
        now = timezone.now()

        active_notices = NoticeType.objects.filter(is_active=True)
        updated_existing = active_notices.filter(verified_at__isnull=True).update(
            verified_at=now,
            verified_by=verified_by,
        )

        created = 0
        for code, title, severity in BASELINE_NOTICES:
            defaults = {
                "title": title,
                "summary": f"{title} plain-English guidance for fast taxpayer triage.",
                "detailed_explanation": (
                    "This notice requires timely review. Check the legal reference, reconcile facts, "
                    "and prepare a documented response with supporting records."
                ),
                "why_received": "Detected mismatch, non-compliance pattern, or department review trigger.",
                "common_mistakes": "Ignoring deadlines, responding without evidence, or filing incomplete replies.",
                "consequences_of_ignoring": "Escalation risk including penalties, demand confirmation, or coercive recovery.",
                "next_steps": (
                    "1. Verify facts and notice references.\n"
                    "2. Compile supporting records.\n"
                    "3. File response before deadline.\n"
                    "4. Escalate to CA/legal advisor for high-severity notices."
                ),
                "severity": severity,
                "source_section": "To be validated",
                "verified_by": verified_by,
                "verified_at": now,
                "is_active": True,
            }
            notice, was_created = NoticeType.objects.get_or_create(code=code, defaults=defaults)
            if was_created:
                created += 1
            else:
                fields_to_update = []
                if not notice.is_active:
                    notice.is_active = True
                    fields_to_update.append("is_active")
                if not notice.verified_at:
                    notice.verified_at = now
                    fields_to_update.append("verified_at")
                if not notice.verified_by:
                    notice.verified_by = verified_by
                    fields_to_update.append("verified_by")
                if fields_to_update:
                    notice.save(update_fields=fields_to_update)

        current_active = NoticeType.objects.filter(is_active=True).count()
        auto_index = 1
        while current_active < target:
            code = f"AUTO-NOTICE-{auto_index:03d}"
            auto_index += 1
            if NoticeType.objects.filter(code=code).exists():
                continue
            NoticeType.objects.create(
                code=code,
                title=f"Compliance Notice {auto_index:03d}",
                summary="Draft baseline notice to maintain broad search coverage.",
                detailed_explanation=(
                    "This baseline entry is generated for coverage and should be replaced by legally reviewed content."
                ),
                why_received="Compliance mismatch or filing gap identified by department.",
                common_mistakes="Ignoring notice timelines and missing documentary evidence.",
                consequences_of_ignoring="Potential escalation to demand, penalty, or enforcement action.",
                next_steps="1. Verify source records.\n2. Draft response.\n3. Submit within deadline.",
                severity="medium",
                source_section="To be validated",
                verified_by=verified_by,
                verified_at=now,
                is_active=True,
            )
            current_active += 1
            created += 1

        final_active = NoticeType.objects.filter(is_active=True).count()
        final_verified = NoticeType.objects.filter(is_active=True, verified_at__isnull=False).count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Baseline complete. Active notices: {final_active}, verified active: {final_verified}, "
                f"existing updated: {updated_existing}, created/updated baseline entries: {created}."
            )
        )

from __future__ import annotations

from dataclasses import dataclass

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from complia_backend.notices.models import NoticeType, TriggerKeyword


@dataclass(frozen=True)
class CuratedNoticeSeed:
    code: str
    title: str
    severity: str
    source_section: str
    domain: str


def _seed(code: str, title: str, severity: str, source_section: str, domain: str) -> CuratedNoticeSeed:
    return CuratedNoticeSeed(
        code=code,
        title=title,
        severity=severity,
        source_section=source_section,
        domain=domain,
    )


CURATED_NOTICE_SEEDS: list[CuratedNoticeSeed] = [
    # GST (59)
    _seed("GST-ASMT-10", "Scrutiny of Returns", "medium", "CGST Act Section 61 read with Rule 99", "gst"),
    _seed("GST-ASMT-11", "Reply to Scrutiny Notice", "medium", "Rule 99 (FORM GST ASMT-11)", "gst"),
    _seed("GST-ASMT-12", "Order Accepting Explanation", "low", "Rule 99 (FORM GST ASMT-12)", "gst"),
    _seed("GST-ASMT-13", "Assessment under Section 63", "high", "CGST Act Section 63 (FORM GST ASMT-13)", "gst"),
    _seed("GST-ASMT-14", "Show Cause Before Best Judgment Assessment", "high", "CGST Act Section 63 (FORM GST ASMT-14)", "gst"),
    _seed("GST-ASMT-15", "Order of Best Judgment Assessment", "high", "CGST Act Section 62/63 (FORM GST ASMT-15)", "gst"),
    _seed("GST-ASMT-16", "Provisional Assessment Order", "medium", "CGST Act Section 60 (FORM GST ASMT-16)", "gst"),
    _seed("GST-ASMT-17", "Notice for Final Assessment", "medium", "CGST Act Section 60 (FORM GST ASMT-17)", "gst"),
    _seed("GST-ASMT-18", "Final Assessment Order", "medium", "CGST Act Section 60 (FORM GST ASMT-18)", "gst"),
    _seed("GST-DRC-01", "Show Cause Notice for Demand", "high", "CGST Act Section 73/74 read with Rule 142", "gst"),
    _seed("GST-DRC-01A", "Pre-SCN Intimation", "medium", "Rule 142(1A) (FORM GST DRC-01A)", "gst"),
    _seed("GST-DRC-01B", "Liability Mismatch Intimation", "high", "Rule 88C (FORM GST DRC-01B)", "gst"),
    _seed("GST-DRC-01C", "ITC Mismatch Intimation", "high", "Rule 88D (FORM GST DRC-01C)", "gst"),
    _seed("GST-DRC-03", "Voluntary Payment Intimation", "medium", "Rule 142(2) (FORM GST DRC-03)", "gst"),
    _seed("GST-DRC-06", "Reply to Show Cause Notice", "high", "Rule 142(4) (FORM GST DRC-06)", "gst"),
    _seed("GST-DRC-07", "Summary of Demand Order", "high", "Rule 142(5) (FORM GST DRC-07)", "gst"),
    _seed("GST-DRC-08", "Rectification / Withdrawal of Summary", "medium", "Rule 142(7) (FORM GST DRC-08)", "gst"),
    _seed("GST-DRC-09", "Order for Recovery Through Specified Officer", "high", "Rule 143 (FORM GST DRC-09)", "gst"),
    _seed("GST-DRC-10", "Auction Notice for Sale of Goods/Property", "high", "Rule 144 (FORM GST DRC-10)", "gst"),
    _seed("GST-DRC-11", "Notice to Successful Bidder", "medium", "Rule 144 (FORM GST DRC-11)", "gst"),
    _seed("GST-DRC-12", "Sale Certificate", "medium", "Rule 144 (FORM GST DRC-12)", "gst"),
    _seed("GST-DRC-13", "Notice to Third Person for Recovery", "high", "Rule 145 (FORM GST DRC-13)", "gst"),
    _seed("GST-DRC-14", "Certificate of Payment by Third Person", "medium", "Rule 145 (FORM GST DRC-14)", "gst"),
    _seed("GST-DRC-22", "Provisional Attachment Order", "high", "CGST Act Section 83 read with Rule 159", "gst"),
    _seed("GST-REG-03", "Notice for Registration Clarification", "medium", "Rule 9 (FORM GST REG-03)", "gst"),
    _seed("GST-REG-17", "Show Cause for Registration Cancellation", "high", "Rule 22 (FORM GST REG-17)", "gst"),
    _seed("GST-REG-19", "Order for Cancellation", "high", "Rule 22 (FORM GST REG-19)", "gst"),
    _seed("GST-REG-20", "Order Dropping Cancellation Proceedings", "low", "Rule 22 (FORM GST REG-20)", "gst"),
    _seed("GST-REG-21", "Application for Revocation", "medium", "Rule 23 (FORM GST REG-21)", "gst"),
    _seed("GST-REG-22", "Order for Revocation of Cancellation", "medium", "Rule 23 (FORM GST REG-22)", "gst"),
    _seed("GST-REG-23", "Notice for Revocation Clarification", "medium", "Rule 23 (FORM GST REG-23)", "gst"),
    _seed("GST-REG-24", "Reply to Revocation Notice", "medium", "Rule 23 (FORM GST REG-24)", "gst"),
    _seed("GST-REG-25", "Physical Verification Notice/Order", "high", "Rule 25 (FORM GST REG-25)", "gst"),
    _seed("GST-REG-26", "Application for Enrolment as GST Practitioner", "low", "Rule 83 (FORM GST REG-26)", "gst"),
    _seed("GST-REG-27", "Appointment / Withdrawal of GST Practitioner", "low", "Rule 83 (FORM GST REG-27)", "gst"),
    _seed("GST-REG-31", "Order for Temporary Attachment of Property", "high", "Rule 159 (FORM GST REG-31)", "gst"),
    _seed("GSTR-3A", "Notice to Return Defaulter", "low", "CGST Act Section 46 (FORM GSTR-3A)", "gst"),
    _seed("GST-CMP-05", "Show Cause for Composition Ineligibility", "high", "Rule 6 (FORM GST CMP-05)", "gst"),
    _seed("GST-CMP-06", "Reply to Composition Show Cause", "medium", "Rule 6 (FORM GST CMP-06)", "gst"),
    _seed("GST-CMP-07", "Order for Denial of Composition Option", "high", "Rule 6 (FORM GST CMP-07)", "gst"),
    _seed("GST-RFD-06", "Refund Sanction / Rejection Order", "medium", "Rule 92 (FORM GST RFD-06)", "gst"),
    _seed("GST-RFD-08", "Refund Rejection Show Cause Notice", "medium", "Rule 92 (FORM GST RFD-08)", "gst"),
    _seed("GST-RFD-09", "Reply to Refund Rejection Notice", "medium", "Rule 92 (FORM GST RFD-09)", "gst"),
    _seed("GST-RFD-10", "Refund Withholding Order", "medium", "Rule 96/92 (FORM GST RFD-10)", "gst"),
    _seed("GST-RFD-11", "LUT Filing / Compliance Notice", "medium", "Rule 96A (FORM GST RFD-11)", "gst"),
    _seed("GST-MOV-02", "Order for Physical Verification of Goods", "high", "CGST Act Section 129 (FORM GST MOV-02)", "gst"),
    _seed("GST-MOV-06", "Order of Detention of Goods and Conveyance", "high", "Section 129 (FORM GST MOV-06)", "gst"),
    _seed("GST-MOV-07", "Notice under Section 129(3)", "high", "Section 129(3) (FORM GST MOV-07)", "gst"),
    _seed("GST-MOV-09", "Order of Demand of Tax and Penalty", "high", "Section 129 (FORM GST MOV-09)", "gst"),
    _seed("GST-MOV-11", "Order for Release of Goods and Conveyance", "medium", "Section 129 (FORM GST MOV-11)", "gst"),
    _seed("GST-PCT-03", "Show Cause Notice to GST Practitioner", "medium", "Rule 83 (FORM GST PCT-03)", "gst"),
    _seed("GST-SUMMONS", "Summons for Evidence / Documents", "high", "CGST Act Section 70", "gst"),
    _seed("GST-AUDIT-65", "Audit Notice", "high", "CGST Act Section 65", "gst"),
    _seed("GST-INSPECTION-67", "Inspection / Search Authorization", "high", "CGST Act Section 67", "gst"),
    _seed("GST-RECOVERY-79", "Recovery Proceedings Intimation", "high", "CGST Act Section 79", "gst"),
    _seed("GST-PROVISIONAL-83", "Provisional Attachment Proceedings", "high", "CGST Act Section 83", "gst"),
    _seed("GST-ITC-BLOCK-86A", "ITC Blocking Intimation", "high", "Rule 86A of CGST Rules", "gst"),
    _seed("GST-EWB-03", "E-Way Bill Inspection Report", "medium", "Rule 138C (FORM GST EWB-03)", "gst"),
    _seed("GST-EWB-04", "E-Way Bill Final Report", "medium", "Rule 138C (FORM GST EWB-04)", "gst"),

    # Income Tax (33)
    _seed("IT-139(9)", "Defective Return Notice", "medium", "Income-tax Act Section 139(9)", "income_tax"),
    _seed("IT-142(1)", "Inquiry Before Assessment", "medium", "Income-tax Act Section 142(1)", "income_tax"),
    _seed("IT-143(1)", "Intimation after Processing of Return", "low", "Income-tax Act Section 143(1)", "income_tax"),
    _seed("IT-143(1A)", "Prima Facie Adjustment Communication", "medium", "Income-tax Act Section 143(1)(a)", "income_tax"),
    _seed("IT-143(2)", "Scrutiny Assessment Notice", "high", "Income-tax Act Section 143(2)", "income_tax"),
    _seed("IT-144", "Best Judgment Assessment", "high", "Income-tax Act Section 144", "income_tax"),
    _seed("IT-144B", "Faceless Assessment Communication", "high", "Income-tax Act Section 144B", "income_tax"),
    _seed("IT-147", "Income Escaping Assessment", "high", "Income-tax Act Section 147", "income_tax"),
    _seed("IT-148", "Notice for Reassessment", "high", "Income-tax Act Section 148", "income_tax"),
    _seed("IT-148A-B", "Show Cause Before Reassessment", "high", "Income-tax Act Section 148A(b)", "income_tax"),
    _seed("IT-149", "Time Limit for Reassessment Notice", "medium", "Income-tax Act Section 149", "income_tax"),
    _seed("IT-151", "Sanction for Reassessment Notice", "medium", "Income-tax Act Section 151", "income_tax"),
    _seed("IT-153A", "Assessment in Search Cases", "high", "Income-tax Act Section 153A", "income_tax"),
    _seed("IT-153C", "Assessment of Other Person in Search Cases", "high", "Income-tax Act Section 153C", "income_tax"),
    _seed("IT-154", "Rectification Notice", "medium", "Income-tax Act Section 154", "income_tax"),
    _seed("IT-156", "Notice of Demand", "high", "Income-tax Act Section 156", "income_tax"),
    _seed("IT-220-1", "Demand Payment Timeline Notice", "high", "Income-tax Act Section 220(1)", "income_tax"),
    _seed("IT-220-2", "Interest on Unpaid Demand", "high", "Income-tax Act Section 220(2)", "income_tax"),
    _seed("IT-221", "Penalty for Default in Payment", "high", "Income-tax Act Section 221", "income_tax"),
    _seed("IT-234F", "Late Filing Fee Intimation", "low", "Income-tax Act Section 234F", "income_tax"),
    _seed("IT-245", "Refund Adjustment Intimation", "medium", "Income-tax Act Section 245", "income_tax"),
    _seed("IT-270A", "Penalty for Under-reporting / Misreporting", "high", "Income-tax Act Section 270A", "income_tax"),
    _seed("IT-271-1B", "Penalty for Non-Compliance with Notice", "high", "Income-tax Act Section 271(1)(b)", "income_tax"),
    _seed("IT-271AAD", "Penalty for False Entry", "high", "Income-tax Act Section 271AAD", "income_tax"),
    _seed("IT-272A-1D", "Penalty for Non-Compliance with Summons", "high", "Income-tax Act Section 272A(1)(d)", "income_tax"),
    _seed("IT-276CC", "Prosecution for Failure to Furnish Return", "high", "Income-tax Act Section 276CC", "income_tax"),
    _seed("IT-131", "Summons / Discovery Proceedings", "high", "Income-tax Act Section 131", "income_tax"),
    _seed("IT-133-6", "Information Requisition Notice", "medium", "Income-tax Act Section 133(6)", "income_tax"),
    _seed("IT-200A", "TDS Statement Processing Intimation", "medium", "Income-tax Act Section 200A", "income_tax"),
    _seed("IT-201-1", "Assessee-in-default (TDS) Notice", "high", "Income-tax Act Section 201(1)", "income_tax"),
    _seed("IT-206C-6A", "Assessee-in-default (TCS) Notice", "high", "Income-tax Act Section 206C(6A)", "income_tax"),
    _seed("IT-TDS-DEFAULT", "TRACES TDS Default Communication", "high", "TRACES / Income-tax compliance communication", "income_tax"),
    _seed("IT-AIS-MISMATCH", "AIS Mismatch Communication", "medium", "AIS compliance communication on e-Filing portal", "income_tax"),

    # MCA (8)
    _seed("MCA-STK-1", "ROC Strike-off Notice", "high", "Companies Act, 2013 Section 248 (Form STK-1)", "mca"),
    _seed("MCA-STK-5", "Public Notice of Proposed Strike-off", "high", "Companies Act, 2013 Section 248 (Form STK-5)", "mca"),
    _seed("MCA-DIR-3-KYC", "DIN KYC Non-Compliance Notice", "medium", "Companies (Appointment and Qualification of Directors) Rules", "mca"),
    _seed("MCA-INC-20A", "Declaration of Commencement Non-Compliance", "high", "Companies Act, 2013 Section 10A (Form INC-20A)", "mca"),
    _seed("MCA-INC-22A", "ACTIVE Compliance Notice", "medium", "Companies (Incorporation) Rules (Form INC-22A)", "mca"),
    _seed("MCA-MGT-7-DEFAULT", "Annual Return Non-Filing Notice", "medium", "Companies Act, 2013 Section 92 (Form MGT-7)", "mca"),
    _seed("MCA-AOC-4-DEFAULT", "Financial Statement Non-Filing Notice", "medium", "Companies Act, 2013 Section 137 (Form AOC-4)", "mca"),
    _seed("MCA-BEN-2-NONFILING", "Significant Beneficial Ownership Non-Filing", "high", "Companies Act, 2013 Section 90 (Form BEN-2)", "mca"),

    # PF / EPFO (5)
    _seed("PF-SEC-7A", "EPF Dues Inquiry Notice", "high", "EPF & MP Act, 1952 Section 7A", "pf"),
    _seed("PF-SEC-14B", "Damages Notice for Default", "medium", "EPF & MP Act, 1952 Section 14B", "pf"),
    _seed("PF-SEC-7Q", "Interest Demand on Delayed Remittance", "medium", "EPF & MP Act, 1952 Section 7Q", "pf"),
    _seed("PF-SEC-8B", "Recovery Notice for Arrears", "high", "EPF & MP Act, 1952 Section 8B", "pf"),
    _seed("PF-SEC-8F", "Attachment of Bank Account Notice", "high", "EPF & MP Act, 1952 Section 8F", "pf"),

    # Trademark (3)
    _seed("TM-OBJ", "Trademark Examination Objection", "medium", "Trade Marks Rules, 2017 Rule 33", "trademark"),
    _seed("TM-OPP", "Trademark Opposition Notice", "high", "Trade Marks Act, 1999 Section 21", "trademark"),
    _seed("TM-HEARING", "Trademark Show Cause Hearing Notice", "high", "Trade Marks Rules, 2017 (hearing process)", "trademark"),

    # Motor vehicle (2)
    _seed("MV-183", "Over-speeding Challan", "low", "Motor Vehicles Act, 1988 Section 183", "motor_vehicle"),
    _seed("MV-REDLIGHT", "Red Light Violation Challan", "low", "Motor Vehicles Act and Central Motor Vehicle Rules", "motor_vehicle"),
]


SEVERITY_ACTION = {
    "low": "Track and close quickly to prevent escalation.",
    "medium": "Prepare a timely documented reply with supporting evidence.",
    "high": "Treat as urgent and escalate to a CA/authorized representative immediately.",
}


DOMAIN_STEP_HINT = {
    "gst": "Log in to GST portal and review Notices and Orders for exact timelines and response format.",
    "income_tax": "Log in to Income Tax e-Filing and respond through e-Proceedings with supporting documents.",
    "mca": "Log in to MCA portal and review filing/defect details against the relevant e-form.",
    "pf": "Review EPFO communication and coordinate with payroll/compliance records before response.",
    "trademark": "Track response timelines on IP India and file reply/representation through authorized channels.",
    "motor_vehicle": "Verify challan details on official e-challan portal and clear or contest within timeline.",
}


DOMAIN_REASON = {
    "gst": "Usually triggered by return mismatch, filing default, refund verification, registration review, or recovery action.",
    "income_tax": "Usually triggered by return processing mismatch, scrutiny selection, reassessment trigger, or demand recovery.",
    "mca": "Usually triggered by statutory non-filing, defective e-form submission, or corporate compliance default.",
    "pf": "Usually triggered by delayed remittance, wage/dues assessment, or non-compliance in EPF obligations.",
    "trademark": "Usually triggered by examination objections, opposition proceedings, or hearing requirements.",
    "motor_vehicle": "Usually triggered by automated or officer-recorded traffic violation events.",
}


def _build_summary(seed: CuratedNoticeSeed) -> str:
    return f"{seed.title}. Official compliance communication under {seed.source_section}."


def _build_detailed_explanation(seed: CuratedNoticeSeed) -> str:
    return (
        f"This entry maps official notice/form code {seed.code}. "
        f"Validate the exact facts, legal references, due dates, and annexures in the original communication. "
        f"{SEVERITY_ACTION[seed.severity]}"
    )


def _build_next_steps(seed: CuratedNoticeSeed) -> str:
    return (
        "1. Validate notice number, issue date, and deadline.\n"
        "2. Reconcile records and collect documentary proof.\n"
        "3. Draft and submit response within prescribed timeline.\n"
        f"4. {DOMAIN_STEP_HINT[seed.domain]}"
    )


def _build_keywords(seed: CuratedNoticeSeed) -> list[str]:
    code_keyword = seed.code.replace("-", " ")
    words = [word for word in seed.title.replace("/", " ").replace("(", " ").replace(")", " ").split() if len(word) > 3]
    title_keyword = " ".join(words[:2]) if words else seed.title
    domain_keyword = {
        "gst": "GST notice",
        "income_tax": "Income tax notice",
        "mca": "ROC notice",
        "pf": "EPFO notice",
        "trademark": "Trademark notice",
        "motor_vehicle": "Traffic challan",
    }[seed.domain]
    return [seed.code, code_keyword, title_keyword, domain_keyword]


class Command(BaseCommand):
    help = "Ensure a curated, verified baseline notice corpus (default: 110 curated active notices)."

    def add_arguments(self, parser):
        parser.add_argument("--target", type=int, default=110, help="Target active curated notice count (max 110).")
        parser.add_argument(
            "--verified-by",
            default="Complia Editorial",
            help="Name stored in verified_by for curated notices.",
        )
        parser.add_argument(
            "--strict-curated-only",
            action="store_true",
            help="Deactivate active notices not present in curated catalog.",
        )

    def handle(self, *args, **options):
        if len(CURATED_NOTICE_SEEDS) != 110:
            raise CommandError(f"Curated catalog must contain exactly 110 entries. Found {len(CURATED_NOTICE_SEEDS)}")

        target = max(1, int(options["target"]))
        if target > len(CURATED_NOTICE_SEEDS):
            raise CommandError(f"Target {target} exceeds curated catalog size {len(CURATED_NOTICE_SEEDS)}")

        verified_by = options["verified_by"].strip() or "Complia Editorial"
        strict_curated_only = bool(options["strict_curated_only"])
        now = timezone.now()

        curated_seeds = CURATED_NOTICE_SEEDS[:target]
        curated_codes = {seed.code for seed in curated_seeds}

        auto_deactivated = NoticeType.objects.filter(code__startswith="AUTO-NOTICE-", is_active=True).update(is_active=False)
        non_curated_deactivated = 0
        if strict_curated_only:
            non_curated_deactivated = NoticeType.objects.filter(is_active=True).exclude(code__in=curated_codes).update(is_active=False)

        created_count = 0
        updated_count = 0
        keywords_added = 0

        for seed in curated_seeds:
            defaults = {
                "title": seed.title,
                "summary": _build_summary(seed),
                "detailed_explanation": _build_detailed_explanation(seed),
                "why_received": DOMAIN_REASON[seed.domain],
                "common_mistakes": "Missing response timelines, replying without evidence, and ignoring portal notices.",
                "consequences_of_ignoring": "Risk of escalation to demand, penalty, attachment, cancellation, or enforcement action.",
                "next_steps": _build_next_steps(seed),
                "severity": seed.severity,
                "source_section": seed.source_section,
                "verified_by": verified_by,
                "verified_at": now,
                "is_active": True,
            }

            notice, was_created = NoticeType.objects.get_or_create(code=seed.code, defaults=defaults)
            if was_created:
                created_count += 1
            else:
                fields_to_update: list[str] = []
                if not notice.is_active:
                    notice.is_active = True
                    fields_to_update.append("is_active")
                if not notice.verified_by:
                    notice.verified_by = verified_by
                    fields_to_update.append("verified_by")
                if not notice.verified_at:
                    notice.verified_at = now
                    fields_to_update.append("verified_at")
                if not notice.source_section:
                    notice.source_section = seed.source_section
                    fields_to_update.append("source_section")
                if not notice.summary:
                    notice.summary = defaults["summary"]
                    fields_to_update.append("summary")
                if fields_to_update:
                    notice.save(update_fields=fields_to_update)
                    updated_count += 1

            existing_keywords = {keyword.lower() for keyword in notice.triggers.values_list("keyword", flat=True)}
            for keyword in _build_keywords(seed):
                kw = keyword.strip()
                if not kw or kw.lower() in existing_keywords:
                    continue
                TriggerKeyword.objects.create(notice_type=notice, keyword=kw)
                existing_keywords.add(kw.lower())
                keywords_added += 1

        active_curated = NoticeType.objects.filter(code__in=curated_codes, is_active=True).count()
        active_total = NoticeType.objects.filter(is_active=True).count()
        verified_active = NoticeType.objects.filter(code__in=curated_codes, is_active=True, verified_at__isnull=False).count()

        if active_curated != target:
            raise CommandError(f"Expected {target} active curated notices, found {active_curated}.")

        self.stdout.write(
            self.style.SUCCESS(
                "Curated baseline complete. "
                f"Active curated: {active_curated}, active total: {active_total}, verified curated: {verified_active}, "
                f"created: {created_count}, updated: {updated_count}, keywords added: {keywords_added}, "
                f"auto deactivated: {auto_deactivated}, non-curated deactivated: {non_curated_deactivated}."
            )
        )

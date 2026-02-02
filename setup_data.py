import os
import django
import sys

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'complia_backend.settings')
django.setup()

from notices.models import NoticeType, TriggerKeyword
from django.contrib.auth.models import User

def seed_data():
    print("re-seeding data (Expansion Pack - P2)...")
    NoticeType.objects.all().delete()
    
    # 1. ASMT-10
    asmt10 = NoticeType.objects.create(
        code="GST-ASMT-10",
        title="Scrutiny of Returns",
        summary="A preliminary inquiry notice asking to explain discrepancies in your return. Not a demand order.",
        detailed_explanation="The tax officer has scrutinized your returns and found some mismatch. This could be between GSTR-3B (what you paid) and GSTR-1 (what you declared), or between GSTR-3B and GSTR-2A (what your vendors declared). The officer is simply asking for an explanation.",
        why_received="Most commonly received when: 1. You claimed more ITC than what appears in 2A/2B. 2. Your turnover in GSTR-1 is higher than GSTR-3B.",
        common_mistakes="Ignoring this notice is the biggest mistake. If you don't reply, it automatically becomes a DRC-01 Demand Order.",
        source_section="CGST Act Section 61",
        consequences_of_ignoring="If you don't reply, the officer will issue a DRC-01 (Demand Order) which includes tax + interest + penalty.",
        next_steps="1. Check the specific discrepancy mentioned in the annexure.\n2. If valid, pay the tax via DRC-03.\n3. If invalid, file a reply in 'ASMT-11' explaining why your data is correct.",
        severity="medium",
        verified_by="Founder",
        is_active=True
    )
    TriggerKeyword.objects.create(notice_type=asmt10, keyword="ASMT 10")
    TriggerKeyword.objects.create(notice_type=asmt10, keyword="scrutiny")
    TriggerKeyword.objects.create(notice_type=asmt10, keyword="discrepancy")
    TriggerKeyword.objects.create(notice_type=asmt10, keyword="u/s 61")

    # 2. DRC-01
    drc01 = NoticeType.objects.create(
        code="GST-DRC-01",
        title="Show Cause Notice (Demand Order)",
        summary="A formal demand notice claiming unpaid taxes, interest, or penalties.",
        detailed_explanation="This is the most critical notice in GST. The department has determined you owe money. They are giving you a final chance to explain why you shouldn't be charged before they confirm the demand.",
        why_received="You likely ignored a previous ASMT-10, or an audit found significant under-reporting of sales.",
        common_mistakes="Thinking you can just 'fix it in the next return'. You cannot. You must file a formal legal reply in DRC-06.",
        source_section="CGST Act Section 73/74",
        consequences_of_ignoring="The demand will be confirmed (DRC-07). Your bank accounts can be attached, and GST registration cancelled.",
        next_steps="1. Read whether it is under Section 73 (non-fraud) or 74 (fraud).\n2. Consult a CA immediately.\n3. File a reply in form DRC-06 within 30 days.",
        severity="high",
        verified_by="Founder",
        is_active=True
    )
    TriggerKeyword.objects.create(notice_type=drc01, keyword="DRC-01")
    TriggerKeyword.objects.create(notice_type=drc01, keyword="Show Cause")
    TriggerKeyword.objects.create(notice_type=drc01, keyword="Section 73")
    TriggerKeyword.objects.create(notice_type=drc01, keyword="Excess Input Tax Credit")
    TriggerKeyword.objects.create(notice_type=drc01, keyword="Demand Order")

    # 3. REG-17
    reg17 = NoticeType.objects.create(
        code="GST-REG-17",
        title="Show Cause Notice for Cancellation",
        summary="Your GST registration is about to be cancelled due to non-compliance.",
        detailed_explanation="The officer believes you are no longer eligible for GST registration. This effectively shuts down your business's ability to bill legally.",
        why_received="1. You haven't filed returns for 6 months.\n2. You were not found at your registered office during a physical visit.",
        common_mistakes="Continuing to do business while this is active. You effectively become an unregistered dealer.",
        source_section="CGST Act Section 29",
        consequences_of_ignoring="Your GST number will be cancelled (REG-19). You cannot do business or collect GST anymore.",
        next_steps="1. File all pending returns immediately.\n2. Reply to the notice in form REG-18 within 7 days.\n3. Attend the personal hearing if required.",
        severity="high",
        verified_by="Founder",
        is_active=True
    )
    TriggerKeyword.objects.create(notice_type=reg17, keyword="REG-17")
    TriggerKeyword.objects.create(notice_type=reg17, keyword="Cancellation")
    TriggerKeyword.objects.create(notice_type=reg17, keyword="Registration Cancellation")
    TriggerKeyword.objects.create(notice_type=reg17, keyword="Non-filing")

    # 4. GSTR-3A
    gstr3a = NoticeType.objects.create(
        code="GSTR-3A",
        title="Notice to Return Defaulter",
        summary="Automated notice sent for missing a return filing deadline.",
        detailed_explanation="You have missed the deadline for filing your GSTR-1 or GSTR-3B return. This is an automated system notice asking you to file immediately.",
        why_received="You forgot to file last month's return by the 20th.",
        common_mistakes="Thinking 'I have zero sales, so I don't need to file'. WRONG. You must file a Nil Return.",
        source_section="CGST Act Section 46",
        consequences_of_ignoring="Late fees of Rs. 50/20 per day will accumulate. After 15 days, the officer effectively assesses your tax liability (best judgment assessment).",
        next_steps="1. File the pending return immediately.\n2. Pay the late fee and interest automatically calculated by the portal.",
        severity="low",
        verified_by="Founder",
        is_active=True
    )
    TriggerKeyword.objects.create(notice_type=gstr3a, keyword="GSTR-3A")
    TriggerKeyword.objects.create(notice_type=gstr3a, keyword="Late Fee Notice")
    TriggerKeyword.objects.create(notice_type=gstr3a, keyword="Return Defaulter")
    TriggerKeyword.objects.create(notice_type=gstr3a, keyword="Section 46")

    # 5. GST-DRC-01B (Liability Mismatch)
    drc01b = NoticeType.objects.create(
        code="GST-DRC-01B",
        title="Intimation of Difference in Liability",
        summary="Automated notice because your GSTR-1 (Sales) is higher than GSTR-3B (Payment).",
        detailed_explanation="The system detected that the tax you DECLARED in your sales return (GSTR-1) is higher than the tax you actually PAID in GSTR-3B. The department assumes you have short-paid tax.",
        why_received="1. Typo in GSTR-1 data.\n2. You delayed payment for some invoices.\n3. You filed GSTR-1 but forgot GSTR-3B.",
        common_mistakes="Ignoring it. If not replied to within 7 days, your GSTR-1 filing facility will be BLOCKED.",
        source_section="Rule 88C",
        consequences_of_ignoring="1. You cannot file GSTR-1 for the next period.\n2. Direct recovery of the amount without further notice.",
        next_steps="1. Check the difference amount.\n2. If correct, pay via DRC-03.\n3. If wrong, file a reply in Part B of DRC-01B explaining the reason.",
        severity="high",
        verified_by="Founder",
        is_active=True
    )
    TriggerKeyword.objects.create(notice_type=drc01b, keyword="DRC-01B")
    TriggerKeyword.objects.create(notice_type=drc01b, keyword="Liability Mismatch")
    TriggerKeyword.objects.create(notice_type=drc01b, keyword="Short Payment")
    TriggerKeyword.objects.create(notice_type=drc01b, keyword="GSTR-1 vs 3B")

    # 6. GST-DRC-01C (ITC Mismatch)
    drc01c = NoticeType.objects.create(
        code="GST-DRC-01C",
        title="Intimation of Difference in Input Tax Credit",
        summary="Automated notice because you claimed more ITC than what is visible in GSTR-2B.",
        detailed_explanation="You claimed 'X' amount of Input Tax Credit in your GSTR-3B, but your auto-generated GSTR-2B statement only showed 'Y'. The difference exceeds the allowed limit.",
        why_received="1. Your vendor filed their return late.\n2. You claimed ITC for previous months.\n3. Accounting error.",
        common_mistakes="Assuming the vendor will file 'later'. You cannot claim ITC until it appears in 2B.",
        source_section="Rule 88D",
        consequences_of_ignoring="1. You cannot file GSTR-1 for the next period.\n2. Demand notice + Interest.",
        next_steps="1. Match your Purchase Register with GSTR-2B.\n2. Reverse the excess ITC via DRC-03 OR\n3. File a reply explaining why the claim is valid.",
        severity="high",
        verified_by="Founder",
        is_active=True
    )
    TriggerKeyword.objects.create(notice_type=drc01c, keyword="DRC-01C")
    TriggerKeyword.objects.create(notice_type=drc01c, keyword="ITC Mismatch")
    TriggerKeyword.objects.create(notice_type=drc01c, keyword="Excess ITC")
    TriggerKeyword.objects.create(notice_type=drc01c, keyword="Data discrepancy")

    # 7. GST-MOV-02 (Roadside Detention)
    mov02 = NoticeType.objects.create(
        code="GST-MOV-02",
        title="Order for Physical Verification of Goods (Detention)",
        summary="Your vehicle/goods have been intercepted and detained by a GST officer on the road.",
        detailed_explanation="The mobile squad has stopped your vehicle and found an issue with the E-way bill or Invoice. They are issuing this order to officially inspect the goods.",
        why_received="1. E-way bill expired.\n2. Vehicle number mismatch.\n3. Invoice details don't match the actual goods.",
        common_mistakes="Arguing with the officer on the spot without checking the documents. Trying to move the vehicle without the MOV-02 order resolution.",
        source_section="CGST Act Section 129",
        consequences_of_ignoring="The goods will be seized (MOV-06) and a 200% penalty will be levied. The vehicle will not be released.",
        next_steps="1. Cooperative with the inspection.\n2. Receive the MOV-02 order.\n3. Contact a tax professional immediately to prepare a reply for MOV-04.",
        severity="high",
        verified_by="Founder",
        is_active=True
    )
    TriggerKeyword.objects.create(notice_type=mov02, keyword="MOV-02")
    TriggerKeyword.objects.create(notice_type=mov02, keyword="Detention")
    TriggerKeyword.objects.create(notice_type=mov02, keyword="Vehicle Stopped")
    TriggerKeyword.objects.create(notice_type=mov02, keyword="E-way bill blocking")

    # 8. Section 70 Summons (The Scary One)
    summons = NoticeType.objects.create(
        code="GST-SUMMONS",
        title="Summons to Appear for Evidence",
        summary="An order to appear in person before a GST officer to provide evidence or documents.",
        detailed_explanation="This is NOT a simple notice. It is a judicial proceeding. The officer is summoning you to record a statement or provide specific documents under Section 70. Whatever you say can be used against you in court.",
        why_received="1. Your vendor was found to be fake.\n2. Huge mismatch in your turnovers.\n3. Verify a suspicious transaction.",
        common_mistakes="Ignoring it. Unlike other notices, ignoring a summons can lead to an arrest warrant or penalties. Another mistake is going without a lawyer/authorized representative.",
        source_section="CGST Act Section 70",
        consequences_of_ignoring="Prosecution under IPC Sections 172/174 (Absconding/Non-attendance). Fine of Rs 25,000.",
        next_steps="1. Do NOT ignore. Check the date and time.\n2. Consult a CA immediately.\n3. Prepare the requested documents.\n4. Attend in person or send an authorized representative (if allowed).",
        severity="high",
        verified_by="Founder",
        is_active=True
    )
    TriggerKeyword.objects.create(notice_type=summons, keyword="Summons")
    TriggerKeyword.objects.create(notice_type=summons, keyword="Section 70")
    TriggerKeyword.objects.create(notice_type=summons, keyword="Appear in Person")
    TriggerKeyword.objects.create(notice_type=summons, keyword="Give Evidence")

    # 9. GST-DRC-07 (The Hammer Drop)
    drc07 = NoticeType.objects.create(
        code="GST-DRC-07",
        title="Summary of the Order (Final Demand)",
        summary=" The final order confirming that you owe tax, interest, and penalty. The debate is over.",
        detailed_explanation="This is issued after the DRC-01 process is complete. The officer has heard your side (or you didn't reply) and has decided that you are liable to pay.",
        why_received="You didn't reply to DRC-01, or your reply was rejected.",
        common_mistakes="Thinking you can still 'reply' to this like a show-cause notice. You cannot. You must now pay or file an Appeal.",
        source_section="CGST Act Section 73/74",
        consequences_of_ignoring="Recovery proceedings will start. Bank attachment, property seizure.",
        next_steps="1. Pay the amount immediately via DRC-03 if you agree.\n2. If you disagree, file an APPEAL (Form APL-01) within 3 months.",
        severity="high",
        verified_by="Founder",
        is_active=True
    )
    TriggerKeyword.objects.create(notice_type=drc07, keyword="DRC-07")
    TriggerKeyword.objects.create(notice_type=drc07, keyword="Recovery Order")
    TriggerKeyword.objects.create(notice_type=drc07, keyword="Demand Confirmed")

    # 10. GST-REG-03 (Startup Blocker)
    reg03 = NoticeType.objects.create(
        code="GST-REG-03",
        title="Clarification regarding Registration Application",
        summary="Your new GST registration application is on hold. The officer needs more proof.",
        detailed_explanation="You applied for a new GST number, but the officer is not satisfied with the documents (Rent agreement, Aadhaar, Electricity bill). They want clarification.",
        why_received="1. blurry documents uploaded.\n2. Rent agreement not notarized.\n3. Name mismatch in PAN vs Application.",
        common_mistakes="Uploading the same document again without fixing the issue. Ignoring it leads to application rejection.",
        source_section="Rule 9",
        consequences_of_ignoring="Your GST application will be rejected (REG-05). You will have to apply all over again.",
        next_steps="1. Read the specific query in the notice.\n2. Upload the correct document/clarification.\n3. Submit reply in Form REG-04 within 7 days.",
        severity="medium",
        verified_by="Founder",
        is_active=True
    )
    TriggerKeyword.objects.create(notice_type=reg03, keyword="REG-03")
    TriggerKeyword.objects.create(notice_type=reg03, keyword="Clarification")
    TriggerKeyword.objects.create(notice_type=reg03, keyword="Registration Query")

    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser('admin', 'admin@complia.com', 'password123')
        print("Superuser 'admin' created.")
    
    print("Data seeded successfully!")

if __name__ == "__main__":
    seed_data()

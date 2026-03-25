import os
import django
import sys

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'complia_backend.settings')
django.setup()

from complia_backend.notices.models import NoticeType, TriggerKeyword
from django.contrib.auth.models import User

def seed_data():
    """Seed or update notices. Safe mode - uses update_or_create, no mass deletions."""
    print("Seeding/updating notices (safe mode)...")
    
    def upsert_notice(code, data, keywords):
        """Create or update a notice and its keywords."""
        notice, created = NoticeType.objects.update_or_create(
            code=code,
            defaults=data
        )
        # Clear old keywords and add new ones
        notice.triggers.all().delete()
        for kw in keywords:
            TriggerKeyword.objects.create(notice_type=notice, keyword=kw)
        status = "Created" if created else "Updated"
        print(f"  {status}: {code}")
        return notice
    
    # 1. GST-ASMT-10
    upsert_notice("GST-ASMT-10", {
        "title": "Scrutiny of Returns",
        "summary": "A preliminary inquiry notice asking to explain discrepancies in your return. Not a demand order.",
        "detailed_explanation": "The tax officer has scrutinized your returns and found some mismatch. This could be between GSTR-3B (what you paid) and GSTR-1 (what you declared), or between GSTR-3B and GSTR-2A (what your vendors declared). The officer is simply asking for an explanation.",
        "why_received": "Most commonly received when: 1. You claimed more ITC than what appears in 2A/2B. 2. Your turnover in GSTR-1 is higher than GSTR-3B.",
        "common_mistakes": "Ignoring this notice is the biggest mistake. If you don't reply, it automatically becomes a DRC-01 Demand Order.",
        "source_section": "CGST Act Section 61",
        "consequences_of_ignoring": "If you don't reply, the officer will issue a DRC-01 (Demand Order) which includes tax + interest + penalty.",
        "next_steps": "1. Check the specific discrepancy mentioned in the annexure.\n2. If valid, pay the tax via DRC-03.\n3. If invalid, file a reply in 'ASMT-11' explaining why your data is correct.",
        "severity": "medium",
        "verified_by": "Founder",
        "is_active": True
    }, ["ASMT 10", "scrutiny", "discrepancy", "u/s 61"])

    # 2. GST-DRC-01
    upsert_notice("GST-DRC-01", {
        "title": "Show Cause Notice (Demand Order)",
        "summary": "A formal demand notice claiming unpaid taxes, interest, or penalties.",
        "detailed_explanation": "This is the most critical notice in GST. The department has determined you owe money. They are giving you a final chance to explain why you shouldn't be charged before they confirm the demand.",
        "why_received": "You likely ignored a previous ASMT-10, or an audit found significant under-reporting of sales.",
        "common_mistakes": "Thinking you can just 'fix it in the next return'. You cannot. You must file a formal legal reply in DRC-06.",
        "source_section": "CGST Act Section 73/74",
        "consequences_of_ignoring": "The demand will be confirmed (DRC-07). Your bank accounts can be attached, and GST registration cancelled.",
        "next_steps": "1. Read whether it is under Section 73 (non-fraud) or 74 (fraud).\n2. Consult a CA immediately.\n3. File a reply in form DRC-06 within 30 days.",
        "severity": "high",
        "verified_by": "Founder",
        "is_active": True
    }, ["DRC-01", "Show Cause", "Section 73", "Demand Order"])

    # 3. GST-REG-17
    upsert_notice("GST-REG-17", {
        "title": "Show Cause Notice for Cancellation",
        "summary": "Your GST registration is about to be cancelled due to non-compliance.",
        "detailed_explanation": "The officer believes you are no longer eligible for GST registration. This effectively shuts down your business's ability to bill legally.",
        "why_received": "1. You haven't filed returns for 6 months.\n2. You were not found at your registered office during a physical visit.",
        "common_mistakes": "Continuing to do business while this is active. You effectively become an unregistered dealer.",
        "source_section": "CGST Act Section 29",
        "consequences_of_ignoring": "Your GST number will be cancelled (REG-19). You cannot do business or collect GST anymore.",
        "next_steps": "1. File all pending returns immediately.\n2. Reply to the notice in form REG-18 within 7 days.\n3. Attend the personal hearing if required.",
        "severity": "high",
        "verified_by": "Founder",
        "is_active": True
    }, ["REG-17", "Cancellation", "Non-filing"])

    # 4. GSTR-3A
    upsert_notice("GSTR-3A", {
        "title": "Notice to Return Defaulter",
        "summary": "Automated notice sent for missing a return filing deadline.",
        "detailed_explanation": "You have missed the deadline for filing your GSTR-1 or GSTR-3B return. This is an automated system notice asking you to file immediately.",
        "why_received": "You forgot to file last month's return by the 20th.",
        "common_mistakes": "Thinking 'I have zero sales, so I don't need to file'. WRONG. You must file a Nil Return.",
        "source_section": "CGST Act Section 46",
        "consequences_of_ignoring": "Late fees of Rs. 50/20 per day will accumulate. After 15 days, the officer effectively assesses your tax liability (best judgment assessment).",
        "next_steps": "1. File the pending return immediately.\n2. Pay the late fee and interest automatically calculated by the portal.",
        "severity": "low",
        "verified_by": "Founder",
        "is_active": True
    }, ["GSTR-3A", "Late Fee Notice"])

    # 5. GST-DRC-01B
    upsert_notice("GST-DRC-01B", {
        "title": "Intimation of Difference in Liability",
        "summary": "Automated notice because your GSTR-1 (Sales) is higher than GSTR-3B (Payment).",
        "detailed_explanation": "The system detected that the tax you DECLARED in your sales return (GSTR-1) is higher than the tax you actually PAID in GSTR-3B. The department assumes you have short-paid tax.",
        "why_received": "1. Typo in GSTR-1 data.\n2. You delayed payment for some invoices.\n3. You filed GSTR-1 but forgot GSTR-3B.",
        "common_mistakes": "Ignoring it. If not replied to within 7 days, your GSTR-1 filing facility will be BLOCKED.",
        "source_section": "Rule 88C",
        "consequences_of_ignoring": "1. You cannot file GSTR-1 for the next period.\n2. Direct recovery of the amount without further notice.",
        "next_steps": "1. Check the difference amount.\n2. If correct, pay via DRC-03.\n3. If wrong, file a reply in Part B of DRC-01B explaining the reason.",
        "severity": "high",
        "verified_by": "Founder",
        "is_active": True
    }, ["DRC-01B", "Liability Mismatch", "GSTR-1 vs 3B"])

    # 6. GST-DRC-01C
    upsert_notice("GST-DRC-01C", {
        "title": "Intimation of Difference in Input Tax Credit",
        "summary": "Automated notice because you claimed more ITC than what is visible in GSTR-2B.",
        "detailed_explanation": "You claimed 'X' amount of Input Tax Credit in your GSTR-3B, but your auto-generated GSTR-2B statement only showed 'Y'. The difference exceeds the allowed limit.",
        "why_received": "1. Your vendor filed their return late.\n2. You claimed ITC for previous months.\n3. Accounting error.",
        "common_mistakes": "Assuming the vendor will file 'later'. You cannot claim ITC until it appears in 2B.",
        "source_section": "Rule 88D",
        "consequences_of_ignoring": "1. You cannot file GSTR-1 for the next period.\n2. Demand notice + Interest.",
        "next_steps": "1. Match your Purchase Register with GSTR-2B.\n2. Reverse the excess ITC via DRC-03 OR\n3. File a reply explaining why the claim is valid.",
        "severity": "high",
        "verified_by": "Founder",
        "is_active": True
    }, ["DRC-01C", "ITC Mismatch", "Excess ITC"])

    # 7. GST-MOV-02
    upsert_notice("GST-MOV-02", {
        "title": "Order for Physical Verification of Goods (Detention)",
        "summary": "Your vehicle/goods have been intercepted and detained by a GST officer on the road.",
        "detailed_explanation": "The mobile squad has stopped your vehicle and found an issue with the E-way bill or Invoice. They are issuing this order to officially inspect the goods.",
        "why_received": "1. E-way bill expired.\n2. Vehicle number mismatch.\n3. Invoice details don't match the actual goods.",
        "common_mistakes": "Arguing with the officer on the spot without checking the documents. Trying to move the vehicle without the MOV-02 order resolution.",
        "source_section": "CGST Act Section 129",
        "consequences_of_ignoring": "The goods will be seized (MOV-06) and a 200% penalty will be levied. The vehicle will not be released.",
        "next_steps": "1. Cooperative with the inspection.\n2. Receive the MOV-02 order.\n3. Contact a tax professional immediately to prepare a reply for MOV-04.",
        "severity": "high",
        "verified_by": "Founder",
        "is_active": True
    }, ["MOV-02", "Detention", "E-way bill blocking"])

    # 8. Section 70 Summons
    upsert_notice("GST-SUMMONS", {
        "title": "Summons to Appear for Evidence",
        "summary": "An order to appear in person before a GST officer to provide evidence or documents.",
        "detailed_explanation": "This is NOT a simple notice. It is a judicial proceeding. The officer is summoning you to record a statement or provide specific documents under Section 70. Whatever you say can be used against you in court.",
        "why_received": "1. Your vendor was found to be fake.\n2. Huge mismatch in your turnovers.\n3. Verify a suspicious transaction.",
        "common_mistakes": "Ignoring it. Unlike other notices, ignoring a summons can lead to an arrest warrant or penalties. Another mistake is going without a lawyer/authorized representative.",
        "source_section": "CGST Act Section 70",
        "consequences_of_ignoring": "Prosecution under IPC Sections 172/174 (Absconding/Non-attendance). Fine of Rs 25,000.",
        "next_steps": "1. Do NOT ignore. Check the date and time.\n2. Consult a CA immediately.\n3. Prepare the requested documents.\n4. Attend in person or send an authorized representative (if allowed).",
        "severity": "high",
        "verified_by": "Founder",
        "is_active": True
    }, ["Summons", "Section 70", "Appear in Person"])

    # 9. GST-DRC-07
    upsert_notice("GST-DRC-07", {
        "title": "Summary of the Order (Final Demand)",
        "summary": "The final order confirming that you owe tax, interest, and penalty. The debate is over.",
        "detailed_explanation": "This is issued after the DRC-01 process is complete. The officer has heard your side (or you didn't reply) and has decided that you are liable to pay.",
        "why_received": "You didn't reply to DRC-01, or your reply was rejected.",
        "common_mistakes": "Thinking you can still 'reply' to this like a show-cause notice. You cannot. You must now pay or file an Appeal.",
        "source_section": "CGST Act Section 73/74",
        "consequences_of_ignoring": "Recovery proceedings will start. Bank attachment, property seizure.",
        "next_steps": "1. Pay the amount immediately via DRC-03 if you agree.\n2. If you disagree, file an APPEAL (Form APL-01) within 3 months.",
        "severity": "high",
        "verified_by": "Founder",
        "is_active": True
    }, ["DRC-07", "Recovery Order"])

    # 10. GST-REG-03
    upsert_notice("GST-REG-03", {
        "title": "Clarification regarding Registration Application",
        "summary": "Your new GST registration application is on hold. The officer needs more proof.",
        "detailed_explanation": "You applied for a new GST number, but the officer is not satisfied with the documents (Rent agreement, Aadhaar, Electricity bill). They want clarification.",
        "why_received": "1. blurry documents uploaded.\n2. Rent agreement not notarized.\n3. Name mismatch in PAN vs Application.",
        "common_mistakes": "Uploading the same document again without fixing the issue. Ignoring it leads to application rejection.",
        "source_section": "Rule 9",
        "consequences_of_ignoring": "Your GST application will be rejected (REG-05). You will have to apply all over again.",
        "next_steps": "1. Read the specific query in the notice.\n2. Upload the correct document/clarification.\n3. Submit reply in Form REG-04 within 7 days.",
        "severity": "medium",
        "verified_by": "Founder",
        "is_active": True
    }, ["REG-03", "Clarification"])

    # --- INCOME TAX NOTICES (11-16) ---

    # 11. IT-142(1)
    upsert_notice("IT-142(1)", {
        "title": "Inquiry before Assessment",
        "summary": "A preliminary inquiry from Income Tax Dept asking for missing documents or ITR filing.",
        "detailed_explanation": "The Assessing Officer (AO) needs more information to process your return. They might ask for proofs of investment, bank statements, or simply to file a return if you haven't.",
        "why_received": "1. You haven't filed your ITR.\n2. Discrepancy between AIS/26AS and your filing.\n3. Need document verification.",
        "common_mistakes": "Thinking it's a routine email. Failure to reply can lead to a 'Best Judgment Assessment' where they guess your income (usually higher).",
        "source_section": "Income Tax Act Section 142(1)",
        "consequences_of_ignoring": "Penalty of Rs 10,000 + Best Judgment Assessment (Section 144).",
        "next_steps": "1. Log in to the e-filing portal.\n2. Check 'Pending Actions' -> 'e-Proceedings'.\n3. Submit the requested documents.",
        "severity": "medium",
        "verified_by": "Founder",
        "is_active": True
    }, ["142(1)", "Inquiry Notice"])

    # 12. IT-143(1)
    upsert_notice("IT-143(1)", {
        "title": "Intimation (Processing of Return)",
        "summary": "Automated intimation showing if your return is accepted, or if there is a tax due/refund.",
        "detailed_explanation": "This is the output of the CPC's computer processing your ITR. It tells you the final math: Tax Paid vs Tax Calculated.",
        "why_received": "Every taxpayer who files a return receives this. It is routine.",
        "common_mistakes": "Ignoring a 'Demand' intimation thinking it's just an acknowledgment. If it shows 'Tax Payable', you must pay.",
        "source_section": "Income Tax Act Section 143(1)",
        "consequences_of_ignoring": "If tax is due, interest under 234B/C will keep increasing.",
        "next_steps": "1. Check if it says 'No Demand/No Refund', 'Attributes Refund', or 'Demand'.\n2. If Demand, pay or file rectification (154).",
        "severity": "low",
        "verified_by": "Founder",
        "is_active": True
    }, ["143(1)", "Intimation", "CPC Order"])

    # 13. IT-143(2)
    upsert_notice("IT-143(2)", {
        "title": "Scrutiny Assessment Notice",
        "summary": "Your return has been selected for detailed scrutiny. This is a serious audit.",
        "detailed_explanation": "The officer is not convinced by your return. They want to check your books of accounts, bank statements, and expenses in detail.",
        "why_received": "1. High value transactions.\n2. Random selection (CASS).\n3. Exemptions claimed are suspicious.",
        "common_mistakes": "Handling it yourself without a CA. Ignoring it.",
        "source_section": "Income Tax Act Section 143(2)",
        "consequences_of_ignoring": "Complete assessment of income by the officer (Section 144) + Penalties (Section 270A).",
        "next_steps": "1. Hire a Chartered Accountant immediately.\n2. Prepare all proofs for every deduction claimed.",
        "severity": "high",
        "verified_by": "Founder",
        "is_active": True
    }, ["143(2)", "Scrutiny", "CASS"])

    # 14. IT-148
    upsert_notice("IT-148", {
        "title": "Income Escaping Assessment",
        "summary": "The dept attempts to tax income that you hid or forgot in previous years.",
        "detailed_explanation": "The officer has 'Reason to Believe' that you earned income but didn't pay tax on it. They are opening up your past filings (up to 10 years).",
        "why_received": "1. High value property purchase/sale.\n2. Stock market profits not shown.\n3. Foreign assets discovery.",
        "common_mistakes": "Thinking 'that year is closed'. Section 148 allows them to reopen old cases.",
        "source_section": "Income Tax Act Section 148",
        "consequences_of_ignoring": "Reassessment + 50% to 200% Penalty.",
        "next_steps": "1. Check the reason recorded for reopening.\n2. File the return for that year again.\n3. Consult a Tax Advocate.",
        "severity": "high",
        "verified_by": "Founder",
        "is_active": True
    }, ["Section 148", "Escaped Assessment", "Reopening"])

    # 15. IT-156
    upsert_notice("IT-156", {
        "title": "Notice of Demand",
        "summary": "An official bill from the Income Tax Dept asking you to pay X amount.",
        "detailed_explanation": "This notice accompanies an assessment order (like 143(1) or 143(3)). It simply states: 'Pay Rs. X within 30 days'.",
        "why_received": "Your assessment resulted in extra tax liability.",
        "common_mistakes": "Not paying within 30 days. This makes you an 'Assessee in Default'.",
        "source_section": "Income Tax Act Section 156",
        "consequences_of_ignoring": "1. Interest @ 1% per month.\n2. Bank attachment.\n3. Refund adjustment from future years.",
        "next_steps": "1. Pay via Challan 280.\n2. If you disagree, file a Stay of Demand application along with an Appeal.",
        "severity": "high",
        "verified_by": "Founder",
        "is_active": True
    }, ["Notice of Demand", "Section 156", "Tax Payable"])

    # 16. IT-245
    upsert_notice("IT-245", {
        "title": "Intimation of Refund Adjustment",
        "summary": "They are taking your current year's refund to pay off an old year's debt.",
        "detailed_explanation": "You were expecting a refund this year, but the dept says you owe them money from 2018 or 2019. They propose to adjust (subtract) the old debt from your new refund.",
        "why_received": "Outstanding demand from previous years that was never resolved.",
        "common_mistakes": "Ignoring the email. If you don't object within 30 days, they automatically take the money.",
        "source_section": "Income Tax Act Section 245",
        "consequences_of_ignoring": "You lose your refund.",
        "next_steps": "1. Log in to portal.\n2. Go to 'Response to Outstanding Demand'.\n3. 'Disagree with demand' if you have already paid it (upload challan).",
        "severity": "medium",
        "verified_by": "Founder",
        "is_active": True
    }, ["Section 245", "Refund Adjustment", "Outstanding Demand"])

    # --- MORE GST NOTICES (17-20) ---

    # 17. GST-CMP-05
    upsert_notice("GST-CMP-05", {
        "title": "Show Cause Notice for Denial of Composition",
        "summary": "They want to remove you from the Composition Scheme (low tax scheme).",
        "detailed_explanation": "You are paying 1% tax under Composition Scheme, but the officer thinks you are ineligible (e.g., selling inter-state, selling on Exempt goods).",
        "why_received": "1. Inter-state supply detected.\n2. Selling through E-commerce.",
        "common_mistakes": "Continuing to pay 1%. If proved wrong, you will have to pay 18% tax from the beginning + Penalty.",
        "source_section": "Rule 6",
        "consequences_of_ignoring": "Removal from scheme (CMP-07) and demand of differential tax.",
        "next_steps": "1. Reply in CMP-06 within 15 days.\n2. Prove you did not violate conditions.",
        "severity": "high",
        "verified_by": "Founder",
        "is_active": True
    }, ["CMP-05", "Composition Denial"])

    # 18. GST-PCT-03
    upsert_notice("GST-PCT-03", {
        "title": "Show Cause Notice to GST Practitioner",
        "summary": "Notice to a GST Practitioner for misconduct.",
        "detailed_explanation": "Rare notice issued to tax professionals if they are found guilty of misconduct.",
        "why_received": "Professional misconduct.",
        "common_mistakes": "N/A for normal taxpayers.",
        "source_section": "Rule 83",
        "consequences_of_ignoring": "License cancellation.",
        "next_steps": "Reply in PCT-04.",
        "severity": "medium",
        "verified_by": "Founder",
        "is_active": True
    }, ["PCT-03"])

    # 19. GST-RFD-08
    upsert_notice("GST-RFD-08", {
        "title": "Show Cause Notice for Refund Rejection",
        "summary": "They are refusing your refund claim.",
        "detailed_explanation": "You applied for a GST refund (e.g., for exports), but the officer thinks you are not eligible or documents are missing.",
        "why_received": "Mismatch in calculation or missing Proof of Realization (BRC/FIRC).",
        "common_mistakes": "Not replying. The refund will be rejected in RFD-06.",
        "source_section": "Rule 92",
        "consequences_of_ignoring": "Rejection of Refund.",
        "next_steps": "Reply in RFD-09 within 15 days.",
        "severity": "medium",
        "verified_by": "Founder",
        "is_active": True
    }, ["RFD-08", "Refund Rejection"])

    # 20. GST-DRC-01A
    upsert_notice("GST-DRC-01A", {
        "title": "Intimation before Show Cause Notice",
        "summary": "A 'friendly' warning before the actual Demand Order (DRC-01).",
        "detailed_explanation": "The officer is telling you the tax calculation informally before issuing the strict legal notice. This is your chance to resolve it peacefully.",
        "why_received": "Audit or Scrutiny findings.",
        "common_mistakes": "Ignoring it because it's 'Pre-notice'.",
        "source_section": "Rule 142(1A)",
        "consequences_of_ignoring": "They will issue DRC-01 (Full Show Cause Notice).",
        "next_steps": "1. Pay partially/fully via DRC-03.\n2. Submit Part B of DRC-01A if you disagree.",
        "severity": "medium",
        "verified_by": "Founder",
        "is_active": True
    }, ["DRC-01A", "Pre-notice consultation"])

    # Create superuser if not exists

    # --- EXPANSION VERTICAL: MCA / COMPANY LAW (21-25) ---

    # 21. MCA-STK-1 (Strike Off)
    upsert_notice("MCA-STK-1", {
        "title": "Notice of Strike Off",
        "summary": "The ROC intends to remove your company name from the register because you haven't been doing business.",
        "detailed_explanation": "The Registrar of Companies (ROC) has identified that your company has not filed returns for 2 years or has not commenced business. They are giving you 30 days to explain why the company should NOT be closed.",
        "why_received": "1. Non-filing of AOC-4/MGT-7 for 2 years.\n2. Company address verification failed.",
        "common_mistakes": "Ignoring it. Once struck off, directors become disqualified (DIN mismatch) for 5 years.",
        "source_section": "Companies Act Section 248(1)",
        "consequences_of_ignoring": "Company closed. Directors disqualified. Bank accounts frozen.",
        "next_steps": "1. Reply immediately proving business activity.\n2. File pending returns with late fees.\n3. Apply for 'Active' status.",
        "severity": "high",
        "verified_by": "Legal Team",
        "is_active": True
    }, ["STK-1", "Strike Off", "ROC Notice"])

    # 22. MCA-DIR-3-KYC
    upsert_notice("MCA-DIR-3-KYC", {
        "title": "Director KYC Non-Compliance",
        "summary": "Your Director Identification Number (DIN) has been deactivated.",
        "detailed_explanation": "Every director must file KYC annually. You missed the deadline (Sept 30). Your DIN is now 'Deactivated due to non-filing of KYC'.",
        "why_received": "Missed the annual KYC deadline.",
        "common_mistakes": "Thinking you can still sign documents. You cannot sign any company form until this is active.",
        "source_section": "Rule 12A",
        "consequences_of_ignoring": "DIN remains deactivated. Penalty of Rs 5,000 to reactivate.",
        "next_steps": "1. Pay Rs 5,000 penalty.\n2. File e-Form DIR-3-KYC immediately.",
        "severity": "medium",
        "verified_by": "Legal Team",
        "is_active": True
    }, ["DIR-3 KYC", "DIN Deactivated"])

    # 23. MCA-INC-20A
    upsert_notice("MCA-INC-20A", {
        "title": "Commencement of Business Default",
        "summary": "You incorporated a company but didn't deposit the share capital.",
        "detailed_explanation": "Within 180 days of incorporation, shareholders must deposit money into the bank account and file INC-20A. You missed this.",
        "why_received": "Failure to file INC-20A within 180 days.",
        "common_mistakes": "Forgetting this step after getting the Certificate of Incorporation.",
        "source_section": "Companies Act Section 10A",
        "consequences_of_ignoring": "Penalty of Rs 50,000 + Rs 1,000/day. Company can be struck off.",
        "next_steps": "1. Deposit money immediately.\n2. File INC-20A with additional fees.",
        "severity": "high",
        "verified_by": "Legal Team",
        "is_active": True
    }, ["INC-20A", "Commencement of Business"])

    # --- EXPANSION VERTICAL: LABOR LAW (26-28) ---

    # 26. PF-7A
    upsert_notice("PF-SEC-7A", {
        "title": "PF Inquiry Section 7A",
        "summary": "A quasi-judicial inquiry to determine how much PF you managed to evade.",
        "detailed_explanation": "The PF Commissioner has initiated an inquiry to determine dues. This is a court-like proceeding. They suspect you under-reported employees or wages.",
        "why_received": "Complaint from employee or difference in Balance Sheet wages vs PF wages.",
        "common_mistakes": "Not attending the hearing. The officer will decide the amount 'Ex-Parte' (without you) and it will be huge.",
        "source_section": "EPF Act Section 7A",
        "consequences_of_ignoring": "Bank attachment. Arrest warrant.",
        "next_steps": "1. Attend the hearing with a consultant.\n2. Produce Salary Registers and Attendance sheets.",
        "severity": "high",
        "verified_by": "Legal Team",
        "is_active": True
    }, ["7A Inquiry", "PF Hearing"])

    # 27. PF-14B
    upsert_notice("PF-SEC-14B", {
        "title": "PF Damages Notice",
        "summary": "Penalty for paying PF late.",
        "detailed_explanation": "You paid the PF dues, but you paid them late. This notice is demanding 'Damages' (Penalty) and 'Interest' (7Q) for the delay.",
        "why_received": "Late payment of Challans.",
        "common_mistakes": "Thinking interest is already paid. Damages are separate and can be up to 100% of the arrears.",
        "source_section": "EPF Act Section 14B",
        "consequences_of_ignoring": "Recovery officer will recover amount from bank.",
        "next_steps": "1. Verify the calculation of delay days.\n2. Request reduction if company was sick/closed.",
        "severity": "medium",
        "verified_by": "Legal Team",
        "is_active": True
    }, ["14B Damages", "PF Penalty"])

    # --- EXPANSION VERTICAL: TRADEMARK (29-30) ---

    # 29. TM-O-OBJ
    upsert_notice("TM-OBJ", {
        "title": "Trademark Examination Report (Objection)",
        "summary": " The Registry has objected to your brand name application.",
        "detailed_explanation": "Your trademark application is not accepted yet. The officer thinks it is 'Similar' to an existing brand (Section 11) or 'Generic/Descriptive' (Section 9).",
        "why_received": "Proposed name is similar to another brand or uses common words like 'Best' or 'Quality'.",
        "common_mistakes": "Not replying within 30 days. Application becomes 'Abandoned'.",
        "source_section": "Trade Marks Act Section 9/11",
        "consequences_of_ignoring": "Brand name application rejected.",
        "next_steps": "1. File a legal reply citing case laws.\n2. Argue why your brand is distinct.",
        "severity": "medium",
        "verified_by": "Legal Team",
        "is_active": True
    }, ["Trademark Objection", "Examination Report"])

    # --- EXPANSION VERTICAL: TRAFFIC (31-32) ---

    # 31. TRAFFIC-183
    upsert_notice("MV-183", {
        "title": "Over-Speeding Challan",
        "summary": "You were caught driving faster than the limit.",
        "detailed_explanation": "Speed camera or interceptor detected your vehicle moving above the speed limit for that road.",
        "why_received": "Video evidence of speeding.",
        "common_mistakes": "Ignoring SMS. It goes to Lok Adalat and fine increases.",
        "source_section": "Motor Vehicles Act Section 183",
        "consequences_of_ignoring": "Summons from Court. License suspension.",
        "next_steps": "1. Check photo evidence on Parivahan site.\n2. Pay online within 60 days.",
        "severity": "low",
        "verified_by": "Auto Admin",
        "is_active": True
    }, ["Speeding Fine", "Challan"])

    # 32. TRAFFIC-RL
    upsert_notice("MV-REDLIGHT", {
        "title": "Red Light Violation",
        "summary": "Jumping a red signal.",
        "detailed_explanation": "Camera evidence shows your vehicle crossing the stop line when the signal was Red.",
        "why_received": "Traffic violation.",
        "common_mistakes": "Claiming 'it was yellow'. Photos usually show otherwise.",
        "source_section": "Motor Vehicles Act Section 184",
        "consequences_of_ignoring": "Fine + License seizure.",
        "next_steps": "Pay online.",
        "severity": "low",
        "verified_by": "Auto Admin",
        "is_active": True
    }, ["Red Light", "Signal Jump"])

    # Create superuser if not exists
    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser('admin', 'admin@complia.com', 'password123')
        print("Superuser 'admin' created.")
    
    print("Data seeded successfully!")

if __name__ == "__main__":
    seed_data()

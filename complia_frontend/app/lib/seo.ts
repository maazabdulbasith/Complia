export type FaqItem = {
  question: string;
  answer: string;
};

export const SITE_NAME = "Complia";

export const SITE_DESCRIPTION =
  "Understand GST and Income Tax notices in plain English, know urgency, and see the next action fast.";

export const SEO_FAQS: FaqItem[] = [
  {
    question: "What should I do first after receiving a GST or Income Tax notice?",
    answer:
      "Do not ignore it. First identify the notice code or section, check the reply deadline, and understand whether it is informational, a scrutiny notice, or a demand notice. Complia helps you decode the notice and shows the next action path quickly.",
  },
  {
    question: "Can I search notices by code, section, or common keyword?",
    answer:
      "Yes. You can search by notice code such as GST-ASMT-10 or IT-143(2), by legal section, or by common phrases like scrutiny, refund adjustment, demand notice, or excess ITC.",
  },
  {
    question: "Does Complia cover salaryman and ITR-related notices?",
    answer:
      "Yes. Complia covers Income Tax notices relevant to salaried taxpayers, including intimation, scrutiny, escaped assessment, refund adjustment, and demand-related notices, along with GST and other compliance notices.",
  },
  {
    question: "Is Complia a CA or law firm?",
    answer:
      "No. Complia is a notice intelligence and workflow platform. It explains notices in plain English, highlights urgency, and helps you decide the next step. For filing a reply or handling a serious case, you should speak to a qualified CA or tax professional.",
  },
  {
    question: "When should I talk to a CA immediately?",
    answer:
      "You should escalate quickly if the notice is high severity, mentions a demand amount, threatens cancellation or recovery, involves scrutiny or reassessment, or if the reply deadline is close. Complia shows severity and also lets you raise a CA-help request.",
  },
  {
    question: "What is the difference between free notice search and paid Upload & Understand?",
    answer:
      "Free search explains known notice types. Paid Upload & Understand works on your actual uploaded notice and extracts fields like detected notice type, legal section, deadline clues, urgency, and a CA-ready brief based on your document.",
  },
  {
    question: "Will my uploaded parser result be saved?",
    answer:
      "Yes. Once a paid parser result is unlocked, it can be saved into Safe along with the parser snapshot, next-step checklist, and CA brief so you can come back to it later.",
  },
  {
    question: "What file types can I upload to Complia?",
    answer:
      "Complia supports PDF, PNG, JPG, JPEG, WEBP, and TXT uploads. OCR support is used for image and scanned notice workflows where readable text is not directly available.",
  },
];

export const FEATURED_NOTICE_LINKS = [
  { code: "GST-ASMT-10", label: "GST ASMT-10 Scrutiny of Returns" },
  { code: "GST-DRC-01", label: "GST DRC-01 Show Cause / Demand Notice" },
  { code: "GST-DRC-01B", label: "GST DRC-01B Liability Mismatch" },
  { code: "GST-REG-17", label: "GST REG-17 Cancellation Notice" },
  { code: "IT-143(1)", label: "Income Tax 143(1) Intimation" },
  { code: "IT-143(2)", label: "Income Tax 143(2) Scrutiny Notice" },
  { code: "IT-148", label: "Income Tax Section 148 Reassessment" },
  { code: "IT-245", label: "Income Tax Section 245 Refund Adjustment" },
];

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import {
  ApiClientError,
  confirmTestPayment,
  createPaymentOrder,
  getNotice,
  getMyEntitlements,
  getParserResult,
  getPaymentPlans,
  saveNotice,
  uploadParserFile,
  type ParserJob,
  type PaymentPlan,
  type UserEntitlements,
} from "../api/client";
import BrandMark from "../lib/brand_mark";
import { trackEvent } from "../lib/analytics";
import type { NoticeType } from "../types/notice";
import type { Route } from "./+types/parser";

type CashfreeCheckoutOptions = {
  paymentSessionId: string;
  redirectTarget?: "_self" | "_blank" | "_top" | "_modal";
};

type CashfreeCheckoutResult = {
  error?: {
    code?: string;
    message?: string;
  };
};

type CashfreeInstance = {
  checkout: (options: CashfreeCheckoutOptions) => Promise<CashfreeCheckoutResult>;
};

declare global {
  interface Window {
    Cashfree?: (config: { mode: "sandbox" | "production" }) => CashfreeInstance;
  }
}

let cashfreeSdkPromise: Promise<void> | null = null;
const ENABLE_TEST_PAYMENT = String(import.meta.env.VITE_ENABLE_TEST_PAYMENT || "").toLowerCase() === "true";

function loadCashfreeSdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cashfree checkout is only available in browser."));
  }
  if (window.Cashfree) {
    return Promise.resolve();
  }
  if (cashfreeSdkPromise) {
    return cashfreeSdkPromise;
  }

  cashfreeSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Cashfree checkout SDK."));
    document.body.appendChild(script);
  });
  return cashfreeSdkPromise;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatCurrencyINR(amountInr: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amountInr);
}

function daysUntil(deadlineIso: string | null): number | null {
  if (!deadlineIso) {
    return null;
  }
  const deadline = new Date(`${deadlineIso}T00:00:00`);
  if (Number.isNaN(deadline.getTime())) {
    return null;
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = deadline.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function urgencyLabel(severity: "low" | "medium" | "high", daysLeft: number | null): string {
  if (daysLeft !== null && daysLeft < 0) {
    return "Overdue: immediate action required";
  }
  if (severity === "high") {
    if (daysLeft !== null && daysLeft <= 3) {
      return "Critical: respond today";
    }
    return "High risk: handle urgently";
  }
  if (severity === "medium") {
    if (daysLeft !== null && daysLeft <= 5) {
      return "Important: respond this week";
    }
    return "Moderate risk: do not delay";
  }
  if (daysLeft !== null && daysLeft <= 7) {
    return "Action needed soon";
  }
  return "Low risk: schedule and respond";
}

function priorityBand(
  severity: "low" | "medium" | "high",
  daysLeft: number | null,
  confidencePercent: number
): "critical" | "high" | "medium" | "low" {
  if (daysLeft !== null && daysLeft < 0) return "critical";
  if (severity === "high" && (daysLeft === null || daysLeft <= 7)) return "critical";
  if (severity === "high" || (daysLeft !== null && daysLeft <= 10)) return "high";
  if (severity === "medium" || confidencePercent < 75) return "medium";
  return "low";
}

function formatDateLabel(isoDate: string | null | undefined): string {
  if (!isoDate) return "Not detected";
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function normalizedPayloadValue(
  payload: Record<string, unknown> | undefined,
  key: string
): unknown {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  return payload[key];
}

function payloadNumber(payload: Record<string, unknown> | undefined, key: string): number | null {
  const value = normalizedPayloadValue(payload, key);
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function payloadBoolean(payload: Record<string, unknown> | undefined, key: string): boolean {
  const value = normalizedPayloadValue(payload, key);
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

function payloadString(payload: Record<string, unknown> | undefined, key: string): string {
  const value = normalizedPayloadValue(payload, key);
  return typeof value === "string" ? value : "";
}

function buildPersonalizedActionChecklist({
  noticeTitle,
  severity,
  daysLeft,
  deadlineLabel,
  legalSection,
  amountClaimed,
}: {
  noticeTitle: string;
  severity: "low" | "medium" | "high";
  daysLeft: number | null;
  deadlineLabel: string;
  legalSection: string;
  amountClaimed: string;
}): string[] {
  const checklist: string[] = [];
  checklist.push(`Confirm that the uploaded notice is ${noticeTitle || "the detected notice"} and archive a copy with timestamp.`);
  if (deadlineLabel !== "Not detected") {
    checklist.push(`Block calendar for reply deadline: ${deadlineLabel}.`);
  } else {
    checklist.push("Locate reply deadline from annexure and block it on your calendar today.");
  }
  if (legalSection && legalSection !== "Not detected") {
    checklist.push(`Prepare response against ${legalSection} with document proof and return filings.`);
  } else {
    checklist.push("Identify the exact legal section and map your response to that section.");
  }
  if (amountClaimed && amountClaimed !== "Not detected") {
    checklist.push(`Reconcile the claimed amount (${amountClaimed}) against books and challans.`);
  }
  if (severity === "high" || (daysLeft !== null && daysLeft <= 7)) {
    checklist.push("Escalate to CA/tax counsel within 24 hours to avoid recovery escalation.");
  } else {
    checklist.push("Get CA review this week and finalize draft reply before submission.");
  }
  return checklist;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complia | Upload Notice & Understand" },
    {
      name: "description",
      content:
        "Upload your tax notice, complete secure payment, and unlock extracted insights instantly.",
    },
  ];
}

export default function ParserUploadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [noticeCode, setNoticeCode] = useState(searchParams.get("notice") || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPlanKey, setSelectedPlanKey] = useState("");
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [entitlements, setEntitlements] = useState<UserEntitlements | null>(null);
  const [parserJob, setParserJob] = useState<ParserJob | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{ file: File; noticeCode: string | null } | null>(
    null
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [detectedNotice, setDetectedNotice] = useState<NoticeType | null>(null);
  const [isLoadingNoticeExplain, setIsLoadingNoticeExplain] = useState(false);
  const [noticeExplainError, setNoticeExplainError] = useState<string | null>(null);
  const [showFullExcerpt, setShowFullExcerpt] = useState(false);
  const [isSavingNotice, setIsSavingNotice] = useState(false);
  const [saveNoticeMessage, setSaveNoticeMessage] = useState<string | null>(null);
  const [saveNoticeError, setSaveNoticeError] = useState<string | null>(null);
  const [copyBriefMessage, setCopyBriefMessage] = useState<string | null>(null);

  const toUserMessage = (error: unknown, fallback: string): string => {
    if (error instanceof ApiClientError) {
      if (error.status === 401) {
        return "Your session expired. Please sign in again to continue.";
      }
      if (error.status === 402 || error.code === "PAYMENT_REQUIRED") {
        return "Payment is required before upload. Complete checkout to unlock this parser result.";
      }
      if (error.status === 403) {
        if (error.message.toLowerCase().includes("private beta")) {
          return "Parser is in private beta for selected users. Contact support to enable access for your account.";
        }
        return "Your account does not have parser access yet. Contact support for beta enablement.";
      }
      if (error.status === 413) {
        return "File is too large. Upload a smaller file and retry.";
      }
      if (error.status === 429) {
        return "Too many requests right now. Please wait a minute and retry.";
      }
      if (error.status >= 500) {
        return "Server issue while processing upload. Please retry in a moment.";
      }
      return error.message || fallback;
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  };

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.key === selectedPlanKey) ?? null,
    [plans, selectedPlanKey]
  );
  const deadlineDaysLeft = parserJob?.extraction?.deadline_date
    ? daysUntil(parserJob.extraction.deadline_date)
    : null;
  const severityForGuidance = detectedNotice?.severity || "medium";
  const urgencyText = urgencyLabel(severityForGuidance, deadlineDaysLeft);
  const extractionPayload = parserJob?.extraction?.normalized_payload;
  const confidencePercent = Math.round((parserJob?.confidence || 0) * 100);
  const ocrUsed = payloadBoolean(extractionPayload, "ocr_used");
  const ocrPagesProcessed = payloadNumber(extractionPayload, "ocr_pages_processed");
  const ocrTextChars = payloadNumber(extractionPayload, "ocr_text_chars");
  const ocrEngine = payloadString(extractionPayload, "ocr_engine");
  const lowConfidence = confidencePercent < 75;
  const replyDeadlineLabel = formatDateLabel(parserJob?.extraction?.deadline_date);
  const riskBand = priorityBand(severityForGuidance, deadlineDaysLeft, confidencePercent);
  const isCodeMismatch =
    Boolean(noticeCode.trim()) &&
    Boolean(parserJob?.notice_code) &&
    noticeCode.trim().toUpperCase() !== (parserJob?.notice_code || "").toUpperCase();
  const actionChecklist = useMemo(() => {
    return buildPersonalizedActionChecklist({
      noticeTitle: detectedNotice?.title || parserJob?.notice_code || "detected notice",
      severity: severityForGuidance,
      daysLeft: deadlineDaysLeft,
      deadlineLabel: replyDeadlineLabel,
      legalSection: parserJob?.extraction?.legal_section || "Not detected",
      amountClaimed: parserJob?.extraction?.amount_claimed || "Not detected",
    });
  }, [
    detectedNotice?.title,
    parserJob?.notice_code,
    parserJob?.extraction?.legal_section,
    parserJob?.extraction?.amount_claimed,
    severityForGuidance,
    deadlineDaysLeft,
    replyDeadlineLabel,
  ]);
  const caBrief = useMemo(() => {
    return [
      "Complia case handoff",
      `Detected notice: ${parserJob?.notice_code || "Not detected"}`,
      `Notice title: ${detectedNotice?.title || "Not detected"}`,
      `Severity: ${severityForGuidance}`,
      `Deadline: ${replyDeadlineLabel}`,
      `Legal section: ${parserJob?.extraction?.legal_section || "Not detected"}`,
      `Amount claimed: ${parserJob?.extraction?.amount_claimed || "Not detected"}`,
      `Urgency: ${urgencyText}`,
      "",
      "Recommended next actions:",
      ...actionChecklist.map((step, index) => `${index + 1}. ${step}`),
    ].join("\n");
  }, [
    parserJob?.notice_code,
    parserJob?.extraction?.legal_section,
    parserJob?.extraction?.amount_claimed,
    detectedNotice?.title,
    severityForGuidance,
    replyDeadlineLabel,
    urgencyText,
    actionChecklist,
  ]);

  useEffect(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("complia_token")));
    const raw = localStorage.getItem("user");
    if (!raw) {
      setIsAdminUser(false);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { user_type?: string };
      setIsAdminUser(parsed.user_type === "admin");
    } catch {
      setIsAdminUser(false);
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      setLoadingBootstrap(true);
      try {
        const loadedPlans = await getPaymentPlans();
        setPlans(loadedPlans);
        if (!selectedPlanKey && loadedPlans.length > 0) {
          const defaultPlan = loadedPlans.find((plan) => plan.is_default) || loadedPlans[0];
          setSelectedPlanKey(defaultPlan.key);
        }

        if (isLoggedIn) {
          const entitlementData = await getMyEntitlements();
          setEntitlements(entitlementData);
        } else {
          setEntitlements(null);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not load parser pricing right now. Please retry.";
        setErrorMessage(message);
      } finally {
        setLoadingBootstrap(false);
      }
    };
    void bootstrap();
  }, [isLoggedIn]);

  useEffect(() => {
    if (plans.length === 0) {
      return;
    }
    const activePlan = selectedPlan || plans[0];
    trackEvent("payment_plan_viewed", {
      plan_key: activePlan.key,
      amount_paise: activePlan.amount_paise,
      currency: activePlan.currency,
      source_path: "/parser",
    });
  }, [plans, selectedPlan]);

  useEffect(() => {
    if (!parserJob || parserJob.status !== "queued") {
      return;
    }
    const intervalId = window.setInterval(async () => {
      try {
        const latest = await getParserResult(parserJob.id);
        setParserJob(latest);
      } catch {
        // Keep last known state; polling failure should not disrupt UI.
      }
    }, 2500);
    return () => window.clearInterval(intervalId);
  }, [parserJob]);

  useEffect(() => {
    if (!parserJob?.notice_code) {
      setDetectedNotice(null);
      setNoticeExplainError(null);
      setIsLoadingNoticeExplain(false);
      return;
    }

    let isCancelled = false;
    const loadNoticeExplanation = async () => {
      setIsLoadingNoticeExplain(true);
      setNoticeExplainError(null);
      try {
        const notice = await getNotice(parserJob.notice_code);
        if (!isCancelled) {
          setDetectedNotice(notice);
        }
      } catch {
        if (!isCancelled) {
          setDetectedNotice(null);
          setNoticeExplainError("Could not load full notice explanation for this result.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingNoticeExplain(false);
        }
      }
    };

    void loadNoticeExplanation();
    return () => {
      isCancelled = true;
    };
  }, [parserJob?.notice_code]);

  useEffect(() => {
    setShowFullExcerpt(false);
    setSaveNoticeMessage(null);
    setSaveNoticeError(null);
    setCopyBriefMessage(null);
  }, [parserJob?.id]);

  const refreshEntitlements = async (): Promise<UserEntitlements | null> => {
    if (!isLoggedIn) {
      setEntitlements(null);
      return null;
    }
    try {
      const latest = await getMyEntitlements();
      setEntitlements(latest);
      return latest;
    } catch {
      return entitlements;
    }
  };

  const saveDetectedNotice = async (
    noticeId: number,
    options?: {
      source?: "auto" | "manual";
      parserJobId?: number;
      parserSnapshot?: Record<string, unknown>;
      actionStatus?: "not_started" | "in_progress" | "done";
      caBrief?: string;
      nextStepsChecklist?: string[];
    }
  ): Promise<boolean> => {
    const source = options?.source || "manual";
    setIsSavingNotice(true);
    setSaveNoticeError(null);
    setSaveNoticeMessage(null);
    try {
      await saveNotice(noticeId, {
        parser_job_ref: options?.parserJobId,
        parser_snapshot: options?.parserSnapshot,
        action_status: options?.actionStatus || "not_started",
        ca_brief: options?.caBrief,
        next_steps_checklist: options?.nextStepsChecklist,
      });
      setSaveNoticeMessage(
        source === "auto"
          ? "Notice auto-saved to Safe."
          : "Notice saved to Safe."
      );
      return true;
    } catch (error) {
      const fallback =
        source === "auto"
          ? "Parse completed, but auto-save failed. Use the Save button to retry."
          : "Could not save this notice to Safe right now.";
      const message = toUserMessage(error, fallback);
      setSaveNoticeError(message);
      return false;
    } finally {
      setIsSavingNotice(false);
    }
  };

  const performUpload = async (file: File, explicitNoticeCode?: string) => {
    setIsUploading(true);
    setErrorMessage(null);
    setStatusMessage("Analyzing your notice...");
    try {
      const noticeCodeForRequest = explicitNoticeCode?.trim() || noticeCode.trim() || undefined;
      const job = await uploadParserFile(file, noticeCodeForRequest);
      setParserJob(job);
      setPendingUpload(null);
      setPaymentRequired(false);
      setStatusMessage("Parser result unlocked.");
      trackEvent("paid_parser_result_viewed", {
        notice_code: job.notice_code || noticeCodeForRequest || "unknown",
        parser_job_id: job.id,
        status: job.status,
      });
      if (job.notice) {
        const uploadDeadlineLabel = formatDateLabel(job.extraction?.deadline_date || null);
        const uploadChecklist = buildPersonalizedActionChecklist({
          noticeTitle: job.notice_code || "detected notice",
          severity: "medium",
          daysLeft: null,
          deadlineLabel: uploadDeadlineLabel,
          legalSection: job.extraction?.legal_section || "Not detected",
          amountClaimed: job.extraction?.amount_claimed || "Not detected",
        });
        const uploadBrief = [
          "Complia case handoff",
          `Detected notice: ${job.notice_code || "Not detected"}`,
          `Deadline: ${uploadDeadlineLabel}`,
          `Legal section: ${job.extraction?.legal_section || "Not detected"}`,
          `Amount claimed: ${job.extraction?.amount_claimed || "Not detected"}`,
          "",
          "Recommended next actions:",
          ...uploadChecklist.map((step, index) => `${index + 1}. ${step}`),
        ].join("\n");
        void saveDetectedNotice(job.notice, {
          source: "auto",
          parserJobId: job.id,
          parserSnapshot: {
            parser_job_id: job.id,
            notice_code: job.notice_code || "",
            status: job.status,
            confidence: job.confidence,
            deadline_date: job.extraction?.deadline_date || "",
            legal_section: job.extraction?.legal_section || "",
            amount_claimed: job.extraction?.amount_claimed || "",
          },
          actionStatus: "not_started",
          caBrief: uploadBrief,
          nextStepsChecklist: uploadChecklist,
        });
      }
      void refreshEntitlements();
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 402) {
        setPaymentRequired(true);
        setStatusMessage("Payment required. Complete checkout to continue.");
        return;
      }
      if (error instanceof ApiClientError && error.status === 401) {
        navigate(`/login?next=${encodeURIComponent(`/parser?notice=${noticeCode}`)}`);
        return;
      }
      if (error instanceof ApiClientError && error.status === 403) {
        setPaymentRequired(false);
      }
      const message = toUserMessage(error, "Could not process this file right now. Please retry.");
      setErrorMessage(message);
      setStatusMessage(null);
    } finally {
      setIsUploading(false);
    }
  };

  const waitForCredits = async (existingCredits: number): Promise<UserEntitlements | null> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 45000) {
      await sleep(2000);
      const latest = await refreshEntitlements();
      if ((latest?.parser_credits || 0) > existingCredits) {
        return latest;
      }
    }
    return null;
  };

  const verifyPaymentAndResume = async () => {
    if (!pendingUpload) {
      return;
    }
    const existingCredits = entitlements?.parser_credits || 0;
    setIsVerifyingPayment(true);
    setErrorMessage(null);
    setStatusMessage("Verifying payment and refreshing your credits...");
    try {
      const latest = await waitForCredits(existingCredits);
      if (!latest || (latest.parser_credits || 0) <= existingCredits) {
        setErrorMessage("Payment is still processing. Please wait a moment and retry.");
        setStatusMessage(null);
        return;
      }
      trackEvent("payment_success", {
        plan_key: selectedPlan?.key || "single_use_notice_parse",
        amount_paise: selectedPlan?.amount_paise || 900,
        currency: selectedPlan?.currency || "INR",
        source_path: "/parser",
      });
      await performUpload(pendingUpload.file, pendingUpload.noticeCode || undefined);
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  const startPayment = async () => {
    if (!isLoggedIn) {
      navigate(`/login?next=${encodeURIComponent(`/parser?notice=${noticeCode}`)}`);
      return;
    }
    if (!selectedPlanKey) {
      setErrorMessage("No payment plan available.");
      return;
    }
    if (!pendingUpload && selectedFile) {
      setPendingUpload({ file: selectedFile, noticeCode: noticeCode.trim() || null });
    }

    setIsProcessingPayment(true);
    setErrorMessage(null);
    setStatusMessage("Creating secure payment order...");
    try {
      const order = await createPaymentOrder(selectedPlanKey);
      trackEvent("payment_order_created", {
        plan_key: order.plan_key,
        amount_paise: order.amount_paise,
        currency: order.currency,
        source_path: "/parser",
      });

      if (!order.payment_session_id) {
        throw new Error("Payment session missing. Please retry.");
      }

      await loadCashfreeSdk();
      if (!window.Cashfree) {
        throw new Error("Cashfree checkout is unavailable right now.");
      }

      const mode = import.meta.env.VITE_CASHFREE_ENV === "production" ? "production" : "sandbox";
      const cashfree = window.Cashfree({ mode });
      trackEvent("payment_checkout_opened", {
        plan_key: order.plan_key,
        amount_paise: order.amount_paise,
        currency: order.currency,
        source_path: "/parser",
      });

      const checkoutResult = await cashfree.checkout({
        paymentSessionId: order.payment_session_id,
        redirectTarget: "_modal",
      });

      if (checkoutResult?.error) {
        const message = checkoutResult.error.message || "Payment was not completed.";
        trackEvent("payment_failed", {
          plan_key: order.plan_key,
          amount_paise: order.amount_paise,
          currency: order.currency,
          source_path: "/parser",
        });
        throw new Error(message);
      }

      setStatusMessage("Payment complete. Verifying and unlocking parser...");
      await verifyPaymentAndResume();
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        navigate(`/login?next=${encodeURIComponent(`/parser?notice=${noticeCode}`)}`);
        return;
      }
      const message = toUserMessage(error, "Could not complete payment. Please retry.");
      setErrorMessage(message);
      setStatusMessage(null);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const startTestPaymentSimulation = async () => {
    if (!isLoggedIn) {
      navigate(`/login?next=${encodeURIComponent(`/parser?notice=${noticeCode}`)}`);
      return;
    }
    if (!selectedPlanKey) {
      setErrorMessage("No payment plan available for test simulation.");
      return;
    }

    setIsSimulatingPayment(true);
    setErrorMessage(null);
    setStatusMessage("Simulating successful payment and adding credits...");
    try {
      const rawUser = localStorage.getItem("user");
      const userEmail =
        rawUser && rawUser !== ""
          ? ((JSON.parse(rawUser) as { email?: string }).email || "")
          : "";

      await confirmTestPayment({
        plan_key: selectedPlanKey,
        user_email: userEmail || undefined,
      });

      const latest = await refreshEntitlements();
      setPaymentRequired(false);
      setStatusMessage("Test payment confirmed. Credits updated.");

      if (pendingUpload && (latest?.parser_credits || 0) > 0) {
        await performUpload(pendingUpload.file, pendingUpload.noticeCode || undefined);
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        navigate(`/login?next=${encodeURIComponent(`/parser?notice=${noticeCode}`)}`);
        return;
      }
      const message = toUserMessage(error, "Could not simulate test payment. Please retry.");
      setErrorMessage(message);
      setStatusMessage(null);
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setParserJob(null);
    setErrorMessage(null);
    setStatusMessage(null);

    if (!selectedFile) {
      setErrorMessage("Please choose a PDF, image, or text file.");
      return;
    }

    if (!isLoggedIn) {
      navigate(`/login?next=${encodeURIComponent(`/parser?notice=${noticeCode}`)}`);
      return;
    }

    const uploadDraft = { file: selectedFile, noticeCode: noticeCode.trim() || null };
    setPendingUpload(uploadDraft);
    await performUpload(uploadDraft.file, uploadDraft.noticeCode || undefined);
  };

  const handleSaveNotice = async () => {
    if (!parserJob?.notice) {
      setSaveNoticeError("Notice is not detected yet, so it cannot be saved.");
      return;
    }
    await saveDetectedNotice(parserJob.notice, {
      source: "manual",
      parserJobId: parserJob.id,
      parserSnapshot: {
        parser_job_id: parserJob.id,
        notice_code: parserJob.notice_code || "",
        status: parserJob.status,
        confidence: parserJob.confidence,
        deadline_date: parserJob.extraction?.deadline_date || "",
        legal_section: parserJob.extraction?.legal_section || "",
        amount_claimed: parserJob.extraction?.amount_claimed || "",
      },
      actionStatus: "not_started",
      caBrief,
      nextStepsChecklist: actionChecklist,
    });
  };

  const handleCopyBrief = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard is unavailable");
      }
      await navigator.clipboard.writeText(caBrief);
      setCopyBriefMessage("Case brief copied.");
    } catch {
      setCopyBriefMessage("Copy failed. Select and copy manually.");
    }
  };

  return (
    <div className="grid-aurora min-h-screen overflow-x-hidden px-4 py-8 text-slate-900 sm:px-5 sm:py-10">
      <div className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -left-20 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl" />

      <main className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <BrandMark to="/" imageClassName="h-9 w-auto" />
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
          >
            <span aria-hidden>&larr;</span> Back to search
          </Link>
          <Link
            to="/saved"
            className="inline-flex items-center rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 sm:text-sm"
          >
            Safe
          </Link>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7">
            <p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-700">
              Paid parser flow
            </p>
            <h1 className="font-display mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Upload Notice & Understand
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Upload your notice, complete quick checkout, and unlock a personalized response pack:
              detected notice type, legal section, deadline risk, and a CA-ready handoff brief.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Notice code (optional)
                </label>
                <input
                  value={noticeCode}
                  onChange={(event) => setNoticeCode(event.target.value.toUpperCase())}
                  placeholder="Example: GST-DRC-01"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Notice file
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.txt"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setSelectedFile(file);
                  }}
                  className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-700"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Supported: PDF, PNG, JPG, JPEG, WEBP, and TXT. For best OCR, upload clear scans.
                </p>
              </div>

              <button
                type="submit"
                disabled={isUploading || isProcessingPayment || isVerifyingPayment}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 disabled:opacity-60"
              >
                {(isUploading || isProcessingPayment || isVerifyingPayment) && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                {isUploading
                  ? "Processing upload..."
                  : isProcessingPayment
                    ? "Opening checkout..."
                    : isVerifyingPayment
                      ? "Verifying payment..."
                      : "Upload & Continue"}
              </button>
            </form>

            {statusMessage && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {statusMessage}
              </div>
            )}
            {errorMessage && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            )}

            {parserJob && (
              <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Parser result
                  </p>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                    {parserJob.status.replace("_", " ")}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Notice detected</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {parserJob.notice_code || "Not detected"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Confidence</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {confidencePercent}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Legal section</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {parserJob.extraction?.legal_section || "Not detected"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Amount claimed</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {parserJob.extraction?.amount_claimed || "Not detected"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Reply deadline</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {replyDeadlineLabel}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">Urgency guidance</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{urgencyText}</p>
                    {deadlineDaysLeft !== null && (
                      <p className="mt-1 text-xs text-slate-500">
                        {deadlineDaysLeft < 0
                          ? `${Math.abs(deadlineDaysLeft)} day(s) overdue`
                          : `${deadlineDaysLeft} day(s) remaining`}
                      </p>
                    )}
                  </div>
                </div>

                {isCodeMismatch && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Uploaded notice appears different from entered code. Entered:{" "}
                    <span className="font-semibold">{noticeCode.trim().toUpperCase()}</span>, detected:{" "}
                    <span className="font-semibold">{parserJob.notice_code}</span>.
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Personalized response pack
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        riskBand === "critical"
                          ? "bg-rose-100 text-rose-700"
                          : riskBand === "high"
                            ? "bg-amber-100 text-amber-700"
                            : riskBand === "medium"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {riskBand} priority
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {actionChecklist.map((item, index) => (
                      <div key={`${item}-${index}`} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                          {index + 1}
                        </span>
                        <p className="leading-6">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {(ocrUsed || lowConfidence) && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">OCR context</p>
                    {ocrUsed ? (
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        OCR processed {ocrPagesProcessed || 1} page(s)
                        {ocrTextChars !== null ? ` and extracted ~${ocrTextChars} readable chars.` : "."}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-700">
                        OCR was not needed for this file. Embedded text extraction was used.
                      </p>
                    )}
                    {ocrEngine && (
                      <p className="mt-1 text-xs text-slate-500">
                        Engine: {ocrEngine === "pymupdf_text" ? "PyMuPDF text extraction" : ocrEngine}
                      </p>
                    )}
                    {lowConfidence && (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                        Low confidence detected. Manual review is recommended before acting on this output.
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">CA handoff brief</p>
                    <button
                      type="button"
                      onClick={() => void handleCopyBrief()}
                      className="text-xs font-semibold text-blue-700 transition hover:text-blue-800"
                    >
                      Copy brief
                    </button>
                  </div>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-700">
                    {caBrief}
                  </pre>
                  {copyBriefMessage && <p className="mt-2 text-xs text-emerald-700">{copyBriefMessage}</p>}
                </div>
                {parserJob.extraction?.raw_text_excerpt && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">
                        Text excerpt
                      </p>
                      {parserJob.extraction.raw_text_excerpt.length > 420 && (
                        <button
                          type="button"
                          onClick={() => setShowFullExcerpt((value) => !value)}
                          className="text-xs font-semibold text-blue-700 transition hover:text-blue-800"
                        >
                          {showFullExcerpt ? "Hide full text" : "Show full text"}
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      {showFullExcerpt
                        ? parserJob.extraction.raw_text_excerpt
                        : `${parserJob.extraction.raw_text_excerpt.slice(0, 420)}${
                            parserJob.extraction.raw_text_excerpt.length > 420 ? "..." : ""
                          }`}
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-blue-700">
                    Understand this notice
                  </p>

                  {isLoadingNoticeExplain && (
                    <p className="mt-2 text-sm text-slate-600">Loading plain-English explanation...</p>
                  )}

                  {noticeExplainError && (
                    <p className="mt-2 text-sm text-rose-700">{noticeExplainError}</p>
                  )}

                  {!isLoadingNoticeExplain && !noticeExplainError && detectedNotice && (
                    <div className="mt-4 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                          {detectedNotice.code}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            detectedNotice.severity === "high"
                              ? "bg-rose-100 text-rose-700"
                              : detectedNotice.severity === "medium"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {detectedNotice.severity} severity
                        </span>
                      </div>

                      <div>
                        <p className="text-lg font-bold text-slate-900">{detectedNotice.title}</p>
                        <p className="mt-1 text-base leading-7 text-slate-700">{detectedNotice.summary}</p>
                      </div>

                      {detectedNotice.why_received && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-blue-700">
                            Why you likely got this
                          </p>
                          <p className="mt-1 text-[15px] leading-7 text-slate-700">{detectedNotice.why_received}</p>
                        </div>
                      )}

                      {detectedNotice.consequences_of_ignoring && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-rose-700">
                            If you ignore this
                          </p>
                          <p className="mt-1 text-[15px] leading-7 text-rose-900">
                            {detectedNotice.consequences_of_ignoring}
                          </p>
                        </div>
                      )}

                      {detectedNotice.next_steps && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-blue-700">
                            What to do next
                          </p>
                          <p className="mt-1 whitespace-pre-line text-[15px] leading-7 text-blue-900">
                            {detectedNotice.next_steps}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {!isLoadingNoticeExplain && !noticeExplainError && !detectedNotice && (
                    <p className="mt-2 text-sm text-slate-600">
                      We extracted fields, but could not confidently map this to a known notice yet.
                      Enter notice code manually for a clearer explanation.
                    </p>
                  )}

                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveNotice()}
                      disabled={isSavingNotice || !parserJob.notice}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingNotice ? "Saving..." : "Save to Safe"}
                    </button>
                    <Link
                      to={`/ca-help?notice=${encodeURIComponent(parserJob.notice_code || noticeCode || "")}`}
                      className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      Talk to a CA
                    </Link>
                    </div>
                    {!parserJob.notice && (
                      <p className="mt-2 text-xs text-slate-500">
                        Save becomes available after notice detection.
                      </p>
                    )}
                    {saveNoticeMessage && (
                      <p className="mt-2 text-sm text-emerald-700">{saveNoticeMessage}</p>
                    )}
                    {saveNoticeError && (
                      <p className="mt-2 text-sm text-rose-700">{saveNoticeError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.07)] sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Credits
              </p>
              <p className="font-display mt-2 text-3xl font-bold text-slate-900">
                {loadingBootstrap ? "..." : entitlements?.parser_credits ?? 0}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Available parser unlocks for your account.
              </p>
            </section>

            <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.07)] sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Payment plan
              </p>
              {selectedPlan ? (
                <>
                  <h2 className="font-display mt-2 text-2xl font-bold tracking-tight text-slate-900">
                    {formatCurrencyINR(selectedPlan.amount_inr)}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{selectedPlan.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedPlan.credits} parser credit{selectedPlan.credits > 1 ? "s" : ""} per
                    payment.
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {selectedPlan.description || "One payment unlocks one parser result instantly."}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-600">No active plans available right now.</p>
              )}

              <div className="mt-4 space-y-2">
                {plans.map((plan) => (
                  <button
                    key={plan.key}
                    type="button"
                    onClick={() => setSelectedPlanKey(plan.key)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                      selectedPlanKey === plan.key
                        ? "border-blue-300 bg-blue-50 text-blue-800"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{plan.name}</span>
                      <span>{formatCurrencyINR(plan.amount_inr)}</span>
                    </div>
                  </button>
                ))}
              </div>

              {(paymentRequired || (pendingUpload && !isUploading)) && (
                <div className="mt-5 space-y-2">
                  <button
                    type="button"
                    onClick={() => void startPayment()}
                    disabled={isProcessingPayment || isVerifyingPayment || !selectedPlan}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                  >
                    {(isProcessingPayment || isVerifyingPayment) && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    )}
                    {isProcessingPayment
                      ? "Opening checkout..."
                      : isVerifyingPayment
                        ? "Verifying payment..."
                        : `Pay ${selectedPlan ? formatCurrencyINR(selectedPlan.amount_inr) : ""} & Unlock`}
                  </button>
                  <button
                    type="button"
                    onClick={() => void verifyPaymentAndResume()}
                    disabled={isProcessingPayment || isVerifyingPayment || !pendingUpload}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-60"
                  >
                    I already paid, check again
                  </button>
                </div>
              )}

              {ENABLE_TEST_PAYMENT && isLoggedIn && isAdminUser && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                    Internal testing
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    Simulates payment success and credits without charging a real payment method.
                  </p>
                  <button
                    type="button"
                    onClick={() => void startTestPaymentSimulation()}
                    disabled={isSimulatingPayment || isUploading || isProcessingPayment || isVerifyingPayment || !selectedPlan}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
                  >
                    {isSimulatingPayment && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-amber-700" />
                    )}
                    {isSimulatingPayment ? "Simulating payment..." : "Simulate Payment Success"}
                  </button>
                </div>
              )}

              {!isLoggedIn && (
                <Link
                  to={`/login?next=${encodeURIComponent(`/parser?notice=${noticeCode}`)}`}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Sign in to continue
                </Link>
              )}
            </section>

            <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 text-sm text-slate-600 shadow-[0_20px_60px_rgba(15,23,42,0.07)] sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                How it works
              </p>
              <ol className="mt-3 space-y-2">
                <li>1. Upload your notice file.</li>
                <li>2. Complete secure Cashfree checkout.</li>
                <li>3. Result unlocks with extracted fields, risk checklist, and CA handoff brief.</li>
              </ol>
              <Link
                to={`/ca-help?notice=${encodeURIComponent(parserJob?.notice_code || noticeCode || "")}`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                Talk to a CA
              </Link>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}

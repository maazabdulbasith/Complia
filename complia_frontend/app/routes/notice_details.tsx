import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/notice_details";
import {
  getAssistedOfferConfig,
  getNotice,
  getSavedNotices,
  recordExperimentExposure,
  removeSavedNotice,
  saveNotice,
  submitAssistedIntent,
  submitFeedback,
  type AssistedOfferConfig,
} from "../api/client";
import { getAnalyticsSessionId, trackEvent } from "../lib/analytics";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const notice = await getNotice(params.id);
  return { notice };
}

export function meta({ data }: Route.MetaArgs) {
  const notice = data?.notice;
  if (!notice) {
    return [
      { title: "Complia | Notice Details" },
      { name: "description", content: "Detailed tax notice explanation and next steps." },
    ];
  }

  return [
    { title: notice.meta_title || `Complia | ${notice.code} - ${notice.title}` },
    { name: "description", content: notice.meta_description || notice.summary },
    { property: "og:title", content: notice.meta_title || `${notice.code} - ${notice.title}` },
    { property: "og:description", content: notice.meta_description || notice.summary },
    { property: "og:type", content: "article" },
  ];
}

function severityMeta(severity: "low" | "medium" | "high") {
  if (severity === "high") {
    return {
      label: "High priority",
      badge: "bg-rose-50 text-rose-700 ring-rose-200",
      card: "border-rose-200 bg-rose-50/70",
    };
  }
  if (severity === "medium") {
    return {
      label: "Review needed",
      badge: "bg-amber-50 text-amber-700 ring-amber-200",
      card: "border-amber-200 bg-amber-50/70",
    };
  }
  return {
    label: "Informational",
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    card: "border-sky-200 bg-sky-50/70",
  };
}

export default function NoticeDetails({ loaderData }: Route.ComponentProps) {
  const { notice } = loaderData;
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [savedNoticeId, setSavedNoticeId] = useState<number | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [assistedIntentLoading, setAssistedIntentLoading] = useState(false);
  const [showAssistedModal, setShowAssistedModal] = useState(false);
  const [assistedIntentSuccess, setAssistedIntentSuccess] = useState<string | null>(null);
  const [assistedIntentError, setAssistedIntentError] = useState<string | null>(null);
  const [assistedName, setAssistedName] = useState("");
  const [assistedEmail, setAssistedEmail] = useState("");
  const [assistedPhone, setAssistedPhone] = useState("");
  const [assistedMessage, setAssistedMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [offerVariant, setOfferVariant] = useState<"control" | "variant_a">("control");
  const [assistedOfferConfig, setAssistedOfferConfig] = useState<AssistedOfferConfig | null>(null);
  const assistedNameInputRef = useRef<HTMLInputElement | null>(null);

  const offerKey = assistedOfferConfig?.offer?.key || "assisted_response_pack_v1";
  const offerTargetSeverity = assistedOfferConfig?.offer?.target_severity || "high";
  const offerAllowedForSeverity = offerTargetSeverity === "all" || offerTargetSeverity === notice.severity;
  const showAssistedOffer = Boolean(assistedOfferConfig?.enabled && assistedOfferConfig.offer && offerAllowedForSeverity);

  const tone = severityMeta(notice.severity);
  const noticeSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: notice.title,
    description: notice.summary,
    dateModified: notice.updated_at,
    author: {
      "@type": "Organization",
      name: "Complia",
    },
  };

  useEffect(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("complia_token")));
    const rawUser = localStorage.getItem("user");
    if (rawUser) {
      try {
        const user = JSON.parse(rawUser) as { email?: string; first_name?: string; last_name?: string };
        const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
        if (fullName) {
          setAssistedName(fullName);
        }
        if (user.email) {
          setAssistedEmail(user.email);
        }
      } catch {
        localStorage.removeItem("user");
      }
    }

    const sessionId = getAnalyticsSessionId();
    const variant = sessionId.slice(-1).charCodeAt(0) % 2 === 0 ? "control" : "variant_a";
    setOfferVariant(variant);

    const loadOfferConfig = async () => {
      try {
        const config = await getAssistedOfferConfig();
        setAssistedOfferConfig(config);
      } catch {
        setAssistedOfferConfig({ enabled: false, offer: null });
      }
    };

    void loadOfferConfig();
  }, []);

  useEffect(() => {
    trackEvent("notice_opened", {
      notice_code: notice.code,
      severity: notice.severity,
    });
  }, [notice.code, notice.severity]);

  useEffect(() => {
    if (!showAssistedOffer) {
      return;
    }
    trackEvent("assisted_offer_seen", {
      notice_code: notice.code,
      offer_key: offerKey,
      variant: offerVariant,
    });
    void recordExperimentExposure({
      session_id: getAnalyticsSessionId(),
      experiment_key: offerKey,
      variant: offerVariant,
      path: `/notice/${notice.code}`,
      metadata: { severity: notice.severity },
    });
  }, [notice.code, notice.severity, offerKey, offerVariant, showAssistedOffer]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }
    const loadSavedState = async () => {
      try {
        const saved = await getSavedNotices();
        const match = saved.find((item) => item.notice.id === notice.id);
        setSavedNoticeId(match ? match.id : null);
      } catch {
        setSavedNoticeId(null);
      }
    };
    void loadSavedState();
  }, [isLoggedIn, notice.id]);

  useEffect(() => {
    if (!showAssistedModal) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      assistedNameInputRef.current?.focus();
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !assistedIntentLoading) {
        setShowAssistedModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showAssistedModal, assistedIntentLoading]);

  const openAssistedModal = () => {
    setAssistedIntentError(null);
    setAssistedIntentSuccess(null);
    setShowAssistedModal(true);
  };

  const closeAssistedModal = () => {
    if (assistedIntentLoading) {
      return;
    }
    setShowAssistedModal(false);
  };

  const handleFeedback = async (isHelpful: boolean, text?: string) => {
    if (!isHelpful && !(text || "").trim()) {
      setFeedbackError("Please tell us what was unclear before submitting.");
      return;
    }

    try {
      await submitFeedback(notice.id, isHelpful, text);
      setFeedbackSubmitted(true);
      setFeedbackError(null);
      trackEvent("notice_feedback_submitted", {
        notice_code: notice.code,
        is_helpful: isHelpful,
      });
    } catch {
      setFeedbackError("Could not submit feedback. Please retry.");
    }
  };

  const handleSaveToggle = async () => {
    if (!isLoggedIn) {
      setSaveError("Sign in to save this notice.");
      return;
    }

    setSaveLoading(true);
    setSaveError(null);
    try {
      if (savedNoticeId) {
        await removeSavedNotice(savedNoticeId);
        setSavedNoticeId(null);
        trackEvent("notice_unsaved", { notice_code: notice.code });
      } else {
        await saveNotice(notice.id);
        const saved = await getSavedNotices();
        const match = saved.find((item) => item.notice.id === notice.id);
        setSavedNoticeId(match ? match.id : null);
        trackEvent("notice_saved", { notice_code: notice.code });
      }
    } catch {
      setSaveError("Could not update saved status. Please retry.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAssistedIntent = async () => {
    if (!isLoggedIn) {
      setAssistedIntentError("Please sign in before starting assisted response.");
      return;
    }

    if (!assistedEmail.trim() && !assistedPhone.trim()) {
      setAssistedIntentError("Please provide at least email or phone so we can contact you.");
      return;
    }

    setAssistedIntentLoading(true);
    setAssistedIntentError(null);
    try {
      await submitAssistedIntent({
        notice_id: notice.id,
        offer_key: offerKey,
        name: assistedName.trim(),
        email: assistedEmail.trim(),
        phone_number: assistedPhone.trim(),
        notice_code_snapshot: notice.code,
        severity_snapshot: notice.severity,
        source_path: `/notice/${notice.code}`,
        experiment_key: offerKey,
        experiment_variant: offerVariant,
        metadata: { cta: "assisted_pack", notes: assistedMessage.trim() },
      });
      trackEvent("assisted_offer_clicked", {
        notice_code: notice.code,
        offer_key: offerKey,
        variant: offerVariant,
      });
      setAssistedIntentSuccess("Request submitted. Our team will contact you shortly.");
      setTimeout(() => {
        setShowAssistedModal(false);
      }, 1200);
    } catch {
      setAssistedIntentError("Could not submit request right now. Please try again.");
    } finally {
      setAssistedIntentLoading(false);
    }
  };

  return (
    <div className="grid-aurora min-h-screen overflow-x-hidden text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(noticeSchema) }}
      />
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-5 sm:pt-8 md:pt-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 sm:px-4"
          >
            <span aria-hidden>&larr;</span> Back to search
          </Link>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tone.badge}`}>{tone.label}</span>
        </div>

        <article className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:rounded-[30px]">
          <header className="border-b border-slate-200/80 bg-linear-to-r from-slate-50 to-blue-50/60 px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {notice.code}
              </span>
              {notice.source_section && (
                <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                  {notice.source_section}
                </span>
              )}
            </div>
            <h1 className="font-display mt-4 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl md:text-5xl md:leading-[1.05]">{notice.title}</h1>
            <p className="mt-3 max-w-4xl break-words text-base leading-7 text-slate-600 sm:mt-4 sm:text-lg sm:leading-8">{notice.summary}</p>
          </header>

          <div className="grid gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 md:grid-cols-[1fr_320px] md:px-10 md:py-10">
            <div className="space-y-8">
              <section>
                <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">What this notice means</h2>
                <p className="mt-4 whitespace-pre-line break-words text-[15px] leading-7 text-slate-700">{notice.detailed_explanation}</p>
              </section>

              {notice.why_received && (
                <section>
                  <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Why you received it</h2>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-[15px] leading-7 text-slate-700 break-words">
                    {notice.why_received}
                  </div>
                </section>
              )}

              <section className={`rounded-2xl border p-5 ${tone.card}`}>
                <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">If this is ignored</h2>
                <p className="mt-3 text-[15px] leading-7 text-slate-700 break-words">{notice.consequences_of_ignoring}</p>
              </section>

              <section className="rounded-2xl border border-blue-200 bg-linear-to-r from-blue-600 to-cyan-500 p-6 text-white shadow-lg shadow-blue-600/20">
                <h2 className="font-display text-xl font-bold tracking-tight">Recommended next steps</h2>
                <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-7 text-blue-50">{notice.next_steps}</p>
              </section>
            </div>

            <aside className="space-y-4 md:sticky md:top-24 md:self-start">
              {notice.common_mistakes && (
                <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.13em] text-rose-700">Common mistakes</h3>
                  <p className="mt-2 text-sm leading-6 text-rose-800">{notice.common_mistakes}</p>
                </section>
              )}

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.13em] text-slate-600">Take action</h3>
                <div className="mt-3 space-y-2">
                  <button
                    onClick={handleSaveToggle}
                    disabled={saveLoading}
                    className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                  >
                    {saveLoading ? "Updating..." : savedNoticeId ? "Saved (Remove)" : "Save this notice"}
                  </button>
                  <Link
                    to={`/ca-help?notice=${encodeURIComponent(notice.code)}`}
                    onClick={() => trackEvent("ca_help_cta_clicked", { notice_code: notice.code })}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    Talk to a CA
                  </Link>
                  {saveError && <p className="text-xs text-rose-600">{saveError}</p>}
                </div>
              </section>

              {showAssistedOffer && (
                <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-violet-700">
                    {assistedOfferConfig?.offer?.name || "Assisted Response Pack"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-violet-900">
                    {assistedOfferConfig?.offer?.description || "Need done-for-you drafting support? Start with a guided assisted response flow."}
                  </p>
                  <button
                    onClick={openAssistedModal}
                    disabled={assistedIntentLoading}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
                  >
                    {assistedIntentLoading ? "Starting..." : "Start Assisted Response"}
                  </button>
                </section>
              )}
            </aside>
          </div>
        </article>

        <section className="mx-auto mt-8 max-w-2xl rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.07)] sm:mt-10 sm:p-6">
          {!feedbackSubmitted ? (
            <>
              <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">Was this useful?</h2>
              <p className="mt-2 text-sm text-slate-600">Your feedback helps improve explanations and next-step guidance.</p>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => void handleFeedback(true)}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  Yes, helpful
                </button>
                <button
                  onClick={() => {
                    setShowCommentInput(true);
                    setFeedbackError(null);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                >
                  Needs improvement
                </button>
              </div>

              {showCommentInput && (
                <div className="mt-4 space-y-2">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    placeholder="Tell us what was missing or unclear"
                  />
                  <button
                    onClick={() => void handleFeedback(false, comment)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    Submit feedback
                  </button>
                </div>
              )}

              {feedbackError && <p className="mt-3 text-sm text-rose-600">{feedbackError}</p>}
            </>
          ) : (
            <p className="font-semibold text-emerald-700">Thanks for the feedback. We use this to improve notice guidance quality.</p>
          )}
        </section>
      </div>

      {showAssistedModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center sm:p-6"
          onClick={closeAssistedModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="assisted-response-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 id="assisted-response-title" className="font-display text-xl font-bold tracking-tight text-slate-900">
                Start Assisted Response
              </h3>
              <button
                type="button"
                onClick={closeAssistedModal}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
              >
                Close
              </button>
            </div>

            <p className="mb-4 text-sm text-slate-600">
              Share contact details so our team can help you respond to <span className="font-semibold">{notice.code}</span>.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                ref={assistedNameInputRef}
                value={assistedName}
                onChange={(event) => setAssistedName(event.target.value)}
                placeholder="Your name"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100 sm:col-span-2"
              />
              <input
                value={assistedEmail}
                onChange={(event) => setAssistedEmail(event.target.value)}
                placeholder="Email"
                type="email"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
              <input
                value={assistedPhone}
                onChange={(event) => setAssistedPhone(event.target.value)}
                placeholder="Phone"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
              <textarea
                value={assistedMessage}
                onChange={(event) => setAssistedMessage(event.target.value)}
                rows={3}
                placeholder="Optional context (deadline, amount, urgency)"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100 sm:col-span-2"
              />
            </div>

            {assistedIntentError && <p className="mt-3 text-sm text-rose-600">{assistedIntentError}</p>}
            {assistedIntentSuccess && <p className="mt-3 text-sm font-semibold text-emerald-700">{assistedIntentSuccess}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAssistedModal}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                Cancel
              </button>
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={() => void handleAssistedIntent()}
                  disabled={assistedIntentLoading}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
                >
                  {assistedIntentLoading ? "Submitting..." : "Submit Request"}
                </button>
              ) : (
                <Link
                  to={`/login?next=${encodeURIComponent(`/notice/${notice.code}`)}`}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  Sign in to continue
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/notice_details";
import {
  getNotice,
  getSavedNotices,
  removeSavedNotice,
  saveNotice,
  submitFeedback,
} from "../api/client";
import { trackEvent } from "../lib/analytics";

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const notice = await getNotice(params.id);
  return { notice };
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const tone = severityMeta(notice.severity);

  useEffect(() => {
    setIsLoggedIn(Boolean(localStorage.getItem("complia_token")));
  }, []);

  useEffect(() => {
    trackEvent("notice_detail_viewed", {
      notice_code: notice.code,
      severity: notice.severity,
    });
  }, [notice.code, notice.severity]);

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

  return (
    <div className="grid-aurora min-h-screen overflow-x-hidden text-slate-900">
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
    </div>
  );
}

import { Link } from "react-router";
import { useCallback, useEffect, useState } from "react";

import { getSavedNotices, updateSafeEntry } from "../api/client";
import type { SavedNotice } from "../api/client";
import BrandMark from "../lib/brand_mark";
import { trackEvent } from "../lib/analytics";

function severityTone(severity: "low" | "medium" | "high") {
  if (severity === "high") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  if (severity === "medium") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  return "bg-sky-50 text-sky-700 ring-sky-200";
}

function actionTone(status: "not_started" | "in_progress" | "done") {
  if (status === "done") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (status === "in_progress") {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

function actionLabel(status: "not_started" | "in_progress" | "done") {
  if (status === "done") return "Done";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value : "";
}

function readNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatDate(value: string): string {
  if (!value) return "Not detected";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SafeSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
      <div className="animate-shimmer absolute inset-0 bg-linear-to-r from-transparent via-slate-100/70 to-transparent" />
      <div className="mb-3 h-4 w-24 rounded bg-slate-100" />
      <div className="mb-3 h-6 w-2/3 rounded bg-slate-100" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-slate-100" />
        <div className="h-4 w-5/6 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function SavedNoticesPage() {
  const [items, setItems] = useState<SavedNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [copyMessageId, setCopyMessageId] = useState<number | null>(null);

  const loadSafeItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuthRequired(false);
    try {
      const data = await getSavedNotices();
      setItems(data);
      trackEvent("saved_notices_viewed", { item_count: data.length, workspace: "safe" });
    } catch (apiError) {
      const message = apiError instanceof Error ? apiError.message : "Please sign in to view Safe.";
      setError(message);
      setAuthRequired(/sign in|login|token|unauthorized|401/i.test(message));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSafeItems();
  }, [loadSafeItems]);

  const updateActionStatus = async (
    safeId: number,
    actionStatus: "not_started" | "in_progress" | "done"
  ) => {
    setSavingId(safeId);
    setError(null);
    try {
      const updated = await updateSafeEntry(safeId, { action_status: actionStatus });
      setItems((prev) => prev.map((item) => (item.id === safeId ? updated : item)));
      trackEvent("safe_action_status_updated", { safe_id: safeId, action_status: actionStatus });
    } catch {
      setError("Could not update Safe action status. Please retry.");
    } finally {
      setSavingId(null);
    }
  };

  const copyCABrief = async (safeId: number, text: string) => {
    if (!text.trim()) {
      setError("No CA brief available to copy for this entry.");
      return;
    }
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(text);
      setCopyMessageId(safeId);
      window.setTimeout(() => setCopyMessageId((current) => (current === safeId ? null : current)), 1800);
    } catch {
      setError("Could not copy CA brief. Please copy it manually.");
    }
  };

  return (
    <div className="grid-aurora min-h-screen overflow-x-hidden px-4 py-6 text-slate-900 sm:px-5 sm:py-8">
      <main className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <BrandMark to="/" imageClassName="h-9 w-auto" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">My workspace</p>
            <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Safe</h1>
            <p className="mt-1 text-sm text-slate-600">Your saved notices, parser outputs, and next actions in one place.</p>
          </div>
          <Link
            to="/"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
          >
            Back to search
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            <SafeSkeleton />
            <SafeSkeleton />
            <SafeSkeleton />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
            <p className="text-sm font-semibold text-rose-800">{error}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {authRequired ? (
                <Link
                  to="/login?next=/saved"
                  className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
                >
                  Sign in to continue
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void loadSafeItems()}
                  className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
                >
                  Retry
                </button>
              )}
              <Link
                to="/"
                className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300"
              >
                Browse notices
              </Link>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <p className="text-base font-semibold text-slate-900">Safe is empty.</p>
            <p className="mt-2 text-sm text-slate-600">
              Save a notice or complete a paid parse to build your action workspace.
            </p>
            <Link
              to="/"
              className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Start now
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const status = item.action_status || "not_started";
              const snapshot = (item.parser_snapshot || {}) as Record<string, unknown>;
              const checklist = item.next_steps_checklist || [];
              const caBrief = item.ca_brief || readString(snapshot, "ca_brief");
              const confidence = readNumber(snapshot, "confidence");
              const legalSection = readString(snapshot, "legal_section") || "Not detected";
              const amountClaimed = readString(snapshot, "amount_claimed") || "Not detected";
              const deadlineDate = formatDate(readString(snapshot, "deadline_date"));

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs font-semibold text-slate-600">{item.notice.code}</p>
                      <h2 className="font-display mt-1 text-xl font-bold tracking-tight text-slate-900">{item.notice.title}</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${severityTone(item.notice.severity)}`}>
                        {item.notice.severity}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${actionTone(status)}`}>
                        {actionLabel(status)}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.notice.summary}</p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Paid parser snapshot</p>
                      {item.parser_job_id ? (
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          <p>Confidence: {confidence !== null ? `${Math.round(confidence * 100)}%` : "N/A"}</p>
                          <p>Legal section: {legalSection}</p>
                          <p>Amount claimed: {amountClaimed}</p>
                          <p>Deadline: {deadlineDate}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">No paid parser result linked yet.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Next actions</p>
                      {checklist.length > 0 ? (
                        <ol className="mt-2 space-y-1 text-sm text-slate-700">
                          {checklist.slice(0, 4).map((step, index) => (
                            <li key={`${item.id}-${index}`} className="leading-6">
                              {index + 1}. {step}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">No checklist available yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">CA brief</p>
                      <button
                        type="button"
                        onClick={() => void copyCABrief(item.id, caBrief)}
                        className="rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        Copy CA brief
                      </button>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-blue-900">
                      {caBrief || "No CA brief saved yet."}
                    </p>
                    {copyMessageId === item.id && (
                      <p className="mt-2 text-xs font-semibold text-emerald-700">Copied.</p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <select
                      value={status}
                      onChange={(event) =>
                        void updateActionStatus(
                          item.id,
                          event.target.value as "not_started" | "in_progress" | "done"
                        )
                      }
                      disabled={savingId === item.id}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>

                    <Link
                      to={`/notice/${item.notice.code}`}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                    >
                      Open notice
                    </Link>
                    <Link
                      to={`/ca-help?notice=${encodeURIComponent(item.notice.code)}`}
                      className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      Talk to a CA
                    </Link>

                    {savingId === item.id && <span className="text-xs text-slate-500">Saving...</span>}
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    Added on {new Date(item.created_at).toLocaleDateString()} · Updated {new Date(item.updated_at || item.created_at).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

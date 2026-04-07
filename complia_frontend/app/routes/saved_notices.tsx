import { Link } from "react-router";
import { useCallback, useEffect, useState } from "react";

import { getMyCAHelpRequests, getSavedNotices, updateSafeEntry } from "../api/client";
import type { MyCAHelpRequest, SavedNotice } from "../api/client";
import BrandMark from "../lib/brand_mark";
import { trackEvent } from "../lib/analytics";
import type { Route } from "./+types/saved_notices";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complia | Safe" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

function severityTone(severity: "low" | "medium" | "high") {
  if (severity === "high") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  if (severity === "medium") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  return "bg-indigo-50 text-indigo-800 ring-indigo-200";
}

function actionTone(status: "not_started" | "in_progress" | "done") {
  if (status === "done") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (status === "in_progress") {
    return "bg-indigo-50 text-indigo-800 ring-indigo-200";
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

function caseStatusTone(status: "new" | "triaged" | "assigned" | "contacted" | "engaged" | "resolved" | "closed") {
  if (status === "resolved" || status === "closed") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "engaged" || status === "contacted") return "bg-indigo-50 text-indigo-800 ring-indigo-200";
  if (status === "assigned" || status === "triaged") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

function caseStatusLabel(status: "new" | "triaged" | "assigned" | "contacted" | "engaged" | "resolved" | "closed") {
  return status.replace("_", " ");
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
  const [caRequests, setCARequests] = useState<MyCAHelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [copyMessageId, setCopyMessageId] = useState<number | null>(null);

  const unlinkedCARequests = caRequests.filter(
    (request) => !request.notice_code || !items.some((item) => item.notice.code === request.notice_code)
  );

  const loadSafeItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuthRequired(false);
    try {
      const [data, requests] = await Promise.all([getSavedNotices(), getMyCAHelpRequests()]);
      setItems(data);
      setCARequests(requests);
      trackEvent("saved_notices_viewed", { item_count: data.length, ca_request_count: requests.length, workspace: "safe" });
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
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-800">My workspace</p>
            <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Safe</h1>
            <p className="mt-1 text-sm text-slate-600">Your saved notices, parser outputs, and next actions in one place.</p>
          </div>
          <Link
            to="/"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-800"
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
        ) : items.length === 0 && caRequests.length === 0 ? (
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
        ) : items.length > 0 ? (
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
              const decisionHeadline = readString(snapshot, "decision_headline") || "Saved parser workspace";
              const decisionExplanation = readString(snapshot, "decision_explanation");
              const immediateNextMove = readString(snapshot, "immediate_next_move");
              const urgencyGuidance = readString(snapshot, "urgency_guidance");
              const riskBand = readString(snapshot, "risk_band");
              const caRequest = item.ca_request;

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

                  <div className="mt-4 rounded-2xl border border-slate-900/10 bg-gradient-to-br from-slate-950 via-slate-900 to-[#132f72] p-5 text-white shadow-[0_20px_50px_rgba(15,23,42,0.14)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-200/90">
                          Saved parser workspace
                        </p>
                        <h3 className="mt-2 text-2xl font-bold tracking-tight">{decisionHeadline}</h3>
                      </div>
                      {riskBand && (
                        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/15">
                          {riskBand}
                        </span>
                      )}
                    </div>
                    {decisionExplanation && (
                      <p className="mt-3 text-sm leading-7 text-white/85">{decisionExplanation}</p>
                    )}
                    {immediateNextMove && (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/6 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-100/80">
                          Immediate next move
                        </p>
                        <p className="mt-2 text-sm leading-7 text-white/90">{immediateNextMove}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Paid parser snapshot</p>
                      {item.parser_job_id ? (
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          <p>Confidence: {confidence !== null ? `${Math.round(confidence * 100)}%` : "N/A"}</p>
                          <p>Legal section: {legalSection}</p>
                          <p>Amount claimed: {amountClaimed}</p>
                          <p>Deadline: {deadlineDate}</p>
                          {urgencyGuidance && <p>Urgency: {urgencyGuidance}</p>}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">No paid parser result linked yet.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Next actions</p>
                      {checklist.length > 0 ? (
                        <ol className="mt-2 space-y-1 text-sm text-slate-700">
                          {checklist.map((step, index) => (
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

                  <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-800">CA request status</p>
                        <p className="mt-1 text-sm text-slate-700">
                          {caRequest
                            ? "Track where your CA handoff currently stands."
                            : "No CA request started yet for this notice."}
                        </p>
                      </div>
                      {caRequest && (
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ring-1 ${caseStatusTone(caRequest.status)}`}>
                          {caseStatusLabel(caRequest.status)}
                        </span>
                      )}
                    </div>
                    {caRequest ? (
                      <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                        <p>Priority: <span className="font-semibold">{caRequest.priority}</span></p>
                        <p>Assigned CA: <span className="font-semibold">{caRequest.assigned_ca_name || caRequest.assigned_to_email || "Pending assignment"}</span></p>
                        <p>Assigned at: <span className="font-semibold">{caRequest.assigned_at ? new Date(caRequest.assigned_at).toLocaleString() : "Pending"}</span></p>
                        <p>First contact: <span className="font-semibold">{caRequest.contacted_at ? new Date(caRequest.contacted_at).toLocaleString() : "Pending"}</span></p>
                        <p>Engaged at: <span className="font-semibold">{caRequest.engaged_at ? new Date(caRequest.engaged_at).toLocaleString() : "Pending"}</span></p>
                        <p>Closed at: <span className="font-semibold">{caRequest.closed_at ? new Date(caRequest.closed_at).toLocaleString() : "Open"}</span></p>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <Link
                          to={`/ca-help?notice=${encodeURIComponent(item.notice.code)}`}
                          className="inline-flex rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100"
                        >
                          Start CA request
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {item.notice.why_received && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-800">
                          Why you likely got this
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-700">{item.notice.why_received}</p>
                      </div>
                    )}
                    {item.notice.consequences_of_ignoring && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-700">
                          If you ignore this
                        </p>
                        <p className="mt-2 text-sm leading-7 text-rose-900">{item.notice.consequences_of_ignoring}</p>
                      </div>
                    )}
                  </div>

                  {item.notice.next_steps && (
                    <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-800">
                        What to do next
                      </p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-7 text-indigo-900">{item.notice.next_steps}</p>
                    </div>
                  )}

                  <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-800">CA brief</p>
                      <button
                        type="button"
                        onClick={() => void copyCABrief(item.id, caBrief)}
                        className="rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-800 transition hover:bg-indigo-100"
                      >
                        Copy CA brief
                      </button>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-indigo-900">
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
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-800"
                    >
                      Open notice
                    </Link>
                    <Link
                      to={`/ca-help?notice=${encodeURIComponent(item.notice.code)}`}
                      className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100"
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
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <p className="text-base font-semibold text-slate-900">No saved notices yet.</p>
            <p className="mt-2 text-sm text-slate-600">
              Your CA request tracking is still available below, even if you started from the homepage or without saving a notice first.
            </p>
          </div>
        )}

        {!loading && unlinkedCARequests.length > 0 && (
          <section className="mt-6 rounded-2xl border border-indigo-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-800">CA request tracker</p>
                <h2 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900">Advisor follow-up status</h2>
                <p className="mt-1 text-sm text-slate-600">This includes homepage or general CA requests even when they were not started from a saved notice.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {unlinkedCARequests.map((request) => (
                <div key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {request.notice_code ? request.notice_code : "General CA request"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Created on {new Date(request.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ring-1 ${caseStatusTone(request.status)}`}>
                      {caseStatusLabel(request.status)}
                    </span>
                  </div>
                  {request.message && <p className="mt-3 text-sm leading-6 text-slate-700">{request.message}</p>}
                  <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-3">
                    <p>Priority: <span className="font-semibold">{request.priority}</span></p>
                    <p>Assigned CA: <span className="font-semibold">{request.assigned_ca_name || request.assigned_to_email || "Pending assignment"}</span></p>
                    <p>Assigned at: <span className="font-semibold">{request.assigned_at ? new Date(request.assigned_at).toLocaleString() : "Pending"}</span></p>
                    <p>First contact: <span className="font-semibold">{request.contacted_at ? new Date(request.contacted_at).toLocaleString() : "Pending"}</span></p>
                    <p>Engaged at: <span className="font-semibold">{request.engaged_at ? new Date(request.engaged_at).toLocaleString() : "Pending"}</span></p>
                    <p>Closed at: <span className="font-semibold">{request.closed_at ? new Date(request.closed_at).toLocaleString() : "Open"}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

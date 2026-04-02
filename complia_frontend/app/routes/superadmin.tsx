import { Link, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";

import {
  downloadAdminCsvReport,
  getAdminAssistedIntents,
  getAdminCARequests,
  getAdminFeedbackItems,
  getAdminNoticeItems,
  getAdminParserBenchmarks,
  getAdminParserJobs,
  getSuperAdminFunnel,
  getSuperAdminKpis,
  getSuperAdminMetrics,
  updateAdminAssistedIntent,
  updateAdminCARequest,
  updateAdminFeedbackItem,
  updateAdminNoticeItem,
  updateAdminParserJob,
} from "../api/client";
import type {
  AdminCsvReportKey,
  AdminAssistedIntent,
  AdminCARequest,
  AdminFeedbackItem,
  AdminFunnel,
  AdminKpis,
  AdminMetrics,
  AdminNoticeItem,
  ParserJob,
  ParserBenchmarkRun,
} from "../api/client";
import { trackEvent } from "../lib/analytics";

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 backdrop-blur-xl p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">{label}</p>
      <p className={`text-3xl font-bold tracking-tight ${accent}`}>{value}</p>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [funnel, setFunnel] = useState<AdminFunnel | null>(null);
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [windowSize, setWindowSize] = useState<"7d" | "30d">("7d");
  const [caRequests, setCARequests] = useState<AdminCARequest[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<AdminFeedbackItem[]>([]);
  const [assistedIntents, setAssistedIntents] = useState<AdminAssistedIntent[]>([]);
  const [noticeQaItems, setNoticeQaItems] = useState<AdminNoticeItem[]>([]);
  const [parserJobs, setParserJobs] = useState<ParserJob[]>([]);
  const [parserBenchmarkRuns, setParserBenchmarkRuns] = useState<ParserBenchmarkRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [caStatusFilter, setCAStatusFilter] = useState<string>("");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>("");
  const [assistedStatusFilter, setAssistedStatusFilter] = useState<string>("");
  const [noticeQaFilter, setNoticeQaFilter] = useState<"" | "stale" | "unverified">("");
  const [parserStatusFilter, setParserStatusFilter] = useState<string>("");
  const [exportingReport, setExportingReport] = useState<AdminCsvReportKey | null>(null);

  const user = useMemo(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { email?: string; user_type?: string };
    } catch {
      localStorage.removeItem("user");
      return null;
    }
  }, []);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    setError(null);
    setAccessDenied(false);
    try {
      const [
        metricData,
        funnelData,
        kpiData,
        caData,
        feedbackData,
        assistedData,
        noticeQaData,
        parserData,
        parserBenchmarkData,
      ] = await Promise.all([
        getSuperAdminMetrics(),
        getSuperAdminFunnel(windowSize),
        getSuperAdminKpis(windowSize),
        getAdminCARequests(caStatusFilter || undefined),
        getAdminFeedbackItems(feedbackStatusFilter || undefined),
        getAdminAssistedIntents(assistedStatusFilter || undefined),
        getAdminNoticeItems(noticeQaFilter || undefined),
        getAdminParserJobs(parserStatusFilter || undefined),
        getAdminParserBenchmarks(),
      ]);
      setMetrics(metricData);
      setFunnel(funnelData);
      setKpis(kpiData);
      setCARequests(caData);
      setFeedbackItems(feedbackData);
      setAssistedIntents(assistedData);
      setNoticeQaItems(noticeQaData);
      setParserJobs(parserData);
      setParserBenchmarkRuns(parserBenchmarkData);
    } catch (apiError) {
      const message = apiError instanceof Error ? apiError.message : "";
      const isAccessError = /access denied|admin|permission|forbidden|401|403|sign in|login|unauthorized/i.test(message);
      setAccessDenied(isAccessError);
      setError(
        isAccessError
          ? "This account cannot access SuperAdmin. Sign in with an admin account."
          : "Admin data is unavailable right now. Please refresh and retry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem("complia_token")) {
      navigate("/login?next=/superadmin");
      return;
    }
    void fetchAll();
    trackEvent("admin_dashboard_viewed");
  }, [navigate]);

  useEffect(() => {
    if (loading) return;
    void fetchAll(true);
  }, [
    windowSize,
    caStatusFilter,
    feedbackStatusFilter,
    assistedStatusFilter,
    noticeQaFilter,
    parserStatusFilter,
  ]);

  useEffect(() => {
    if (!metrics) return;

    const intervalId = window.setInterval(() => {
      trackEvent("admin_dashboard_heartbeat");
      void fetchAll(true);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [
    metrics,
    windowSize,
    caStatusFilter,
    feedbackStatusFilter,
    assistedStatusFilter,
    noticeQaFilter,
    parserStatusFilter,
  ]);

  const handleCAUpdate = async (
    requestId: number,
    payload: Partial<Pick<AdminCARequest, "status" | "priority" | "assigned_to_email" | "internal_notes">>
  ) => {
    const key = `ca-${requestId}`;
    setSavingKey(key);
    try {
      const updated = await updateAdminCARequest(requestId, payload);
      setCARequests((prev) => prev.map((item) => (item.id === requestId ? updated : item)));
      trackEvent("admin_ca_request_updated", { request_id: requestId, status: updated.status });
    } catch {
      setError("Failed to update CA request. Please retry.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleFeedbackUpdate = async (
    feedbackId: number,
    payload: Partial<Pick<AdminFeedbackItem, "status" | "internal_notes">>
  ) => {
    const key = `fb-${feedbackId}`;
    setSavingKey(key);
    try {
      const updated = await updateAdminFeedbackItem(feedbackId, payload);
      setFeedbackItems((prev) => prev.map((item) => (item.id === feedbackId ? updated : item)));
      trackEvent("admin_feedback_updated", { feedback_id: feedbackId, status: updated.status });
    } catch {
      setError("Failed to update feedback. Please retry.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleAssistedIntentUpdate = async (
    intentId: number,
    payload: Partial<Pick<AdminAssistedIntent, "status" | "operator_notes">>
  ) => {
    const key = `intent-${intentId}`;
    setSavingKey(key);
    try {
      const updated = await updateAdminAssistedIntent(intentId, payload);
      setAssistedIntents((prev) => prev.map((item) => (item.id === intentId ? updated : item)));
      trackEvent("admin_ca_request_updated", { entity: "assisted_intent", intent_id: intentId, status: updated.status });
    } catch {
      setError("Failed to update assisted intent. Please retry.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleNoticeQaUpdate = async (
    noticeId: number,
    payload: Partial<
      Pick<AdminNoticeItem, "is_active" | "verified_by" | "verified_at" | "meta_title" | "meta_description">
    >
  ) => {
    const key = `notice-${noticeId}`;
    setSavingKey(key);
    try {
      const updated = await updateAdminNoticeItem(noticeId, payload);
      setNoticeQaItems((prev) => prev.map((item) => (item.id === noticeId ? updated : item)));
      trackEvent("admin_feedback_updated", { entity: "notice_qa", notice_id: noticeId });
    } catch {
      setError("Failed to update notice metadata. Please retry.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleParserJobUpdate = async (
    parserJobId: number,
    payload: Partial<Pick<ParserJob, "status" | "review_notes">> & {
      extraction_review_status?: "pending" | "approved" | "rejected";
    }
  ) => {
    const key = `parser-${parserJobId}`;
    setSavingKey(key);
    try {
      const updated = await updateAdminParserJob(parserJobId, payload);
      setParserJobs((prev) => prev.map((item) => (item.id === parserJobId ? updated : item)));
      trackEvent("admin_feedback_updated", { entity: "parser_job", parser_job_id: parserJobId, status: updated.status });
    } catch {
      setError("Failed to update parser job. Please retry.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleCsvExport = async (reportKey: AdminCsvReportKey, statusFilter?: string) => {
    setExportingReport(reportKey);
    setError(null);
    try {
      await downloadAdminCsvReport(reportKey, statusFilter);
    } catch {
      setError("Failed to export CSV. Please retry.");
    } finally {
      setExportingReport(null);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-100 via-indigo-50 to-cyan-50 text-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-500 font-bold">Complia Operations</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">SuperAdmin Command Center</h1>
            <p className="text-slate-600 mt-2">Complete in-app operations inbox. No Django admin required.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              Back to product
            </Link>
            <button
              onClick={() => void fetchAll(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-white/60 bg-white/70 p-8 text-slate-600">Loading live business metrics...</div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-rose-700">
            <p className="font-semibold">{error}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {accessDenied ? (
                <Link
                  to="/login?next=/superadmin"
                  className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
                >
                  Sign in as admin
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void fetchAll(true)}
                  className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
                >
                  Retry
                </button>
              )}
              <Link
                to="/"
                className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300"
              >
                Back to product
              </Link>
            </div>
          </div>
        ) : metrics ? (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              <StatCard label="Visitors Till Date" value={metrics.total_visitors} accent="text-indigo-600" />
              <StatCard label="Visitors Today" value={metrics.visitors_today} accent="text-cyan-600" />
              <StatCard label="Total Searches" value={metrics.total_searches} accent="text-violet-600" />
              <StatCard label="CA Help Requests" value={metrics.ca_help_submissions} accent="text-rose-600" />
            </section>

            <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold text-slate-900">Conversion Funnel + KPI Trends</h2>
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                  <button
                    onClick={() => setWindowSize("7d")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${windowSize === "7d" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
                  >
                    7 days
                  </button>
                  <button
                    onClick={() => setWindowSize("30d")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${windowSize === "30d" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
                  >
                    30 days
                  </button>
                </div>
              </div>

              {funnel && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                  {Object.entries(funnel.steps).map(([step, count]) => (
                    <div key={step} className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">{step.replaceAll("_", " ")}</p>
                      <p className="text-2xl font-bold text-slate-900">{count}</p>
                      <p className="text-xs text-slate-500">{funnel.conversion_rates[step]}%</p>
                    </div>
                  ))}
                </div>
              )}

              {kpis && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.entries(kpis.current).map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">{key.replaceAll("_", " ")}</p>
                      <p className="text-xl font-bold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
              <div className="xl:col-span-2 rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Most Searched Notice</h2>
                <p className="text-2xl font-black tracking-tight text-slate-900 mb-2 break-words sm:text-3xl">{metrics.most_searched_notice}</p>
                <p className="text-slate-600">Searched {metrics.most_searched_notice_count} time(s)</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Detail Views</h2>
                <p className="text-4xl font-black text-emerald-600">{metrics.total_notice_views}</p>
                <p className="text-slate-600 mt-2">Total notice detail pages viewed.</p>
              </div>
            </section>

            <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-slate-900">
                  Assisted Intent Inbox
                  <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    {assistedIntents.length}
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={assistedStatusFilter}
                    onChange={(e) => setAssistedStatusFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All Statuses</option>
                    <option value="new">New</option>
                    <option value="triaged">Triaged</option>
                    <option value="contacted">Contacted</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleCsvExport("assisted_intents", assistedStatusFilter || undefined)}
                    disabled={exportingReport === "assisted_intents"}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60"
                  >
                    {exportingReport === "assisted_intents" ? "Exporting..." : "Export CSV"}
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                {assistedIntents.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-3">
                      <div>
                        <p className="font-semibold text-slate-900 break-words">
                          {item.notice_code_snapshot || "Unknown notice"} · {item.notice_title || "Unmapped"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {item.email || "No email"} · {item.phone_number || "No phone"} · Severity: {item.severity_snapshot || "N/A"}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-2">
                      <select
                        value={item.status}
                        onChange={(e) => void handleAssistedIntentUpdate(item.id, { status: e.target.value as AdminAssistedIntent["status"] })}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      >
                        <option value="new">New</option>
                        <option value="triaged">Triaged</option>
                        <option value="contacted">Contacted</option>
                        <option value="won">Won</option>
                        <option value="lost">Lost</option>
                        <option value="closed">Closed</option>
                      </select>
                      <input
                        defaultValue={item.operator_notes || ""}
                        onBlur={(e) => {
                          if (e.target.value !== item.operator_notes) {
                            void handleAssistedIntentUpdate(item.id, { operator_notes: e.target.value.trim() });
                          }
                        }}
                        placeholder="Operator notes / outcome"
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      />
                    </div>
                    {savingKey === `intent-${item.id}` && <p className="text-xs text-slate-500 mt-2">Saving...</p>}
                  </div>
                ))}
                {assistedIntents.length === 0 && (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    No assisted intents match this filter yet.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-slate-900">
                  Notice Editorial QA
                  <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    {noticeQaItems.length}
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={noticeQaFilter}
                    onChange={(e) => setNoticeQaFilter(e.target.value as "" | "stale" | "unverified")}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All Notices</option>
                    <option value="unverified">Unverified</option>
                    <option value="stale">Stale (90+ days)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleCsvExport("notice_qa", noticeQaFilter || undefined)}
                    disabled={exportingReport === "notice_qa"}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60"
                  >
                    {exportingReport === "notice_qa" ? "Exporting..." : "Export CSV"}
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                {noticeQaItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {item.code} · {item.title}
                        </p>
                        <p className="text-sm text-slate-500">
                          Severity: {item.severity} · {item.is_stale ? "Stale" : "Fresh"} · {item.is_active ? "Active" : "Inactive"}
                        </p>
                      </div>
                      <button
                        onClick={() => void handleNoticeQaUpdate(item.id, { is_active: !item.is_active })}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
                      >
                        {item.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        defaultValue={item.verified_by || ""}
                        onBlur={(e) => {
                          const trimmed = e.target.value.trim();
                          if (trimmed !== (item.verified_by || "")) {
                            void handleNoticeQaUpdate(item.id, {
                              verified_by: trimmed,
                              verified_at: trimmed ? new Date().toISOString() : "",
                            });
                          }
                        }}
                        placeholder="Verified by"
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      />
                      <input
                        defaultValue={item.meta_title || ""}
                        onBlur={(e) => {
                          if (e.target.value !== (item.meta_title || "")) {
                            void handleNoticeQaUpdate(item.id, { meta_title: e.target.value.trim() });
                          }
                        }}
                        placeholder="Meta title"
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      />
                      <input
                        defaultValue={item.meta_description || ""}
                        onBlur={(e) => {
                          if (e.target.value !== (item.meta_description || "")) {
                            void handleNoticeQaUpdate(item.id, { meta_description: e.target.value.trim() });
                          }
                        }}
                        placeholder="Meta description"
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      />
                    </div>
                    {savingKey === `notice-${item.id}` && <p className="text-xs text-slate-500 mt-2">Saving...</p>}
                  </div>
                ))}
                {noticeQaItems.length === 0 && (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    No notice records match this QA filter.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-slate-900">
                  Parser Review Queue
                  <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    {parserJobs.length}
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={parserStatusFilter}
                    onChange={(e) => setParserStatusFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All statuses</option>
                    <option value="queued">Queued</option>
                    <option value="review_required">Review required</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleCsvExport("parser_jobs", parserStatusFilter || undefined)}
                    disabled={exportingReport === "parser_jobs"}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60"
                  >
                    {exportingReport === "parser_jobs" ? "Exporting..." : "Export CSV"}
                  </button>
                </div>
              </div>

              {parserBenchmarkRuns[0] && (
                <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-indigo-700">
                    Latest Parser Benchmark
                  </p>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                    <div>
                      <p className="text-slate-500">Samples</p>
                      <p className="font-bold text-slate-900">{parserBenchmarkRuns[0].sample_count}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Overall F1</p>
                      <p className="font-bold text-slate-900">{(parserBenchmarkRuns[0].overall_f1 * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Notice P/R</p>
                      <p className="font-bold text-slate-900">
                        {(parserBenchmarkRuns[0].notice_precision * 100).toFixed(1)}% / {(parserBenchmarkRuns[0].notice_recall * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Section P/R</p>
                      <p className="font-bold text-slate-900">
                        {(parserBenchmarkRuns[0].section_precision * 100).toFixed(1)}% / {(parserBenchmarkRuns[0].section_recall * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Amount P/R</p>
                      <p className="font-bold text-slate-900">
                        {(parserBenchmarkRuns[0].amount_precision * 100).toFixed(1)}% / {(parserBenchmarkRuns[0].amount_recall * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {parserJobs.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-3">
                      <div>
                        <p className="font-semibold text-slate-900">#{item.id} · {item.original_filename}</p>
                        <p className="text-sm text-slate-500">
                          {item.notice_code || "Unknown"} · Confidence {Math.round(item.confidence * 100)}%
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <select
                        value={item.status}
                        onChange={(e) => void handleParserJobUpdate(item.id, { status: e.target.value as ParserJob["status"] })}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      >
                        <option value="queued">Queued</option>
                        <option value="review_required">Review Required</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                      </select>
                      <select
                        value={item.extraction?.review_status || "pending"}
                        onChange={(e) => void handleParserJobUpdate(item.id, { extraction_review_status: e.target.value as "pending" | "approved" | "rejected" })}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      >
                        <option value="pending">Extraction Pending</option>
                        <option value="approved">Extraction Approved</option>
                        <option value="rejected">Extraction Rejected</option>
                      </select>
                      <input
                        defaultValue={item.review_notes || ""}
                        onBlur={(e) => {
                          if (e.target.value !== item.review_notes) {
                            void handleParserJobUpdate(item.id, { review_notes: e.target.value.trim() });
                          }
                        }}
                        placeholder="Reviewer notes"
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      />
                    </div>
                    {savingKey === `parser-${item.id}` && <p className="text-xs text-slate-500 mt-2">Saving...</p>}
                  </div>
                ))}
                {parserJobs.length === 0 && (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    No parser jobs match this filter.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-slate-900">
                  CA Requests Inbox
                  <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    {caRequests.length}
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={caStatusFilter}
                    onChange={(e) => {
                      setCAStatusFilter(e.target.value);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All Statuses</option>
                    <option value="new">New</option>
                    <option value="triaged">Triaged</option>
                    <option value="contacted">Contacted</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleCsvExport("ca_requests", caStatusFilter || undefined)}
                    disabled={exportingReport === "ca_requests"}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60"
                  >
                    {exportingReport === "ca_requests" ? "Exporting..." : "Export CSV"}
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                {caRequests.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-3">
                      <div>
                        <p className="font-semibold text-slate-900 break-words">{item.name} · {item.email}</p>
                        <p className="text-sm text-slate-500">Notice: {item.notice_code || "General"} · {item.phone_number || "No phone"}</p>
                      </div>
                      <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    {item.message && <p className="text-sm text-slate-700 mb-3">{item.message}</p>}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
                      <select
                        value={item.status}
                        onChange={(e) => void handleCAUpdate(item.id, { status: e.target.value as AdminCARequest["status"] })}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      >
                        <option value="new">New</option>
                        <option value="triaged">Triaged</option>
                        <option value="contacted">Contacted</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                      <select
                        value={item.priority}
                        onChange={(e) => void handleCAUpdate(item.id, { priority: e.target.value as AdminCARequest["priority"] })}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <input
                        defaultValue={item.assigned_to_email || ""}
                        onBlur={(e) => {
                          if (e.target.value !== item.assigned_to_email) {
                            void handleCAUpdate(item.id, { assigned_to_email: e.target.value.trim() });
                          }
                        }}
                        placeholder="Assign owner email"
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      />
                      <input
                        defaultValue={item.internal_notes || ""}
                        onBlur={(e) => {
                          if (e.target.value !== item.internal_notes) {
                            void handleCAUpdate(item.id, { internal_notes: e.target.value.trim() });
                          }
                        }}
                        placeholder="Internal notes"
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      />
                    </div>
                    {savingKey === `ca-${item.id}` && <p className="text-xs text-slate-500 mt-2">Saving...</p>}
                  </div>
                ))}
                {caRequests.length === 0 && (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    No CA requests match this filter.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-slate-900">
                  Feedback Inbox
                  <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    {feedbackItems.length}
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={feedbackStatusFilter}
                    onChange={(e) => {
                      setFeedbackStatusFilter(e.target.value);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All Statuses</option>
                    <option value="new">New</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleCsvExport("feedback", feedbackStatusFilter || undefined)}
                    disabled={exportingReport === "feedback"}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60"
                  >
                    {exportingReport === "feedback" ? "Exporting..." : "Export CSV"}
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                {feedbackItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-3">
                      <div>
                        <p className="font-semibold text-slate-900 break-words">{item.notice_code} · {item.notice_title}</p>
                        <p className="text-sm text-slate-500">Helpful: {item.is_helpful ? "Yes" : "No"}</p>
                      </div>
                      <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    {item.comments && <p className="text-sm text-slate-700 mb-3">{item.comments}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <select
                        value={item.status}
                        onChange={(e) => void handleFeedbackUpdate(item.id, { status: e.target.value as AdminFeedbackItem["status"] })}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      >
                        <option value="new">New</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="resolved">Resolved</option>
                      </select>
                      <input
                        defaultValue={item.internal_notes || ""}
                        onBlur={(e) => {
                          if (e.target.value !== item.internal_notes) {
                            void handleFeedbackUpdate(item.id, { internal_notes: e.target.value.trim() });
                          }
                        }}
                        placeholder="Internal notes"
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      />
                    </div>
                    {savingKey === `fb-${item.id}` && <p className="text-xs text-slate-500 mt-2">Saving...</p>}
                  </div>
                ))}
                {feedbackItems.length === 0 && (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    No feedback items match this filter.
                  </p>
                )}
              </div>
            </section>
          </>
        ) : null}
      </main>

      {metrics && (
        <aside className="fixed bottom-3 right-3 left-3 z-50 rounded-2xl border border-slate-200 bg-white shadow-2xl p-4 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[300px]">
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Live Pulse</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Visitors till date</span>
              <span className="font-bold text-slate-900">{metrics.total_visitors}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Live visitors</span>
              <span className="font-bold text-emerald-600">{metrics.live_visitors}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Top searched</span>
              <span className="font-bold text-indigo-600 truncate max-w-[130px]" title={metrics.most_searched_notice}>
                {metrics.most_searched_notice}
              </span>
            </div>
            <div className="text-xs text-slate-500 pt-1">Signed in as {user?.email || "Admin"}</div>
          </div>
        </aside>
      )}
    </div>
  );
}


import { Link, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";

import {
  getAdminCARequests,
  getAdminFeedbackItems,
  getSuperAdminMetrics,
  updateAdminCARequest,
  updateAdminFeedbackItem,
} from "../api/client";
import type { AdminCARequest, AdminFeedbackItem, AdminMetrics } from "../api/client";
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
  const [caRequests, setCARequests] = useState<AdminCARequest[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<AdminFeedbackItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [caStatusFilter, setCAStatusFilter] = useState<string>("");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>("");

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
    try {
      const [metricData, caData, feedbackData] = await Promise.all([
        getSuperAdminMetrics(),
        getAdminCARequests(caStatusFilter || undefined),
        getAdminFeedbackItems(feedbackStatusFilter || undefined),
      ]);
      setMetrics(metricData);
      setCARequests(caData);
      setFeedbackItems(feedbackData);
    } catch {
      setError("Access denied or admin data unavailable. Ensure this account is admin.");
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
  }, [caStatusFilter, feedbackStatusFilter]);

  useEffect(() => {
    if (!metrics) return;

    const intervalId = window.setInterval(() => {
      trackEvent("admin_dashboard_heartbeat");
      void fetchAll(true);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [metrics, caStatusFilter, feedbackStatusFilter]);

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
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-rose-700">{error}</div>
        ) : metrics ? (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              <StatCard label="Visitors Till Date" value={metrics.total_visitors} accent="text-indigo-600" />
              <StatCard label="Visitors Today" value={metrics.visitors_today} accent="text-cyan-600" />
              <StatCard label="Total Searches" value={metrics.total_searches} accent="text-violet-600" />
              <StatCard label="CA Help Requests" value={metrics.ca_help_submissions} accent="text-rose-600" />
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
                <h2 className="text-xl font-bold text-slate-900">CA Requests Inbox</h2>
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
                {caRequests.length === 0 && <p className="text-sm text-slate-500">No CA requests match this filter.</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-slate-900">Feedback Inbox</h2>
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
                {feedbackItems.length === 0 && <p className="text-sm text-slate-500">No feedback items match this filter.</p>}
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

import { Link, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";

import { getSuperAdminMetrics } from "../api/client";
import type { AdminMetrics } from "../api/client";
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const fetchMetrics = async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    setError(null);
    try {
      const data = await getSuperAdminMetrics();
      setMetrics(data);
    } catch (fetchError) {
      setError("Access denied or metrics unavailable. Ensure this account is admin.");
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
    void fetchMetrics();
    trackEvent("admin_dashboard_viewed");
  }, [navigate]);

  useEffect(() => {
    if (!metrics) return;

    const intervalId = window.setInterval(() => {
      trackEvent("admin_dashboard_heartbeat");
      void fetchMetrics(true);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [metrics]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-cyan-50 text-slate-900">
      <main className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-500 font-bold">Complia Operations</p>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">SuperAdmin Command Center</h1>
            <p className="text-slate-600 mt-2">Plain-English product pulse for non-technical admins.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            >
              Back to product
            </Link>
            <button
              onClick={() => void fetchMetrics(true)}
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

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Most Searched Notice</h2>
                <p className="text-3xl font-black tracking-tight text-slate-900 mb-2">{metrics.most_searched_notice}</p>
                <p className="text-slate-600">Searched {metrics.most_searched_notice_count} time(s)</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Detail Views</h2>
                <p className="text-4xl font-black text-emerald-600">{metrics.total_notice_views}</p>
                <p className="text-slate-600 mt-2">Total notice detail pages viewed.</p>
              </div>
            </section>
          </>
        ) : null}
      </main>

      {metrics && (
        <aside className="fixed bottom-6 right-6 w-[300px] rounded-2xl border border-slate-200 bg-white shadow-2xl p-4 z-50">
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

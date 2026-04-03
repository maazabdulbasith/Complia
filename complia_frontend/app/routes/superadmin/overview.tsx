import { OverviewActionLink, SectionHeader, StatCard, useSuperAdmin } from "./shared";

export default function SuperAdminOverviewPage() {
  const { metrics, funnel, kpis, windowSize, setWindowSize, actionQueueItems } = useSuperAdmin();

  return (
    <>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Visitors Till Date" value={metrics.total_visitors} accent="text-indigo-600" />
        <StatCard label="Visitors Today" value={metrics.visitors_today} accent="text-cyan-600" />
        <StatCard label="Total Searches" value={metrics.total_searches} accent="text-violet-600" />
        <StatCard label="CA Help Requests" value={metrics.ca_help_submissions} accent="text-rose-600" />
      </section>

      <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Action Queue</h2>
            <p className="text-sm text-slate-600">Jump straight to the parts of ops that need attention now.</p>
          </div>
          <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Live triage</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {actionQueueItems.map((item) => (
            <OverviewActionLink key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionHeader title="Conversion Funnel + KPI Trends" />
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
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Object.entries(kpis.current).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{key.replaceAll("_", " ")}</p>
                <p className="text-xl font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm xl:col-span-2">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Most Searched Notice</h2>
          <p className="mb-2 break-words text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            {metrics.most_searched_notice}
          </p>
          <p className="text-slate-600">Searched {metrics.most_searched_notice_count} time(s)</p>
        </div>
        <div className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Detail Views</h2>
          <p className="text-4xl font-black text-emerald-600">{metrics.total_notice_views}</p>
          <p className="mt-2 text-slate-600">Total notice detail pages viewed.</p>
        </div>
      </section>
    </>
  );
}

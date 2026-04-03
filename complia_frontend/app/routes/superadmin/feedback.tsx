import type { AdminFeedbackItem } from "../../api/client";
import { EmptyState, SectionHeader, useSuperAdmin } from "./shared";

export default function SuperAdminFeedbackPage() {
  const {
    feedbackItems,
    feedbackStatusFilter,
    setFeedbackStatusFilter,
    exportingReport,
    savingKey,
    handleCsvExport,
    handleFeedbackUpdate,
  } = useSuperAdmin();

  return (
    <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
      <SectionHeader title="Feedback" count={feedbackItems.length}>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={feedbackStatusFilter}
            onChange={(e) => setFeedbackStatusFilter(e.target.value)}
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
      </SectionHeader>

      <div className="space-y-4">
        {feedbackItems.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="break-words font-semibold text-slate-900">
                  {item.notice_code} · {item.notice_title}
                </p>
                <p className="text-sm text-slate-500">Helpful: {item.is_helpful ? "Yes" : "No"}</p>
              </div>
              <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
            </div>

            {item.comments && <p className="mb-3 text-sm text-slate-700">{item.comments}</p>}

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <select
                value={item.status}
                onChange={(e) =>
                  void handleFeedbackUpdate(item.id, { status: e.target.value as AdminFeedbackItem["status"] })
                }
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
            {savingKey === `fb-${item.id}` && <p className="mt-2 text-xs text-slate-500">Saving...</p>}
          </div>
        ))}

        {feedbackItems.length === 0 && <EmptyState>No feedback items match this filter.</EmptyState>}
      </div>
    </section>
  );
}

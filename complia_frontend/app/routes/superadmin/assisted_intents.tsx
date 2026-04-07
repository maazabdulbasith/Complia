import type { AdminAssistedIntent } from "../../api/client";
import { AdminPageIntro, EmptyState, SectionHeader, useSuperAdmin } from "./shared";

export default function SuperAdminAssistedIntentsPage() {
  const {
    assistedIntents,
    assistedStatusFilter,
    setAssistedStatusFilter,
    exportingReport,
    savingKey,
    handleCsvExport,
    handleAssistedIntentUpdate,
  } = useSuperAdmin();

  return (
    <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
      <AdminPageIntro
        eyebrow="SuperAdmin / Assisted Intents"
        title="Assisted Intent Inbox"
        description="Triage people who showed paid-assistance intent, capture outcomes, and keep the experiment funnel measurable."
        badge="Lead ops"
      />
      <SectionHeader title="Assisted Intents" count={assistedIntents.length}>
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
      </SectionHeader>

      <div className="space-y-4">
        {assistedIntents.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="break-words font-semibold text-slate-900">
                  {item.notice_code_snapshot || "Unknown notice"} · {item.notice_title || "Unmapped"}
                </p>
                <p className="text-sm text-slate-500">
                  {item.email || "No email"} · {item.phone_number || "No phone"} · Severity: {item.severity_snapshot || "N/A"}
                </p>
              </div>
              <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr]">
              <select
                value={item.status}
                onChange={(e) =>
                  void handleAssistedIntentUpdate(item.id, { status: e.target.value as AdminAssistedIntent["status"] })
                }
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
            {savingKey === `intent-${item.id}` && <p className="mt-2 text-xs text-slate-500">Saving...</p>}
          </div>
        ))}

        {assistedIntents.length === 0 && <EmptyState>No assisted intents match this filter yet.</EmptyState>}
      </div>
    </section>
  );
}


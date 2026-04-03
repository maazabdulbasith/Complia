import type { AdminCARequest } from "../../api/client";
import { AdminPageIntro, EmptyState, SectionHeader, useSuperAdmin } from "./shared";

export default function SuperAdminCaRequestsPage() {
  const {
    caRequests,
    caPanel,
    caStatusFilter,
    setCAStatusFilter,
    exportingReport,
    savingKey,
    handleCsvExport,
    handleCAUpdate,
  } = useSuperAdmin();

  return (
    <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
      <AdminPageIntro
        eyebrow="SuperAdmin / CA Requests"
        title="CA Request Handoff"
        description="Review consented user requests, set urgency, assign a vetted CA, and move each case through contact to resolution."
        badge="Case ops"
      />
      <SectionHeader title="CA Requests" count={caRequests.length}>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={caStatusFilter}
            onChange={(e) => setCAStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="triaged">Triaged</option>
            <option value="assigned">Assigned</option>
            <option value="contacted">Contacted</option>
            <option value="engaged">Engaged</option>
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
      </SectionHeader>

      {caPanel.length === 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No vetted CA panel entries are available yet. Requests can be reviewed here, but assignment choices will stay empty until you add at least one vetted CA in the CA Panel section.
        </div>
      )}

      <div className="space-y-4">
        {caRequests.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="break-words font-semibold text-slate-900">
                  {item.name} · {item.email}
                </p>
                <p className="text-sm text-slate-500">
                  Notice: {item.notice_code || "General"} · {item.phone_number || "No phone"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      item.consent_to_share_with_ca ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {item.consent_to_share_with_ca ? "Consent captured" : "Consent missing"}
                  </span>
                  {item.assigned_to_email && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                      Assigned to {item.assigned_to_email}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
            </div>

            {item.message && <p className="mb-3 text-sm text-slate-700">{item.message}</p>}

            <div className="mb-3 grid grid-cols-1 gap-2 text-xs text-slate-500 md:grid-cols-2 xl:grid-cols-4">
              <p>Consent recorded: {item.consent_recorded_at ? new Date(item.consent_recorded_at).toLocaleString() : "Not recorded"}</p>
              <p>Assigned at: {item.assigned_at ? new Date(item.assigned_at).toLocaleString() : "Pending"}</p>
              <p>Case shared: {item.shared_case_materials_at ? new Date(item.shared_case_materials_at).toLocaleString() : "Pending"}</p>
              <p>Engaged at: {item.engaged_at ? new Date(item.engaged_at).toLocaleString() : "Pending"}</p>
            </div>

            <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
              <select
                value={item.status}
                onChange={(e) => void handleCAUpdate(item.id, { status: e.target.value as AdminCARequest["status"] })}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="new">New</option>
                <option value="triaged">Triaged</option>
                <option value="assigned">Assigned</option>
                <option value="contacted">Contacted</option>
                <option value="engaged">Engaged</option>
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
              <select
                value={item.assigned_ca ?? ""}
                onChange={(e) =>
                  void handleCAUpdate(item.id, {
                    assigned_ca: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">Assign vetted CA</option>
                {caPanel.map((ca) => (
                  <option key={ca.id} value={ca.id}>
                    {ca.display_name} · {ca.city || ca.email}
                  </option>
                ))}
              </select>
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
            {savingKey === `ca-${item.id}` && <p className="mt-2 text-xs text-slate-500">Saving...</p>}
          </div>
        ))}

        {caRequests.length === 0 && <EmptyState>No CA requests match this filter.</EmptyState>}
      </div>
    </section>
  );
}


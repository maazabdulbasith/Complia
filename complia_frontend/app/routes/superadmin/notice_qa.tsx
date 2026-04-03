import { EmptyState, SectionHeader, useSuperAdmin } from "./shared";

export default function SuperAdminNoticeQaPage() {
  const {
    noticeQaItems,
    noticeQaFilter,
    setNoticeQaFilter,
    exportingReport,
    savingKey,
    handleCsvExport,
    handleNoticeQaUpdate,
  } = useSuperAdmin();

  return (
    <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
      <SectionHeader title="Notice Content QA" count={noticeQaItems.length}>
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
      </SectionHeader>

      <div className="space-y-4">
        {noticeQaItems.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
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

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
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
            {savingKey === `notice-${item.id}` && <p className="mt-2 text-xs text-slate-500">Saving...</p>}
          </div>
        ))}

        {noticeQaItems.length === 0 && <EmptyState>No notice content records match this QA filter.</EmptyState>}
      </div>
    </section>
  );
}

import { useEffect } from "react";
import { useSearchParams } from "react-router";

import { AdminPageIntro, EmptyState, SectionHeader, useSuperAdmin } from "./shared";

const reviewTone: Record<"watch" | "trusted" | "needs_review", string> = {
  watch: "bg-amber-100 text-amber-800",
  trusted: "bg-emerald-100 text-emerald-700",
  needs_review: "bg-rose-100 text-rose-700",
};

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
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const status = (
      searchParams.get("status") || ""
    ) as "" | "stale" | "unverified" | "needs_review" | "missing_source" | "trusted" | "watch" | "source_error";
    if (
      ["", "stale", "unverified", "needs_review", "missing_source", "trusted", "watch", "source_error"].includes(status) &&
      status !== noticeQaFilter
    ) {
      setNoticeQaFilter(status);
    }
  }, [noticeQaFilter, searchParams, setNoticeQaFilter]);

  return (
    <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
      <AdminPageIntro
        eyebrow="SuperAdmin / Notice QA"
        title="Notice Content Reliability"
        description="Review only the notices that are stale, missing source references, or flagged by automated source monitoring."
        badge="Trust layer"
      />
      <SectionHeader title="Notice Content QA" count={noticeQaItems.length}>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={noticeQaFilter}
            onChange={(e) =>
              setNoticeQaFilter(
                e.target.value as "" | "stale" | "unverified" | "needs_review" | "missing_source" | "trusted" | "watch" | "source_error"
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All Notices</option>
            <option value="needs_review">Needs Review</option>
            <option value="missing_source">Missing Source URL</option>
            <option value="source_error">Source Check Error</option>
            <option value="trusted">Trusted</option>
            <option value="watch">Watch</option>
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
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${reviewTone[item.review_status]}`}>
                    {item.review_status.replaceAll("_", " ")}
                  </span>
                  {!item.source_url && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                      Source missing
                    </span>
                  )}
                  {item.source_check_error && (
                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                      Source check error
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => void handleNoticeQaUpdate(item.id, { is_active: !item.is_active })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
              >
                {item.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-2 text-xs text-slate-500 md:grid-cols-3">
              <p>Verified: {item.verified_at ? new Date(item.verified_at).toLocaleString() : "Pending"}</p>
              <p>Source checked: {item.source_last_checked_at ? new Date(item.source_last_checked_at).toLocaleString() : "Not checked"}</p>
              <p>Source changed: {item.source_last_changed_at ? new Date(item.source_last_changed_at).toLocaleString() : "No change recorded"}</p>
            </div>

            {item.source_check_error && (
              <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {item.source_check_error}
              </p>
            )}

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
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
              <select
                value={item.review_status}
                onChange={(e) =>
                  void handleNoticeQaUpdate(item.id, {
                    review_status: e.target.value as "watch" | "trusted" | "needs_review",
                  })
                }
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="watch">Watch</option>
                <option value="trusted">Trusted</option>
                <option value="needs_review">Needs review</option>
              </select>
              <input
                defaultValue={item.source_url || ""}
                onBlur={(e) => {
                  const trimmed = e.target.value.trim();
                  if (trimmed !== item.source_url) {
                    void handleNoticeQaUpdate(item.id, { source_url: trimmed });
                  }
                }}
                placeholder="Official source URL"
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
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm md:col-span-2 xl:col-span-2"
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


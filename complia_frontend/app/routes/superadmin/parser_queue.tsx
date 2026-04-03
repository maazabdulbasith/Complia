import type { ParserJob } from "../../api/client";
import { EmptyState, SectionHeader, useSuperAdmin } from "./shared";

export default function SuperAdminParserQueuePage() {
  const {
    parserJobs,
    parserBenchmarkRuns,
    parserStatusFilter,
    setParserStatusFilter,
    exportingReport,
    savingKey,
    handleCsvExport,
    handleParserJobUpdate,
  } = useSuperAdmin();

  return (
    <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm">
      <SectionHeader title="Parser Queue" count={parserJobs.length}>
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
      </SectionHeader>

      {parserBenchmarkRuns[0] && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-indigo-700">Latest Parser Benchmark</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
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
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-semibold text-slate-900">
                  #{item.id} · {item.original_filename}
                </p>
                <p className="text-sm text-slate-500">
                  {item.notice_code || "Unknown"} · Confidence {Math.round(item.confidence * 100)}%
                </p>
              </div>
              <p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
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
                onChange={(e) =>
                  void handleParserJobUpdate(item.id, {
                    extraction_review_status: e.target.value as "pending" | "approved" | "rejected",
                  })
                }
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
            {savingKey === `parser-${item.id}` && <p className="mt-2 text-xs text-slate-500">Saving...</p>}
          </div>
        ))}

        {parserJobs.length === 0 && <EmptyState>No parser jobs match this filter.</EmptyState>}
      </div>
    </section>
  );
}

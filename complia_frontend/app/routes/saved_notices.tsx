import { Link } from "react-router";
import { useEffect, useState } from "react";

import { getSavedNotices } from "../api/client";
import type { SavedNotice } from "../api/client";
import { trackEvent } from "../lib/analytics";

function severityTone(severity: "low" | "medium" | "high") {
  if (severity === "high") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  if (severity === "medium") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  return "bg-sky-50 text-sky-700 ring-sky-200";
}

export default function SavedNoticesPage() {
  const [items, setItems] = useState<SavedNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const data = await getSavedNotices();
        setItems(data);
        trackEvent("saved_notices_viewed", { item_count: data.length });
      } catch {
        setError("Please sign in to view saved notices.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="grid-aurora min-h-screen overflow-x-hidden px-4 py-6 text-slate-900 sm:px-5 sm:py-8">
      <main className="mx-auto w-full max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">My workspace</p>
            <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Saved notices</h1>
          </div>
          <Link to="/" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">
            Back to search
          </Link>
        </div>

        {loading ? (
          <p className="text-slate-600">Loading saved notices...</p>
        ) : error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            You have no saved notices yet.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <Link
                key={item.id}
                to={`/notice/${item.notice.code}`}
                className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] transition hover:border-blue-200 hover:shadow-[0_20px_45px_rgba(37,99,235,0.1)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs font-semibold text-slate-600">{item.notice.code}</p>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${severityTone(item.notice.severity)}`}>
                    {item.notice.severity}
                  </span>
                </div>
                <h2 className="font-display mt-3 text-xl font-bold tracking-tight text-slate-900">{item.notice.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.notice.summary}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

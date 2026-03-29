import { Link } from "react-router";
import { useCallback, useEffect, useState } from "react";

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

function SavedNoticeSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
      <div className="animate-shimmer absolute inset-0 bg-linear-to-r from-transparent via-slate-100/70 to-transparent" />
      <div className="mb-3 h-4 w-24 rounded bg-slate-100" />
      <div className="mb-3 h-6 w-2/3 rounded bg-slate-100" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-slate-100" />
        <div className="h-4 w-5/6 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function SavedNoticesPage() {
  const [items, setItems] = useState<SavedNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const loadSavedItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuthRequired(false);
    try {
      const data = await getSavedNotices();
      setItems(data);
      trackEvent("saved_notices_viewed", { item_count: data.length });
    } catch (apiError) {
      const message = apiError instanceof Error ? apiError.message : "Please sign in to view saved notices.";
      setError(message);
      setAuthRequired(/sign in|login|token|unauthorized|401/i.test(message));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSavedItems();
  }, [loadSavedItems]);

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
          <div className="space-y-4">
            <SavedNoticeSkeleton />
            <SavedNoticeSkeleton />
            <SavedNoticeSkeleton />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
            <p className="text-sm font-semibold text-rose-800">{error}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {authRequired ? (
                <Link
                  to="/login?next=/saved"
                  className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
                >
                  Sign in to continue
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void loadSavedItems()}
                  className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
                >
                  Retry
                </button>
              )}
              <Link
                to="/"
                className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300"
              >
                Browse notices
              </Link>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <p className="text-base font-semibold text-slate-900">No saved notices yet.</p>
            <p className="mt-2 text-sm text-slate-600">Save important notices so your team can revisit them quickly.</p>
            <Link
              to="/"
              className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Start searching notices
            </Link>
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
                <p className="mt-3 text-xs text-slate-500">Saved on {new Date(item.created_at).toLocaleDateString()}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

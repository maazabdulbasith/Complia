import { Link } from "react-router";
import { useEffect, useState } from "react";

import { getSavedNotices } from "../api/client";
import type { SavedNotice } from "../api/client";
import { trackEvent } from "../lib/analytics";

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
      } catch (err) {
        setError("Please sign in to view saved notices.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-6 py-10">
      <main className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Saved Notices</h1>
          <Link to="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
            Back to Search
          </Link>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading saved notices...</p>
        ) : error ? (
          <p className="text-rose-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-slate-500">No saved notices yet.</p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <Link
                key={item.id}
                to={`/notice/${item.notice.code}`}
                className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <p className="text-xs font-mono text-slate-500 mb-2">{item.notice.code}</p>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">{item.notice.title}</h2>
                <p className="text-slate-600 text-sm">{item.notice.summary}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

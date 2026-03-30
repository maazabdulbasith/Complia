import { useEffect, useState } from "react";
import { Form, Link, useNavigation, useNavigate } from "react-router";

import { searchNotices } from "../api/client";
import { trackEvent } from "../lib/analytics";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complia | Tax Notice Intelligence" },
    { name: "description", content: "Understand GST and Income Tax notices in plain English." },
  ];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  if (!q) return { results: [], query: "" };
  const results = await searchNotices(q);
  return { results, query: q };
}

function NoticeSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-7 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
      <div className="animate-shimmer absolute inset-0 bg-linear-to-r from-transparent via-slate-100/70 to-transparent" />
      <div className="mb-5 h-5 w-28 rounded bg-slate-100" />
      <div className="mb-4 h-7 w-2/3 rounded bg-slate-100" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-slate-100" />
        <div className="h-4 w-5/6 rounded bg-slate-100" />
      </div>
    </div>
  );
}

function severityTone(severity: "low" | "medium" | "high") {
  if (severity === "high") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  if (severity === "medium") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  return "bg-sky-50 text-sky-700 ring-sky-200";
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { results, query } = loaderData;
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState(query || "");
  const [user, setUser] = useState<{ email: string; user_type?: string } | null>(null);
  const isSearchNavigation =
    navigation.state === "loading" &&
    navigation.location?.pathname === "/" &&
    navigation.location.search.includes("q=");

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("user");
      }
    }
  }, []);

  useEffect(() => {
    if (!query || isSearchNavigation) {
      return;
    }
    trackEvent("search_performed", {
      query,
      result_count: results.length,
    });
  }, [query, results.length, isSearchNavigation]);

  const handleLogout = () => {
    localStorage.removeItem("complia_token");
    localStorage.removeItem("complia_refresh_token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/");
  };

  return (
    <div className="grid-aurora relative min-h-screen overflow-x-hidden text-slate-900">
      <div className="noise-layer pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute -top-32 -right-20 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl animate-float" />
      <div className="pointer-events-none absolute top-56 -left-24 h-80 w-80 rounded-full bg-blue-300/25 blur-3xl animate-float [animation-delay:1200ms]" />

      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:h-18 sm:flex-nowrap sm:gap-0 sm:px-5 sm:py-0">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-bold text-white shadow-lg shadow-blue-600/25">
              C
            </div>
            <div>
              <p className="font-display text-lg font-bold tracking-tight">Complia</p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-[11px] sm:tracking-[0.18em]">Notice intelligence</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                {user.user_type === "admin" && (
                  <Link
                    to="/superadmin"
                    className="rounded-xl border border-slate-300/80 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 sm:hidden"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  to="/saved"
                  className="rounded-xl border border-slate-300/80 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 sm:hidden"
                >
                  Saved
                </Link>
                {user.user_type === "admin" && (
                  <Link
                    to="/superadmin"
                    className="hidden rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 sm:inline-flex"
                  >
                    SuperAdmin
                  </Link>
                )}
                <Link
                  to="/saved"
                  className="hidden rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 sm:inline-flex"
                >
                  Saved
                </Link>
                <span className="hidden text-xs font-medium text-slate-600 sm:inline">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="rounded-xl border border-slate-300/80 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700 sm:px-3"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-xl bg-slate-900 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-5 sm:pb-20 sm:pt-12 md:pt-16">
        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-blue-700">
              India tax notices, simplified
            </p>
            <h1 className="font-display mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:mt-5 sm:text-4xl md:text-6xl md:leading-[1.05]">
              Understand any tax notice in under two minutes.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:mt-5 sm:text-lg">
              Search by code, keyword, or section. Get plain-English explanation, severity, legal context, and next actions.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 sm:mt-6">
              <Link
                to="/parser"
                onClick={() =>
                  trackEvent("parser_upload_cta_clicked", {
                    source_path: "/",
                  })
                }
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 sm:px-5 sm:py-3"
              >
                Upload Notice & Understand
              </Link>
              <Link
                to="/ca-help"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300/80 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 sm:px-5 sm:py-3"
              >
                Talk to a CA
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">At a glance</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:gap-3">
              <div className="rounded-2xl bg-slate-50 px-2 py-4">
                <p className="font-display text-xl font-bold text-slate-900 sm:text-2xl">170+</p>
                <p className="text-[11px] text-slate-500">notices</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-2 py-4">
                <p className="font-display text-xl font-bold text-slate-900 sm:text-2xl">3</p>
                <p className="text-[11px] text-slate-500">risk tiers</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-2 py-4">
                <p className="font-display text-xl font-bold text-slate-900 sm:text-2xl">1</p>
                <p className="text-[11px] text-slate-500">action plan</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-5">
          <Form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="relative block">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m0 0A7.65 7.65 0 1 0 5.82 5.82a7.65 7.65 0 0 0 10.83 10.83Z" />
                </svg>
              </span>
              <input
                type="text"
                name="q"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Try GST-DRC-01, ASMT-10, Scrutiny, Section 143"
                className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[15px] font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                autoComplete="off"
              />
            </label>

            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 active:scale-[0.99] sm:h-13 sm:px-6"
            >
              {isSearchNavigation && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              Search Notices
            </button>
          </Form>

          {!query && (
            <div className="mt-4 flex flex-wrap gap-2">
              {["ASMT-10", "DRC-01", "Scrutiny", "Trademark Objection", "PF Hearing"].map((item) => (
                <Link
                  key={item}
                  to={`/?q=${encodeURIComponent(item)}`}
                  onClick={() => trackEvent("frequent_search_clicked", { term: item })}
                  className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                >
                  {item}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 space-y-4">
          {isSearchNavigation ? (
            <>
              <NoticeSkeleton />
              <NoticeSkeleton />
              <NoticeSkeleton />
            </>
          ) : results.length > 0 ? (
            results.map((notice) => (
              <Link
                key={notice.code}
                to={`/notice/${notice.code}`}
                onClick={() => {
                  trackEvent("search_result_clicked", {
                    query,
                    notice_code: notice.code,
                  });
                }}
                className="group block rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_40px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_20px_50px_rgba(37,99,235,0.12)] sm:p-7"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-600">{notice.code}</span>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${severityTone(notice.severity)}`}>
                    {notice.severity === "high" ? "Action Required" : notice.severity === "medium" ? "Review Needed" : "Informational"}
                  </span>
                </div>
                <h2 className="mt-4 font-display text-xl font-bold tracking-tight text-slate-900 transition group-hover:text-blue-700 sm:text-2xl">{notice.title}</h2>
                <p className="mt-3 text-[15px] leading-7 text-slate-600">{notice.summary}</p>
                <p className="mt-5 text-sm font-semibold text-blue-700">Read full breakdown</p>
              </Link>
            ))
          ) : query ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
              <p className="text-base font-semibold text-slate-900">No notices matched “{query}”.</p>
              <p className="mt-2 text-sm text-slate-600">Try searching by notice code, section number, or key phrase.</p>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-slate-900">
      <h1 className="text-3xl font-bold tracking-tight text-rose-700">Error Loading Data</h1>
      <p className="mt-3 text-slate-600">{error instanceof Error ? error.message : "Could not fetch data from backend."}</p>
      <Link to="/" className="mt-6 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">
        Back to home
      </Link>
    </div>
  );
}





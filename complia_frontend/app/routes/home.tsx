import { useEffect, useState } from "react";
import { Form, Link, useNavigation, useNavigate } from "react-router";

import { searchNotices } from "../api/client";
import { trackEvent } from "../lib/analytics";
import BrandMark from "../lib/brand_mark";
import {
  absoluteSiteUrl,
  DEFAULT_OG_IMAGE_URL,
  FEATURED_NOTICE_LINKS,
  SEO_FAQS,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "../lib/seo";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complia | Understand GST and Income Tax Notices Fast" },
    { name: "description", content: SITE_DESCRIPTION },
    { property: "og:url", content: absoluteSiteUrl("/") },
    { property: "og:title", content: "Complia | Understand GST and Income Tax Notices Fast" },
    { property: "og:description", content: SITE_DESCRIPTION },
    { property: "og:type", content: "website" },
    { property: "og:image", content: DEFAULT_OG_IMAGE_URL },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:title",
      content: "Complia | Understand GST and Income Tax Notices Fast",
    },
    { name: "twitter:description", content: SITE_DESCRIPTION },
    { name: "twitter:image", content: DEFAULT_OG_IMAGE_URL },
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
  return "bg-indigo-50 text-indigo-800 ring-indigo-200";
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { results, query } = loaderData;
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState(query || "");
  const [user, setUser] = useState<{ email: string; user_type?: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const siteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || "https://complia.in";
  const homeSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: SITE_NAME,
        url: siteUrl,
        logo: `${siteUrl}/brand/complia-logo-icon.png`,
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer support",
            email: "admin@complia.in",
            areaServed: "IN",
            availableLanguage: ["en"],
          },
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { "@id": `${siteUrl}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <div className="grid-aurora relative min-h-screen overflow-x-hidden text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeSchema) }}
      />
      <div className="noise-layer pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute -top-32 -right-20 h-96 w-96 rounded-full bg-indigo-300/25 blur-3xl animate-float" />
      <div className="pointer-events-none absolute top-56 -left-24 h-80 w-80 rounded-full bg-indigo-300/25 blur-3xl animate-float [animation-delay:1200ms]" />

      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:h-18 sm:px-5">
          <BrandMark to="/" imageClassName="h-8 w-auto sm:h-10 sm:w-auto" />

          {/* ── Desktop nav (sm+) ── */}
          <div className="hidden items-center gap-2 sm:flex">
            <Link
              to="/contact-us"
              className="rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-800"
            >
              Contact Us
            </Link>
            {user ? (
              <>
                {user.user_type === "admin" && (
                  <Link
                    to="/superadmin"
                    className="rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-800"
                  >
                    SuperAdmin
                  </Link>
                )}
                <Link
                  to="/saved"
                  className="rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-800"
                >
                  Safe
                </Link>
                <span className="text-xs font-medium text-slate-600">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700"
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

          {/* ── Mobile nav (below sm) ── */}
          <div className="relative sm:hidden">
            {user ? (
              <>
                <button
                  onClick={() => setMobileMenuOpen((v) => !v)}
                  aria-label="Toggle menu"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300/80 bg-white text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                >
                  {mobileMenuOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                  )}
                </button>
                {mobileMenuOpen && (
                  <div className="mobile-menu-dropdown absolute right-0 top-full mt-2 w-48 origin-top-right rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-xl backdrop-blur-lg">
                    {user.user_type === "admin" && (
                      <Link
                        to="/superadmin"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-blue-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                        Admin
                      </Link>
                    )}
                    <Link
                      to="/saved"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-blue-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
                      Safe
                    </Link>
                    <Link
                      to="/contact-us"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-blue-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>
                      Contact Us
                    </Link>
                    <div className="my-1.5 border-t border-slate-100" />
                    <button
                      onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" /></svg>
                      Logout
                    </button>
                  </div>
                )}
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
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
            <p className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-800">
              India tax notices, simplified
            </p>
            <h1 className="font-display mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:mt-5 sm:text-4xl md:text-6xl md:leading-[1.05]">
              Understand any tax notice in under two minutes.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:mt-5 sm:text-lg">
              Search by code, keyword, or section. Get plain-English explanation, severity, legal context, and next actions.
            </p>
            <div className="mt-5 grid gap-2 sm:mt-6 sm:flex sm:flex-wrap">
              <Link
                to="/parser"
                onClick={() =>
                  trackEvent("parser_upload_cta_clicked", {
                    source_path: "/",
                  })
                }
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 sm:w-auto sm:px-5 sm:py-3"
              >
                Upload Notice & Understand
              </Link>
              <Link
                to="/ca-help"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300/80 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-800 sm:w-auto sm:px-5 sm:py-3"
              >
                Talk to a CA
              </Link>
              <Link
                to="/faq"
                className="inline-flex items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 sm:px-5 sm:py-3"
              >
                Browse FAQ
              </Link>
            </div>
            <div className="mt-5 grid max-w-3xl gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Search</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  Best when you already know the notice code and want the plain-English breakdown.
                </p>
              </div>
              <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/80 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-800">Upload</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  Best when you only have the actual notice file and want a case-ready response pack.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Safe</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  Save the notice, parser result, and CA handoff brief so nothing gets lost later.
                </p>
              </div>
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
                className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[15px] font-medium text-slate-900 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                autoComplete="off"
              />
            </label>

            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#102a6b] to-[#163a86] px-4 text-sm font-semibold text-white shadow-lg shadow-[#102a6b]/25 transition hover:brightness-110 active:scale-[0.99] sm:h-13 sm:px-6"
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
                  className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-800"
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
                className="group block rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_40px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_20px_50px_rgba(37,99,235,0.12)] sm:p-7"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-600">{notice.code}</span>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${severityTone(notice.severity)}`}>
                    {notice.severity === "high" ? "Action Required" : notice.severity === "medium" ? "Review Needed" : "Informational"}
                  </span>
                </div>
                <h2 className="mt-4 font-display text-xl font-bold tracking-tight text-slate-900 transition group-hover:text-indigo-800 sm:text-2xl">{notice.title}</h2>
                <p className="mt-3 text-[15px] leading-7 text-slate-600">{notice.summary}</p>
                <p className="mt-5 text-sm font-semibold text-indigo-800">Read full breakdown</p>
              </Link>
            ))
          ) : query ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
              <p className="text-base font-semibold text-slate-900">No notices matched “{query}”.</p>
              <p className="mt-2 text-sm text-slate-600">Try searching by notice code, section number, or key phrase.</p>
            </div>
          ) : null}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Popular notice pages
                </p>
                <h2 className="font-display mt-2 text-2xl font-bold tracking-tight text-slate-950">
                  High-intent notices users search most often
                </h2>
              </div>
              <Link to="/faq" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                FAQ and search help
              </Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {FEATURED_NOTICE_LINKS.map((item) => (
                <Link
                  key={item.code}
                  to={`/notice/${item.code}`}
                  className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <p className="font-mono text-xs font-semibold text-slate-500">{item.code}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-900 transition group-hover:text-blue-700">
                    {item.label}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Frequently asked
                </p>
                <h2 className="font-display mt-2 text-2xl font-bold tracking-tight text-slate-950">
                  Questions people ask before taking action
                </h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {SEO_FAQS.slice(0, 4).map((item) => (
                <article key={item.question} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-950">{item.question}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.answer}</p>
                </article>
              ))}
            </div>
            <Link
              to="/faq"
              className="mt-5 inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
            >
              View all FAQs
            </Link>
          </div>
        </section>

        <footer className="mt-12 border-t border-slate-200/80 pt-5 text-xs text-slate-500 sm:mt-14 sm:pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span>Legal:</span>
            <Link to="/faq" className="font-semibold text-slate-600 hover:text-indigo-800">
              FAQ
            </Link>
            <span>·</span>
            <Link to="/contact-us" className="font-semibold text-slate-600 hover:text-indigo-800">
              Contact Us
            </Link>
            <span>·</span>
            <Link to="/terms-and-conditions" className="font-semibold text-slate-600 hover:text-indigo-800">
              Terms & Conditions
            </Link>
            <span>·</span>
            <Link to="/privacy-policy" className="font-semibold text-slate-600 hover:text-indigo-800">
              Privacy Policy
            </Link>
            <span>·</span>
            <Link to="/refund-policy" className="font-semibold text-slate-600 hover:text-indigo-800">
              Refund Policy
            </Link>
            <span>·</span>
            <Link to="/cancellation-policy" className="font-semibold text-slate-600 hover:text-indigo-800">
              Cancellation Policy
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-slate-900">
      <h1 className="text-3xl font-bold tracking-tight text-rose-700">Error Loading Data</h1>
      <p className="mt-3 text-slate-600">{error instanceof Error ? error.message : "Could not fetch data from backend."}</p>
      <Link to="/" className="mt-6 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-800">
        Back to home
      </Link>
    </div>
  );
}





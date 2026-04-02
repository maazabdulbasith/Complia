import { Link } from "react-router";

import BrandMark from "../lib/brand_mark";
import { SEO_FAQS, SITE_DESCRIPTION } from "../lib/seo";
import type { Route } from "./+types/faq";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complia FAQ | Tax Notice Questions Answered" },
    {
      name: "description",
      content:
        "Frequently asked questions about GST notices, Income Tax notices, parser uploads, urgency, CA help, and how Complia works.",
    },
    { property: "og:title", content: "Complia FAQ | Tax Notice Questions Answered" },
    {
      property: "og:description",
      content: "Answers to common questions about tax notices, urgency, parser uploads, and CA escalation.",
    },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

export default function FaqPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: SEO_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <div className="grid-aurora min-h-screen px-4 py-8 text-slate-900 sm:px-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <main className="mx-auto w-full max-w-5xl rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <BrandMark to="/" imageClassName="h-9 w-9" />
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/parser"
              className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Upload Notice
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
            >
              <span aria-hidden>&larr;</span> Back to home
            </Link>
          </div>
        </div>

        <div className="max-w-3xl">
          <p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-700">
            Common tax notice questions
          </p>
          <h1 className="font-display mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Frequently asked questions about tax notices and Complia
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
            {SITE_DESCRIPTION} This page is designed for users searching for what a notice means,
            how urgent it is, and when to escalate to a CA.
          </p>
        </div>

        <section className="mt-10 grid gap-4">
          {SEO_FAQS.map((item, index) => (
            <article
              key={item.question}
              className="rounded-3xl border border-slate-200/80 bg-slate-50 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.04)] sm:p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                FAQ {index + 1}
              </p>
              <h2 className="mt-2 font-display text-xl font-bold text-slate-950 sm:text-2xl">
                {item.question}
              </h2>
              <p className="mt-3 text-[15px] leading-8 text-slate-700 sm:text-base">
                {item.answer}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
            Need the next step?
          </p>
          <h2 className="font-display mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Search a notice, upload your document, or talk to a CA.
          </h2>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Search notices
            </Link>
            <Link
              to="/parser"
              className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
            >
              Upload & Understand
            </Link>
            <Link
              to="/ca-help"
              className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Talk to a CA
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

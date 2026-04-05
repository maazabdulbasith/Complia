import { Link } from "react-router";
import BrandMark from "../lib/brand_mark";

import type { Route } from "./+types/contact_us";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complia | Contact Us" },
    {
      name: "description",
      content: "Contact Complia for support, compliance help, and business queries.",
    },
  ];
}

export default function ContactUsPage() {
  return (
    <div className="grid-aurora min-h-screen px-4 py-8 text-slate-900 sm:px-6 sm:py-10">
      <main className="mx-auto w-full max-w-4xl rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <BrandMark to="/" imageClassName="h-9 w-auto" />
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-800"
          >
            <span aria-hidden>&larr;</span> Back to home
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Support
          </p>
        </div>

        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Contact Us
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          For product support, account help, or partnership queries, reach out to our team.
        </p>

        <section className="mt-7 space-y-5 text-sm leading-7 text-slate-700 sm:text-base">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <h2 className="font-display text-xl font-bold text-slate-900">Email Support</h2>
            <p className="mt-2">
              Primary contact:{" "}
              <a
                href="mailto:admin@complia.in"
                className="font-semibold text-indigo-800 transition hover:text-indigo-900 hover:underline"
              >
                admin@complia.in
              </a>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              We typically respond within one business day.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">What to include in your message</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
              <li>Registered email used on Complia</li>
              <li>Notice code (if applicable)</li>
              <li>Issue details and screenshot (if any)</li>
            </ul>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">CA handoff escalation</h2>
            <p className="mt-2">
              If you requested CA help and need an assignment update, consent withdrawal before
              assignment, or service-quality escalation, email{" "}
              <a
                href="mailto:admin@complia.in"
                className="font-semibold text-indigo-800 transition hover:text-indigo-900 hover:underline"
              >
                admin@complia.in
              </a>{" "}
              with your registered email and notice code.
            </p>
          </div>
        </section>

        <div className="mt-8 border-t border-slate-200 pt-5 text-sm text-slate-600">
          Also see our{" "}
          <Link to="/terms-and-conditions" className="font-semibold text-indigo-800 hover:underline">
            Terms and Conditions
          </Link>
          ,{" "}
          <Link to="/privacy-policy" className="font-semibold text-indigo-800 hover:underline">
            Privacy Policy
          </Link>
          ,{" "}
          <Link to="/refund-policy" className="font-semibold text-indigo-800 hover:underline">
            Refund Policy
          </Link>
          , and{" "}
          <Link to="/cancellation-policy" className="font-semibold text-indigo-800 hover:underline">
            Cancellation Policy
          </Link>
          .
        </div>
      </main>
    </div>
  );
}

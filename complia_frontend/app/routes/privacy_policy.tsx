import { Link } from "react-router";

import type { Route } from "./+types/privacy_policy";

const EFFECTIVE_DATE = "March 30, 2026";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complia | Privacy Policy" },
    {
      name: "description",
      content:
        "How Complia collects, uses, stores, and protects personal and notice-related data.",
    },
  ];
}

export default function PrivacyPolicyPage() {
  return (
    <div className="grid-aurora min-h-screen px-4 py-8 text-slate-900 sm:px-6 sm:py-10">
      <main className="mx-auto w-full max-w-4xl rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
          >
            <span aria-hidden>&larr;</span> Back to home
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Effective date: {EFFECTIVE_DATE}
          </p>
        </div>

        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          This policy explains what information we collect, why we collect it, and how we protect
          it when you use Complia.
        </p>

        <section className="mt-7 space-y-6 text-sm leading-7 text-slate-700 sm:text-base">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">1. Information We Collect</h2>
            <p className="mt-2">
              We may collect account details (such as name and email), usage events, uploaded
              notice content, and support communication details required to provide platform
              features.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">2. How We Use Information</h2>
            <p className="mt-2">
              We use data to deliver core functionality, improve product quality, detect abuse,
              support users, and meet legal/compliance requirements.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">3. Data Sharing</h2>
            <p className="mt-2">
              We do not sell personal data. We may share data with trusted processors (hosting,
              analytics, payment providers) only for service delivery and legal obligations.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">4. Security Practices</h2>
            <p className="mt-2">
              We apply reasonable technical and organizational safeguards to protect your data.
              However, no method of transmission or storage is completely risk-free.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">5. Retention</h2>
            <p className="mt-2">
              Data retention is limited to business, legal, and operational necessity. Uploaded
              parser artifacts may be processed under short-lived storage rules as configured in the
              platform.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">6. Your Rights</h2>
            <p className="mt-2">
              Subject to applicable law, you may request access, correction, or deletion of personal
              information. Certain records may be retained where legally required.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">7. Policy Updates</h2>
            <p className="mt-2">
              We may update this policy periodically. The latest version is published on this page
              with an updated effective date.
            </p>
          </div>
        </section>

        <div className="mt-8 border-t border-slate-200 pt-5 text-sm text-slate-600">
          Also see our{" "}
          <Link to="/terms-and-conditions" className="font-semibold text-blue-700 hover:underline">
            Terms and Conditions
          </Link>
          ,{" "}
          <Link to="/refund-policy" className="font-semibold text-blue-700 hover:underline">
            Refund Policy
          </Link>
          , and{" "}
          <Link to="/cancellation-policy" className="font-semibold text-blue-700 hover:underline">
            Cancellation Policy
          </Link>
          , and{" "}
          <Link to="/contact-us" className="font-semibold text-blue-700 hover:underline">
            Contact Us
          </Link>
          .
        </div>
      </main>
    </div>
  );
}

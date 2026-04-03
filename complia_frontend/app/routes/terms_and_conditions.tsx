import { Link } from "react-router";
import BrandMark from "../lib/brand_mark";

import type { Route } from "./+types/terms_and_conditions";

const EFFECTIVE_DATE = "March 30, 2026";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complia | Terms and Conditions" },
    {
      name: "description",
      content:
        "Terms governing use of Complia services, including notice guidance, account obligations, and platform limitations.",
    },
  ];
}

export default function TermsAndConditionsPage() {
  return (
    <div className="grid-aurora min-h-screen px-4 py-8 text-slate-900 sm:px-6 sm:py-10">
      <main className="mx-auto w-full max-w-4xl rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <BrandMark to="/" imageClassName="h-9 w-auto" />
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
          Terms and Conditions
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          These Terms and Conditions govern your access to and use of Complia. By using this
          platform, you agree to these terms.
        </p>

        <section className="mt-7 space-y-6 text-sm leading-7 text-slate-700 sm:text-base">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">1. Service Scope</h2>
            <p className="mt-2">
              Complia provides educational and workflow support for tax notice understanding. It
              does not, by itself, constitute legal representation, chartered accountancy advice,
              or litigation strategy.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">2. Eligibility</h2>
            <p className="mt-2">
              You must provide accurate information and use the platform in compliance with
              applicable law. You are responsible for maintaining account security and all activity
              under your account.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">3. User Responsibilities</h2>
            <p className="mt-2">
              You agree not to misuse the service, upload unlawful content, attempt unauthorized
              access, or interfere with platform availability. You remain responsible for final tax
              filings, submissions, and legal decisions.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">4. Paid Features</h2>
            <p className="mt-2">
              Paid features are offered per the pricing shown at checkout. Access is granted after
              successful payment confirmation by the payment gateway and platform systems.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">5. CA Handoff and Professional Services</h2>
            <p className="mt-2">
              If you request CA help, you authorize Complia to share your case details with one
              assigned CA or tax professional contact. Complia acts as a platform and intake layer,
              not as the professional advisor of record. Any professional engagement, fee quote,
              filing work, drafting work, or representation is a separate arrangement between you
              and the CA unless Complia expressly states otherwise in writing.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">6. Intellectual Property</h2>
            <p className="mt-2">
              Platform content, branding, and software are owned by Complia or licensed to Complia.
              You may not copy, reverse engineer, or redistribute proprietary assets without written
              permission.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">7. Limitation of Liability</h2>
            <p className="mt-2">
              To the maximum extent permitted by law, Complia is not liable for indirect or
              consequential losses arising from platform use, notice interpretation outcomes, missed
              deadlines, third-party service failures, or professional advice and fees agreed
              directly between a user and an assigned CA.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">8. Account Suspension</h2>
            <p className="mt-2">
              Complia may suspend or terminate access for abusive behavior, fraud, policy
              violations, or legal compliance requirements.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">9. Changes to Terms</h2>
            <p className="mt-2">
              Terms may be updated from time to time. Continued use after updates constitutes
              acceptance of revised terms.
            </p>
          </div>
        </section>

        <div className="mt-8 border-t border-slate-200 pt-5 text-sm text-slate-600">
          Review our{" "}
          <Link to="/privacy-policy" className="font-semibold text-blue-700 hover:underline">
            Privacy Policy
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

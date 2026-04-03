import { Link } from "react-router";
import BrandMark from "../lib/brand_mark";

import type { Route } from "./+types/cancellation_policy";

const EFFECTIVE_DATE = "March 30, 2026";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complia | Cancellation Policy" },
    {
      name: "description",
      content:
        "Cancellation rules for paid services, requests, and account-level discontinuation on Complia.",
    },
  ];
}

export default function CancellationPolicyPage() {
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
          Cancellation Policy
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          This policy explains how service cancellations are handled on Complia.
        </p>

        <section className="mt-7 space-y-6 text-sm leading-7 text-slate-700 sm:text-base">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">1. User-Initiated Cancellation</h2>
            <p className="mt-2">
              You may discontinue use of the service at any time. For account-related closure
              requests, support channels may require basic verification.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">2. Service-Level Cancellation</h2>
            <p className="mt-2">
              If a paid workflow is cancelled before meaningful service delivery, handling will
              follow the Refund Policy and transaction verification process. CA handoff requests may
              be cancelled before assignment by contacting support. After assignment or contact has
              begun, any professional engagement with the CA is governed separately between the user
              and the CA.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">3. Platform-Initiated Cancellation</h2>
            <p className="mt-2">
              Complia may suspend or terminate services in cases of abuse, fraud, legal directives,
              or policy violations to protect platform integrity and users.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">4. Impact of Cancellation</h2>
            <p className="mt-2">
              Cancellation may impact access to certain paid features, outstanding workflows, and
              account-specific history, subject to operational and legal retention constraints.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">5. Related Policies</h2>
            <p className="mt-2">
              Please review Terms and Conditions, Privacy Policy, and Refund Policy for full policy
              context applicable to your usage and transactions.
            </p>
          </div>
        </section>

        <div className="mt-8 border-t border-slate-200 pt-5 text-sm text-slate-600">
          Read related pages:{" "}
          <Link to="/contact-us" className="font-semibold text-blue-700 hover:underline">
            Contact Us
          </Link>
          ,{" "}
          <Link to="/refund-policy" className="font-semibold text-blue-700 hover:underline">
            Refund Policy
          </Link>
          ,{" "}
          <Link to="/terms-and-conditions" className="font-semibold text-blue-700 hover:underline">
            Terms and Conditions
          </Link>
          , and{" "}
          <Link to="/privacy-policy" className="font-semibold text-blue-700 hover:underline">
            Privacy Policy
          </Link>
          .
        </div>
      </main>
    </div>
  );
}

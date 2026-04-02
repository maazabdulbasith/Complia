import { Link } from "react-router";
import BrandMark from "../lib/brand_mark";

import type { Route } from "./+types/refund_policy";

const EFFECTIVE_DATE = "March 30, 2026";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complia | Refund Policy" },
    {
      name: "description",
      content:
        "Refund eligibility and handling rules for Complia paid services and notice-related purchases.",
    },
  ];
}

export default function RefundPolicyPage() {
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
          Refund Policy
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          This policy describes when refunds may be issued for paid services on Complia.
        </p>

        <section className="mt-7 space-y-6 text-sm leading-7 text-slate-700 sm:text-base">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">1. General Principle</h2>
            <p className="mt-2">
              Payments are typically for digital service access and are generally non-refundable once
              the paid feature is successfully delivered.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">2. Eligible Refund Cases</h2>
            <p className="mt-2">
              Refund requests may be considered where there is duplicate charge, gateway settlement
              mismatch, or clear technical failure that prevented service delivery after successful
              payment.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">3. Non-Refundable Cases</h2>
            <p className="mt-2">
              No refund is typically provided for completed digital delivery, user-side upload/input
              errors, or subjective dissatisfaction where service was materially delivered as
              described.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">4. Refund Request Window</h2>
            <p className="mt-2">
              Refund requests should be raised promptly with transaction reference details. Requests
              made after long delays may not be eligible for review.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">5. Processing Timelines</h2>
            <p className="mt-2">
              If approved, refunds are processed through the original payment method, subject to
              payment provider banking timelines.
            </p>
          </div>
        </section>

        <div className="mt-8 border-t border-slate-200 pt-5 text-sm text-slate-600">
          Read related pages:{" "}
          <Link to="/contact-us" className="font-semibold text-blue-700 hover:underline">
            Contact Us
          </Link>
          ,{" "}
          <Link to="/cancellation-policy" className="font-semibold text-blue-700 hover:underline">
            Cancellation Policy
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

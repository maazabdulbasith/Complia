import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router";

import { submitCAHelpRequest } from "../api/client";
import { trackEvent } from "../lib/analytics";
import BrandMark from "../lib/brand_mark";
import type { Route } from "./+types/ca_help";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complia | Request CA Help" },
    { name: "description", content: "Get expert CA help for your tax notice response." },
  ];
}

export default function CAHelpPage() {
  const [searchParams] = useSearchParams();
  const prefillNoticeCode = useMemo(() => searchParams.get("notice") || "", [searchParams]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [noticeCode, setNoticeCode] = useState(prefillNoticeCode);
  const [message, setMessage] = useState("");
  const [consentToShare, setConsentToShare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userJson = localStorage.getItem("user");
    if (!userJson) return;
    try {
      const user = JSON.parse(userJson) as { email?: string };
      if (user.email) {
        setEmail(user.email);
      }
    } catch {
      localStorage.removeItem("user");
    }
  }, []);

  useEffect(() => {
    trackEvent("ca_help_started", {
      notice_code: prefillNoticeCode || "general",
    });
  }, [prefillNoticeCode]);

  const isFormValid = name.trim().length > 1 && email.trim().length > 3 && consentToShare;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid) {
      setError("Please complete your details and consent to CA handoff to continue.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await submitCAHelpRequest({
        notice_code: noticeCode.trim(),
        name: name.trim(),
        email: email.trim(),
        phone_number: phoneNumber.trim(),
        message: message.trim(),
        consent_to_share_with_ca: consentToShare,
      });
      trackEvent("ca_help_submitted", { notice_code: noticeCode || "general" });
      setSuccess("Request submitted. A CA expert will contact you shortly.");
      setName("");
      setPhoneNumber("");
      setMessage("");
    } catch {
      trackEvent("ca_help_submit_failed", { notice_code: noticeCode || "general" });
      setError("Could not submit your request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid-aurora min-h-screen overflow-x-hidden px-4 py-6 text-slate-900 sm:px-5 sm:py-8">
      <main className="mx-auto w-full max-w-3xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <BrandMark to="/" imageClassName="h-9 w-auto" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-800">CA support</p>
            <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Request professional help</h1>
          </div>
          <Link to="/" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-800">
            Back to search
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)] sm:rounded-[28px] sm:p-6 md:p-8">
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">What happens next?</p>
            <p className="mt-1 text-sm text-slate-600">
              Submit this form and Complia will route your case to one assigned CA so they can review your notice context and contact you with next steps.
            </p>
            {prefillNoticeCode && (
              <p className="mt-2 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">
                Prefilled notice: {prefillNoticeCode}
              </p>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4">
            <p className="text-sm font-semibold text-slate-900">How this handoff works</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Complia collects your request, notice code, and case context.</li>
              <li>We assign one CA contact instead of broadcasting your case widely.</li>
              <li>The CA&apos;s professional fees and scope are agreed separately between you and the CA.</li>
              <li>Complia tracks assignment, contact, and resolution status for service quality and support.</li>
            </ul>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                placeholder="Your full name"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Phone (optional)</label>
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                placeholder="9876543210"
                autoComplete="tel"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Notice code (optional)</label>
              <input
                value={noticeCode}
                onChange={(e) => setNoticeCode(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                placeholder="GST-DRC-01"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-semibold text-slate-700">Brief your issue</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
              placeholder="Mention notice deadline, demand amount, and urgency."
            />
            <p className="mt-1 text-xs text-slate-500">Tip: include deadline date and claimed amount for faster triage.</p>
          </div>

          <label className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              checked={consentToShare}
              onChange={(e) => setConsentToShare(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-200"
            />
            <span className="text-sm leading-6 text-slate-700">
              I authorize Complia to share my name, contact details, notice code, message, and related case summary with one assigned CA for follow-up on this request.
            </span>
          </label>

          {error && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {success && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <p className="font-semibold">{success}</p>
              <p className="mt-1">Keep this tab open or check your email/phone for follow-up.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#102a6b] to-[#163a86] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#102a6b]/20 transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Submit request"}
          </button>
        </form>
      </main>
    </div>
  );
}

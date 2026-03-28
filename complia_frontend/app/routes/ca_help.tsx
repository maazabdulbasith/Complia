import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router";

import { submitCAHelpRequest } from "../api/client";
import { trackEvent } from "../lib/analytics";
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
    trackEvent("ca_help_started", {
      notice_code: prefillNoticeCode || "general",
    });
  }, [prefillNoticeCode]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await submitCAHelpRequest({
        notice_code: noticeCode,
        name,
        email,
        phone_number: phoneNumber,
        message,
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
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">CA support</p>
            <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Request professional help</h1>
          </div>
          <Link to="/" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">
            Back to search
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)] sm:rounded-[28px] sm:p-6 md:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Phone (optional)</label>
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                placeholder="9876543210"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Notice code (optional)</label>
              <input
                value={noticeCode}
                onChange={(e) => setNoticeCode(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
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
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              placeholder="Mention notice deadline, demand amount, and urgency."
            />
          </div>

          {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
          {success && <p className="mt-3 text-sm text-emerald-700">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Submit request"}
          </button>
        </form>
      </main>
    </div>
  );
}

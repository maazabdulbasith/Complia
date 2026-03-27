import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router";

import { submitCAHelpRequest } from "../api/client";
import { trackEvent } from "../lib/analytics";

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
    if (!userJson) {
      return;
    }
    try {
      const user = JSON.parse(userJson) as { email?: string };
      if (user.email) {
        setEmail(user.email);
      }
    } catch {
      localStorage.removeItem("user");
    }
  }, []);

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
      trackEvent("ca_help_submitted", {
        notice_code: noticeCode || "general",
      });
      setSuccess("Your request is submitted. A CA expert will reach out shortly.");
      setName("");
      setEmail("");
      setPhoneNumber("");
      setMessage("");
    } catch (submitError) {
      trackEvent("ca_help_submit_failed", {
        notice_code: noticeCode || "general",
      });
      setError("Could not submit your request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-6 py-10">
      <main className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Get CA Help</h1>
          <Link to="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
            Back to Search
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div>
            <label className="block text-sm font-semibold mb-1">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Phone (optional)</label>
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="9876543210"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Notice Code (optional)</label>
            <input
              value={noticeCode}
              onChange={(e) => setNoticeCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="GST-DRC-01"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Tell us what you need</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Deadline, issue details, and urgency."
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5"
          >
            {loading ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      </main>
    </div>
  );
}

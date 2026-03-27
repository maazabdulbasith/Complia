import { useGoogleLogin } from "@react-oauth/google";
import { useNavigate, Link, useSearchParams } from "react-router";
import { useState } from "react";
import { jwtDecode } from "jwt-decode";

import { trackEvent } from "../lib/analytics";

const API_BASE_RAW = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api/v1";
const API_BASE = API_BASE_RAW.endsWith("/api/v1") ? API_BASE_RAW : `${API_BASE_RAW}/api/v1`;

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError(null);
      try {
        const backendResponse = await fetch(`${API_BASE}/auth/google/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: tokenResponse.access_token }),
        });

        if (!backendResponse.ok) {
          throw new Error("Authentication failed");
        }

        const data = await backendResponse.json();
        localStorage.setItem("complia_token", data.access);
        if (data.refresh) {
          localStorage.setItem("complia_refresh_token", data.refresh);
        }
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
        } else {
          const decoded = jwtDecode<{ email?: string }>(data.access);
          localStorage.setItem("user", JSON.stringify({ email: decoded.email || "User" }));
        }

        trackEvent("login_success", { provider: "google" });
        const next = searchParams.get("next") || "/";
        navigate(next);
      } catch {
        trackEvent("login_failed", { provider: "google" });
        setError("Sign-in failed. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      trackEvent("login_failed", { provider: "google" });
      setError("Google sign-in was cancelled or failed.");
    },
    flow: "implicit",
  });

  return (
    <div className="grid-aurora relative min-h-screen overflow-x-hidden px-4 py-8 sm:px-5 sm:py-10">
      <div className="pointer-events-none absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -right-20 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-6 sm:gap-8 md:flex-row md:items-center">
        <section className="md:w-1/2">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700">
            <span aria-hidden>&larr;</span> Back to search
          </Link>
          <p className="mt-8 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-blue-700">
            Secure access
          </p>
          <h1 className="font-display mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl md:text-5xl">
            Access your saved notices and advisor workflows.
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
            Sign in once and continue across search, saved cases, and CA request tracking.
          </p>
        </section>

        <section className="md:w-1/2">
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:rounded-[30px] sm:p-7 md:p-8">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">Welcome to Complia</h2>
            <p className="mt-2 text-sm text-slate-600">Continue with Google to secure your account.</p>

            {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

            <button
              onClick={() => {
                if (!googleConfigured) {
                  setError("Google sign-in is not configured for this environment.");
                  return;
                }
                googleLogin();
              }}
              disabled={loading || !googleConfigured}
              className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {loading ? "Signing in..." : "Continue with Google"}
            </button>

            {!googleConfigured && (
              <p className="mt-3 text-xs text-amber-700">
                Google OAuth is disabled. Set <code>VITE_GOOGLE_CLIENT_ID</code> in frontend environment variables.
              </p>
            )}

            <div className="mt-7 border-t border-slate-200 pt-4 text-xs text-slate-500">
              By signing in, you agree to Complia terms and privacy policy.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

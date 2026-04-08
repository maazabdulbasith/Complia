import { useGoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { trackEvent } from "../lib/analytics";
import BrandMark from "../lib/brand_mark";
import type { Route } from "./+types/login";

const API_BASE_RAW = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api/v1";
const API_BASE = API_BASE_RAW.endsWith("/api/v1") ? API_BASE_RAW : `${API_BASE_RAW}/api/v1`;

type AuthPayload = Record<string, unknown>;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Complia | Sign In" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<"signin" | "signup">("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

  const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  const redirectAfterSuccess = () => {
    const next = searchParams.get("next") || "/";
    navigate(next);
  };

  const extractApiError = async (response: Response, fallback: string) => {
    let message = fallback;
    try {
      const errorPayload = (await response.json()) as Record<string, unknown>;
      const detail = typeof errorPayload.detail === "string" ? errorPayload.detail : "";
      const rootMessage = typeof errorPayload.message === "string" ? errorPayload.message : "";
      if (rootMessage) {
        message = rootMessage;
      } else if (detail) {
        message = detail;
      } else {
        const firstField = Object.keys(errorPayload)[0];
        const firstValue = firstField ? errorPayload[firstField] : null;
        if (Array.isArray(firstValue) && firstValue.length > 0) {
          message = String(firstValue[0]);
        } else if (typeof firstValue === "string" && firstValue.trim()) {
          message = firstValue;
        }
      }
    } catch {
      // Keep fallback
    }
    return message;
  };

  const persistSession = async (payload: AuthPayload, fallbackEmail = "") => {
    const access =
      (typeof payload.access === "string" && payload.access) ||
      (typeof payload.token === "string" && payload.token) ||
      "";
    const refresh = (typeof payload.refresh === "string" && payload.refresh) || "";

    if (!access) {
      throw new Error("Sign-in succeeded but access token was missing.");
    }

    localStorage.setItem("complia_token", access);
    if (refresh) {
      localStorage.setItem("complia_refresh_token", refresh);
    }

    let userPayload: Record<string, unknown> | null =
      payload.user && typeof payload.user === "object"
        ? (payload.user as Record<string, unknown>)
        : null;

    if (!userPayload) {
      try {
        const userResponse = await fetch(`${API_BASE}/auth/user/`, {
          headers: { Authorization: `Bearer ${access}` },
        });
        if (userResponse.ok) {
          userPayload = (await userResponse.json()) as Record<string, unknown>;
        }
      } catch {
        // fallback below
      }
    }

    if (!userPayload) {
      const decoded = jwtDecode<{ email?: string }>(access);
      userPayload = { email: fallbackEmail || decoded.email || "User" };
    }

    localStorage.setItem("user", JSON.stringify(userPayload));
  };

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
          throw new Error(await extractApiError(backendResponse, "Google authentication failed."));
        }

        const data = (await backendResponse.json()) as AuthPayload;
        await persistSession(data);

        trackEvent("login_success", { provider: "google" });
        redirectAfterSuccess();
      } catch (err) {
        trackEvent("login_failed", { provider: "google" });
        setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
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

  const handleEmailSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        throw new Error(await extractApiError(response, "Email sign-in failed. Check credentials and retry."));
      }

      const data = (await response.json()) as AuthPayload;
      await persistSession(data, email.trim());
      trackEvent("login_success", { provider: "email_password" });
      redirectAfterSuccess();
    } catch (err) {
      trackEvent("login_failed", { provider: "email_password" });
      setError(err instanceof Error ? err.message : "Email sign-in failed. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (signupPassword !== signupConfirmPassword) {
      setLoading(false);
      setError("Passwords do not match.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/registration/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signupEmail.trim(),
          password1: signupPassword,
          password2: signupConfirmPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(await extractApiError(response, "Account creation failed. Please retry."));
      }

      const data = (await response.json()) as AuthPayload;
      await persistSession(data, signupEmail.trim());
      trackEvent("login_success", { provider: "email_signup" });
      redirectAfterSuccess();
    } catch (err) {
      trackEvent("login_failed", { provider: "email_signup" });
      setError(err instanceof Error ? err.message : "Account creation failed. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid-aurora relative min-h-screen overflow-x-hidden px-4 py-8 sm:px-5 sm:py-10">
      <div className="pointer-events-none absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-indigo-300/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -right-20 h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-6 sm:gap-8 md:flex-row md:items-center">
        <section className="md:w-1/2">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
            <BrandMark to="/" imageClassName="h-9 sm:h-10 w-auto" />
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-800">
              <span aria-hidden>&larr;</span> Back to search
            </Link>
          </div>
          <p className="mt-8 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-800">
            Secure access
          </p>
          <h1 className="font-display mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl md:text-5xl">
            Access your Safe workspace and advisor workflows.
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
            Sign in once and continue across search, Safe cases, and CA request tracking.
          </p>
        </section>

        <section className="md:w-1/2">
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:rounded-[30px] sm:p-7 md:p-8">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">Welcome to Complia</h2>
            <p className="mt-2 text-sm text-slate-600">Use email/password or Google to access your Safe workspace.</p>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActiveMode("signin")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activeMode === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setActiveMode("signup")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  activeMode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                Create account
              </button>
            </div>

            {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

            {activeMode === "signin" ? (
              <form onSubmit={handleEmailSignIn} className="mt-5 space-y-3">
                <div>
                  <label htmlFor="signin-email" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Email
                  </label>
                  <input
                    id="signin-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-hidden ring-indigo-200 transition focus:border-indigo-400 focus:ring-2"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label htmlFor="signin-password" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Password
                  </label>
                  <input
                    id="signin-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-hidden ring-indigo-200 transition focus:border-indigo-400 focus:ring-2"
                    placeholder="Your password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Sign in with email"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleEmailSignUp} className="mt-5 space-y-3">
                <div>
                  <label htmlFor="signup-email" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-hidden ring-indigo-200 transition focus:border-indigo-400 focus:ring-2"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label htmlFor="signup-password" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Password
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-hidden ring-indigo-200 transition focus:border-indigo-400 focus:ring-2"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label htmlFor="signup-password-confirm" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Confirm password
                  </label>
                  <input
                    id="signup-password-confirm"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-hidden ring-indigo-200 transition focus:border-indigo-400 focus:ring-2"
                    placeholder="Repeat password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  {loading ? "Creating account..." : "Create account"}
                </button>
              </form>
            )}

            <div className="mt-5 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              <span>OR</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              onClick={() => {
                if (!googleConfigured) {
                  setError("Google sign-in is not configured for this environment.");
                  return;
                }
                googleLogin();
              }}
              disabled={loading || !googleConfigured}
              className="mt-4 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
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
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <Link to="/contact-us" className="font-semibold text-slate-600 hover:text-indigo-800">
                Contact
              </Link>
              <span>·</span>
              <Link to="/terms-and-conditions" className="font-semibold text-slate-600 hover:text-indigo-800">
                Terms
              </Link>
              <span>·</span>
              <Link to="/privacy-policy" className="font-semibold text-slate-600 hover:text-indigo-800">
                Privacy
              </Link>
              <span>·</span>
              <Link to="/refund-policy" className="font-semibold text-slate-600 hover:text-indigo-800">
                Refunds
              </Link>
              <span>·</span>
              <Link to="/cancellation-policy" className="font-semibold text-slate-600 hover:text-indigo-800">
                Cancellation
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

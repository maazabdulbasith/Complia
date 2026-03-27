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
          const errData = await backendResponse.json().catch(() => ({}));
          console.error("Backend error:", errData);
          throw new Error("Authentication failed");
        }

        const data = await backendResponse.json();
        localStorage.setItem("complia_token", data.access);
        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
        } else {
          const decoded = jwtDecode<{ email?: string }>(data.access);
          localStorage.setItem("user", JSON.stringify({ email: decoded.email || "User" }));
        }
        trackEvent("login_success", { provider: "google" });
        const next = searchParams.get("next") || "/";
        navigate(next);
      } catch (err) {
        console.error(err);
        trackEvent("login_failed", { provider: "google" });
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      trackEvent("login_failed", { provider: "google" });
      setError("Google Sign-In was cancelled or failed.");
    },
    flow: "implicit",
  });

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#0a0a10] overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-[-10%] left-[-5%] w-[450px] h-[450px] bg-indigo-600/15 blur-[130px] rounded-full animate-blob" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[450px] h-[450px] bg-purple-600/15 blur-[130px] rounded-full animate-blob animation-delay-2000" />
      <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-blue-600/10 blur-[100px] rounded-full animate-blob animation-delay-4000" />

      {/* Subtle Grid Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwgMC4wMikiIHN0cm9rZS13aWR0aD0iMSIvPjxwYXRoIGQ9Ik0gNDAgMCBMIDAgMCAwIDQwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-40" />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Back to Home */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to search
          </Link>
        </div>

        {/* Logo/Branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-5 shadow-2xl shadow-indigo-500/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Complia</h1>
          <p className="mt-2 text-gray-400 text-lg">Your Compliance Vault</p>
        </div>

        {/* Glassmorphism Card */}
        <div className="bg-white/[0.04] backdrop-blur-2xl rounded-3xl p-8 border border-white/[0.08] shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white">Welcome back</h2>
            <p className="text-sm text-gray-400 mt-1">Sign in to access your saved notices</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* Google Sign-In Button */}
            <button
              onClick={() => {
                if (!googleConfigured) {
                  setError("Google sign-in is not configured for this environment.");
                  return;
                }
                googleLogin();
              }}
              disabled={loading || !googleConfigured}
              className="group relative w-full py-4 px-6 bg-white rounded-xl font-semibold text-gray-800 transition-all hover:shadow-lg hover:shadow-white/10 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {loading ? "Signing in..." : "Continue with Google"}
            </button>
            {!googleConfigured && (
              <p className="text-xs text-amber-300 text-center">
                Google OAuth is disabled. Set <code>VITE_GOOGLE_CLIENT_ID</code> to enable it.
              </p>
            )}

            {/* Divider */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.06]"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0a0a10] px-3 text-gray-600 tracking-widest">or</span>
              </div>
            </div>

            {/* Email Sign-up Placeholder */}
            <button
              disabled={loading}
              className="w-full py-3.5 px-4 bg-white/[0.04] border border-white/[0.08] text-gray-400 rounded-xl font-medium transition-all hover:bg-white/[0.08] hover:text-gray-200 hover:border-white/[0.12] disabled:opacity-50"
            >
              Sign in with Email (Coming Soon)
            </button>
          </div>

          <p className="mt-8 text-center text-[11px] text-gray-600 leading-relaxed px-4">
            By signing in, you agree to our{" "}
            <span className="text-gray-400 hover:text-white cursor-pointer transition-colors">Terms of Service</span>{" "}
            and{" "}
            <span className="text-gray-400 hover:text-white cursor-pointer transition-colors">Privacy Policy</span>.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-10 text-center">
          <p className="text-gray-700 text-[10px] tracking-[0.2em] uppercase font-medium">Built for Indian Compliance</p>
        </div>
      </div>
    </div>
  );
}

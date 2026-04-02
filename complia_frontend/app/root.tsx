import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { trackEvent } from "./lib/analytics";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/brand/complia-logo.png", type: "image/png" },
  { rel: "apple-touch-icon", href: "/brand/complia-logo.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

import { GoogleOAuthProvider } from "@react-oauth/google";
import { useEffect } from "react";
import { useLocation } from "react-router";

export default function App() {
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
  const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "");
  const location = useLocation();

  useEffect(() => {
    trackEvent("page_view", { page: location.pathname });

    const intervalId = window.setInterval(() => {
      trackEvent("page_view", { page: location.pathname, heartbeat: true });
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const canonicalHref = `${SITE_URL || window.location.origin}${location.pathname}`;
    let linkEl = document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!linkEl) {
      linkEl = document.createElement("link");
      linkEl.setAttribute("rel", "canonical");
      document.head.appendChild(linkEl);
    }
    linkEl.setAttribute("href", canonicalHref);
  }, [SITE_URL, location.pathname]);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Outlet />
    </GoogleOAuthProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-2xl p-8 pt-16 text-slate-900">
      <h1 className="text-3xl font-bold tracking-tight">{message}</h1>
      <p className="mt-2 text-slate-600">{details}</p>
      {stack && (
        <pre className="mt-6 w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}

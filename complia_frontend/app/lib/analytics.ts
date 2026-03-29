import { sendAnalyticsEvent } from "../api/client";

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

type GtagEvent = (
  command: "event",
  action: string,
  params?: AnalyticsProperties
) => void;

type PosthogCapture = (eventName: string, properties?: AnalyticsProperties) => void;

declare global {
  interface Window {
    gtag?: GtagEvent;
    posthog?: {
      capture?: PosthogCapture;
    };
  }
}

function analyticsEnabled(): boolean {
  if (import.meta.env.VITE_ENABLE_ANALYTICS === "true") {
    return true;
  }
  return import.meta.env.PROD;
}

export function getAnalyticsSessionId(): string {
  const key = "complia_session_id";
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const generated = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(key, generated);
  return generated;
}

export function trackEvent(eventName: string, properties: AnalyticsProperties = {}): void {
  if (!analyticsEnabled() || typeof window === "undefined") {
    return;
  }

  try {
    if (window.posthog?.capture) {
      window.posthog.capture(eventName, properties);
      return;
    }

    if (window.gtag) {
      window.gtag("event", eventName, properties);
    }

    void sendAnalyticsEvent({
      event_name: eventName,
      path: window.location.pathname,
      metadata: properties,
      session_id: getAnalyticsSessionId(),
    });
  } catch {
    // Analytics must never block product interactions.
  }
}

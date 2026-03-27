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
  } catch {
    // Analytics must never block product interactions.
  }
}

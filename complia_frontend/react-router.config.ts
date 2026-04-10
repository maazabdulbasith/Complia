import type { Config } from "@react-router/dev/config";

export default {
  // Vercel deployment is static in this project, so generate SPA output.
  ssr: false,
  async prerender() {
    try {
      const res = await fetch("https://complia-mzrq.onrender.com/sitemap.xml");
      const xml = await res.text();
      const locs = xml.match(/<loc>(.*?)<\/loc>/g) || [];
      const paths = locs.map((loc) => {
        const url = new URL(loc.replace(/<\/?loc>/g, ""));
        return decodeURI(url.pathname);
      });
      // Deduplicate and ensure base routes are included
      return Array.from(new Set([
        "/", "/faq", "/contact-us", "/ca-help", "/parser",
        "/privacy-policy", "/terms-and-conditions", "/refund-policy", "/cancellation-policy",
        ...paths
      ]));
    } catch (e) {
      console.warn("Could not fetch sitemap for prerendering, falling back to static routes");
      return [
        "/", "/faq", "/contact-us", "/ca-help", "/parser",
        "/privacy-policy", "/terms-and-conditions", "/refund-policy", "/cancellation-policy"
      ];
    }
  }
} satisfies Config;

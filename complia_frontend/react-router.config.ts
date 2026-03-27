import type { Config } from "@react-router/dev/config";

export default {
  // Vercel deployment is static in this project, so generate SPA output.
  ssr: false,
} satisfies Config;

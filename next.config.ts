import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The hidden browser ships its own files; don't bundle it.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // Ship the compressed Chromium files with the pages that open Samsara links (on Vercel).
  outputFileTracingIncludes: {
    "/loads": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/t/*": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/c/*": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/t/*": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/c/*": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  async redirects() {
    return [{ source: "/", destination: "/loads", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

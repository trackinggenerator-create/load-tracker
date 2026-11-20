import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The hidden browser ships its own files; don't bundle it.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
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

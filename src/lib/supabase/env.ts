/** Public Supabase settings. Safe in the browser: Row Level Security protects the data. */
export function supabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local");
  }
  return { url: url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, ""), key };
}

/**
 * The site's public address, used to build customer tracking links.
 * Order: an explicit NEXT_PUBLIC_SITE_URL, then the production address Vercel provides, then the
 * address the page was opened on (pass `requestOrigin` from the request), then localhost:3001.
 */
export function siteUrl(requestOrigin?: string | null): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const url = explicit || (vercel ? `https://${vercel}` : requestOrigin || "http://localhost:3001");
  return url.replace(/\/$/, "");
}

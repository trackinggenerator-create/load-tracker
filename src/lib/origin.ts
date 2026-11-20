import "server-only";
import { headers } from "next/headers";
import { siteUrl } from "@/lib/supabase/env";

/** The address to build customer links on: the live site, or the address this page was opened on. */
export async function linkOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return siteUrl(host ? `${h.get("x-forwarded-proto") ?? "http"}://${host}` : null);
}

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Used until a broker saves their own company name. Set COMPANY_NAME in .env.local or Vercel to change it. */
export function defaultCompanyName(): string {
  return process.env.COMPANY_NAME?.trim() || "Werner Enterprises";
}

/** The company name a broker saved (shown on their dashboard and customer pages), or the default. */
export async function companyNameFor(ownerId: string): Promise<string> {
  const db = createSupabaseAdminClient();
  const { data } = await db.from("broker_settings").select("company_name").eq("owner_id", ownerId).maybeSingle<{ company_name: string }>();
  return data?.company_name?.trim() || defaultCompanyName();
}

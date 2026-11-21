import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabasePublicEnv } from "./env";

/**
 * Server-only Supabase client with the secret key. It skips Row Level Security, so use it only
 * for the public tracking page (which returns safe fields) and for saving tracking readings.
 */
export function createSupabaseAdminClient() {
  const { url } = supabasePublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set in .env.local");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

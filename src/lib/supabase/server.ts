import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabasePublicEnv } from "./env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Acts as the signed-in broker, so Row Level Security applies.
 * Reads cookies, so any component using it must sit inside <Suspense>.
 */
export async function createSupabaseServerClient() {
  await connection();
  const { url, key } = supabasePublicEnv();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

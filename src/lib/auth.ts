import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emailToUsername } from "@/lib/username";

export type CurrentUser = { id: string; username: string | null };

/** The signed-in broker, or null. Verifies the session with Supabase; never trusts the cookie alone. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;
  return { id: sub, username: emailToUsername(data.claims.email as string | undefined) };
});

/** The signed-in broker. Sends signed-out visitors to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

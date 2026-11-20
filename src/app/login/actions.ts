"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeUsername, usernameToEmail } from "@/lib/username";

export type FormState = { status: "idle" | "error"; message?: string; username?: string };

const text = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v : "";
};

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const typed = text(form, "username").trim();
  const username = normalizeUsername(typed);
  const password = text(form, "password");
  if (!typed || !password) return { status: "error", message: "Enter your username and password.", username: typed };
  if (!username) return { status: "error", message: "That username and password don't match.", username: typed };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (error) {
    if (/rate limit|too many/i.test(error.message)) return { status: "error", message: "Too many tries. Wait a few minutes.", username };
    return { status: "error", message: "That username and password don't match.", username };
  }
  redirect("/loads");
}

/** New accounts are turned off unless ALLOW_SIGNUP=true is set (in .env.local or on Vercel). */
export async function signupAllowed(): Promise<boolean> {
  return process.env.ALLOW_SIGNUP === "true";
}

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await signupAllowed())) return { status: "error", message: "New accounts are closed." };
  const typed = text(form, "username").trim();
  const username = normalizeUsername(typed);
  const password = text(form, "password");
  if (!username) {
    return {
      status: "error",
      message: "Usernames are 3 to 30 characters: letters, numbers, dots, dashes or underscores, no spaces.",
      username: typed,
    };
  }
  if (password.length < 10) return { status: "error", message: "Use a password with at least 10 characters.", username };

  // Created already confirmed: there's no real inbox behind a username, so no email is sent.
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) {
    if (/already|exists|registered/i.test(error.message)) return { status: "error", message: "That username is taken. Try another.", username };
    if (/password/i.test(error.message)) return { status: "error", message: "Pick a stronger password.", username };
    console.error("Sign-up failed", error);
    return { status: "error", message: "Couldn't create the account. Try again.", username };
  }

  const supabase = await createSupabaseServerClient();
  const { error: loginError } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if (loginError) return { status: "error", message: "Account created. Log in with your new username.", username };
  redirect("/loads");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

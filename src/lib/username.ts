/**
 * Brokers log in with a username. Supabase needs an email behind every account, so each username
 * gets a stand-in address on the reserved ".invalid" domain, which can never receive mail.
 * No email is ever sent to it: accounts are created already confirmed (see signUp).
 */
const DOMAIN = "users.load-tracker.invalid";

/** Lowercase letters, numbers, dot, dash and underscore; 3 to 30 characters. */
export function normalizeUsername(input: string): string | null {
  const u = input.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{2,29}$/.test(u) ? u : null;
}

export function usernameToEmail(username: string): string {
  return `${username}@${DOMAIN}`;
}

export function emailToUsername(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.endsWith(`@${DOMAIN}`) ? email.slice(0, -DOMAIN.length - 1) : email;
}

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabasePublicEnv } from "@/lib/supabase/env";

/**
 * Keeps the broker's login fresh and sends signed-out visitors from /loads to /login.
 * Pages and actions still check the user themselves; this is only a fast first gate.
 * Customer tracking pages (/t/...) and their data (/api/t/...) are public and skipped.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabasePublicEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const brokerPage = ["/loads", "/customers"].some((p) => request.nextUrl.pathname.startsWith(p));
  if (!data?.claims?.sub && brokerPage) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    const redirect = NextResponse.redirect(login);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|t/|api/t/|c/|api/c/|dev/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};

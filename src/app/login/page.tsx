import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <p className="text-[13px] font-bold tracking-wide text-muted uppercase">Load Tracking · Broker tools</p>
      {/* Sign-up is off unless ALLOW_SIGNUP=true. The server action checks this too. */}
      <LoginForm allowSignup={process.env.ALLOW_SIGNUP === "true"} />
    </main>
  );
}

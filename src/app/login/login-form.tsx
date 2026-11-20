"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type FormState } from "./actions";
import { ui } from "@/components/ui";

export function LoginForm({ allowSignup }: { allowSignup: boolean }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction, inPending] = useActionState<FormState, FormData>(signIn, { status: "idle" });
  const [upState, upAction, upPending] = useActionState<FormState, FormData>(signUp, { status: "idle" });
  const state = mode === "in" ? inState : upState;
  const pending = mode === "in" ? inPending : upPending;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-[22px] font-black">{mode === "in" ? "Log in" : "Create your account"}</h1>
      {state.status === "error" && <p role="alert" className={ui.alert}>{state.message}</p>}
      <form key={mode} action={mode === "in" ? inAction : upAction} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className={ui.label}>Username</label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={state.username ?? ""}
            className={ui.input}
          />
          {mode === "up" && <span className="text-[13px] text-muted">Letters, numbers, dots, dashes or underscores. No spaces.</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className={ui.label}>Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            className={ui.input}
          />
          {mode === "up" && <span className="text-[13px] text-muted">At least 10 characters.</span>}
        </div>
        <button type="submit" disabled={pending} className={ui.primary}>
          {pending ? "One moment…" : mode === "in" ? "Log in" : "Create account"}
        </button>
      </form>
      {allowSignup && (
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="text-[14px] font-semibold text-accent">
          {mode === "in" ? "New here? Create an account" : "Already have an account? Log in"}
        </button>
      )}
    </section>
  );
}

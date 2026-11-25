"use client";

import { useEffect, useRef, useState } from "react";

/** How long the countdown runs after Push update: about how long reading the carrier's page takes. */
const PUSH_COUNTDOWN_MS = 15_000;

/** The current time, ticking once a second (for countdowns). */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** What a push hands back: how to show the new location, or a message if it couldn't get one. */
export type PushResult = { show: () => void; error?: string };

/** Idle, a push counting down, or a push that just finished (with a problem, if there was one). */
type Phase = { name: "idle" } | { name: "pushing"; until: number } | { name: "done"; at: number; error?: string };

/** How long "Location updated" stays up after the new location appears. */
const DONE_MESSAGE_MS = 6_000;

const RefreshIcon = ({ spin = false }: { spin?: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={spin ? "animate-spin" : ""}
  >
    <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

/**
 * Push update: grabs a fresh location from the carrier's page. A short countdown runs while it
 * works; when it reaches 0 the new location appears on its own.
 * `pushAvailableAt` (customers only) greys the button out until another push is allowed.
 */
export function UpdateBar({
  push,
  pushAvailableAt,
  tone = "card",
}: {
  push: () => Promise<PushResult>;
  pushAvailableAt?: string | null;
  /** "button": just the button (countdown shown on it), for tight spots like the dashboard card. */
  tone?: "card" | "plain" | "button";
}) {
  const now = useNow();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function start() {
    const until = Date.now() + PUSH_COUNTDOWN_MS;
    setPhase({ name: "pushing", until });
    let result: PushResult;
    try {
      result = await push();
    } catch {
      result = { show: () => {}, error: "You seem to be offline. Try again in a moment." };
    }
    // Hold the new location until the countdown ends, then show it on its own.
    const wait = until - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (!alive.current) return;
    if (!result.error) result.show();
    setPhase({ name: "done", at: Date.now(), error: result.error });
  }

  const note =
    phase.name === "done"
      ? phase.error
        ? { text: phase.error, cls: "text-warn" }
        : now - phase.at < DONE_MESSAGE_MS
          ? { text: "Location updated just now.", cls: "text-ok" }
          : null
      : null;

  const waitPush = pushAvailableAt ? new Date(pushAvailableAt).getTime() - now : 0;

  if (tone === "button") {
    const pushing = phase.name === "pushing";
    const left = pushing ? phase.until - now : 0;
    const justDone = note?.cls === "text-ok";
    return (
      <span className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={start}
          disabled={pushing || waitPush > 0}
          aria-live="polite"
          className={`flex min-h-10 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-[14px] font-semibold tabular-nums disabled:cursor-default ${
            pushing ? "text-accent" : justDone ? "text-ok" : "text-fg"
          } ${waitPush > 0 && !pushing ? "opacity-60" : ""}`}
        >
          <RefreshIcon spin={pushing} />
          {pushing
            ? left > 0
              ? `Updating ${mmss(left)}`
              : "Almost there…"
            : justDone
              ? "Updated ✓"
              : waitPush > 0
                ? `Push again in ${mmss(waitPush)}`
                : "Push update"}
        </button>
        {note && !justDone && <span className={`max-w-[16rem] text-right text-[13px] font-semibold ${note.cls}`}>{note.text}</span>}
      </span>
    );
  }

  const box = `flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[14px] ${
    tone === "card" ? "rounded-card border border-line bg-surface px-4 py-2.5" : ""
  }`;

  if (phase.name === "pushing") {
    const left = phase.until - now;
    return (
      <div className={box}>
        <span aria-live="polite" className="tabular-nums">
          {left > 0 ? (
            <>
              <span className="text-muted">Getting the latest location… </span>
              <span className="font-bold">{mmss(left)}</span>
            </>
          ) : (
            <span className="text-muted">Almost there…</span>
          )}
        </span>
        <span className="flex min-h-10 items-center gap-1.5 px-1 text-[14px] font-semibold text-accent">
          <RefreshIcon spin /> Updating
        </span>
      </div>
    );
  }

  return (
    <div className={box}>
      <span className="flex flex-col" aria-live="polite">
        <span className="text-muted">Location updates on its own every few minutes.</span>
        {note && <span className={`text-[13px] font-semibold ${note.cls}`}>{note.text}</span>}
      </span>
      <button
        type="button"
        onClick={start}
        disabled={waitPush > 0}
        className="flex min-h-10 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-[14px] font-semibold text-fg disabled:opacity-60"
      >
        <RefreshIcon />
        {waitPush > 0 ? `Push again in ${mmss(waitPush)}` : "Push update"}
      </button>
    </div>
  );
}

/**
 * Behind the scenes: asks for fresh data just after an automatic update falls due (a few times,
 * since reading the carrier's page takes several seconds), so locations stay current on their own.
 */
export function useRefetchWhenDue(nextUpdateAt: string | null, refetch: () => void) {
  useEffect(() => {
    if (!nextUpdateAt) return;
    const due = new Date(nextUpdateAt).getTime() - Date.now();
    const timers = [1_500, 12_000, 24_000].map((extra) => setTimeout(refetch, Math.max(0, due) + extra));
    return () => timers.forEach(clearTimeout);
  }, [nextUpdateAt, refetch]);
}

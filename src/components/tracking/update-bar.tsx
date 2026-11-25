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

/** Idle, or a push in progress (`result` arrives when the carrier's page has been read). */
type Phase = { name: "idle" } | { name: "pushing"; until: number; result: PushResult | null };

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
 * works; when it reaches 0 a Refresh button shows the new location.
 * `pushAvailableAt` (customers only) greys the button out until another push is allowed.
 */
export function UpdateBar({
  push,
  pushAvailableAt,
  tone = "card",
}: {
  push: () => Promise<PushResult>;
  pushAvailableAt?: string | null;
  tone?: "card" | "plain";
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

  // The countdown is over and the new location has arrived: offer Refresh (or say what went wrong).
  const finished = phase.name === "pushing" && phase.result && now >= phase.until ? phase.result : null;
  const view = !finished ? phase.name : finished.error ? "idle" : "ready";
  const note = finished?.error ?? null;

  async function start() {
    const until = Date.now() + PUSH_COUNTDOWN_MS;
    setPhase({ name: "pushing", until, result: null });
    let result: PushResult;
    try {
      result = await push();
    } catch {
      result = { show: () => {}, error: "You seem to be offline. Try again in a moment." };
    }
    if (alive.current) setPhase((p) => (p.name === "pushing" ? { ...p, result } : p));
  }

  const waitPush = pushAvailableAt ? new Date(pushAvailableAt).getTime() - now : 0;
  const box = `flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[14px] ${
    tone === "card" ? "rounded-card border border-line bg-surface px-4 py-2.5" : ""
  }`;

  if (view === "ready" && finished) {
    return (
      <div className={box}>
        <span aria-live="polite" className="font-semibold text-ok">
          New location is ready
        </span>
        <button
          type="button"
          onClick={() => {
            finished.show();
            setPhase({ name: "idle" });
          }}
          className="flex min-h-10 items-center gap-1.5 rounded-[10px] bg-accent px-3 text-[14px] font-bold text-on-accent"
        >
          <RefreshIcon /> Refresh
        </button>
      </div>
    );
  }

  if (view === "pushing" && phase.name === "pushing") {
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
      <span className="flex flex-col">
        <span className="text-muted">Location updates on its own every few minutes.</span>
        {note && (
          <span role="alert" className="text-[13px] font-semibold text-warn">
            {note}
          </span>
        )}
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

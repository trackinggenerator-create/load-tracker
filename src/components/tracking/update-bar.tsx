"use client";

import { useEffect, useState } from "react";

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

/**
 * "Next update in 4:32" plus a Push update button that grabs a fresh location now.
 * `pushAvailableAt` (customers) greys the button out with its own countdown after a push.
 */
export function UpdateBar({
  nextUpdateAt,
  pushAvailableAt,
  onPush,
  pushing,
  note,
  tone = "card",
}: {
  nextUpdateAt: string | null;
  pushAvailableAt?: string | null;
  onPush: () => void;
  pushing: boolean;
  note?: string | null;
  tone?: "card" | "plain";
}) {
  const now = useNow();
  if (!nextUpdateAt) return null;
  const left = new Date(nextUpdateAt).getTime() - now;
  const waitPush = pushAvailableAt ? new Date(pushAvailableAt).getTime() - now : 0;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[14px] ${
        tone === "card" ? "rounded-card border border-line bg-surface px-4 py-2.5" : ""
      }`}
    >
      <span className="flex flex-col">
        <span aria-live="polite" className="tabular-nums">
          {pushing ? (
            <span className="font-semibold text-accent">Getting the latest location…</span>
          ) : left > 0 ? (
            <>
              <span className="text-muted">Next update in </span>
              <span className="font-bold">{mmss(left)}</span>
            </>
          ) : (
            <span className="font-semibold text-accent">Updating now…</span>
          )}
        </span>
        {note && <span className="text-[13px] text-muted">{note}</span>}
      </span>
      <button
        type="button"
        onClick={onPush}
        disabled={pushing || waitPush > 0}
        className="flex min-h-10 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-[14px] font-semibold text-fg disabled:opacity-60"
      >
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
          className={pushing ? "animate-spin" : ""}
        >
          <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        {pushing ? "Updating…" : waitPush > 0 ? `Push again in ${mmss(waitPush)}` : "Push update"}
      </button>
    </div>
  );
}

/**
 * Calls `refetch` just after an automatic update falls due (a few times, since reading the
 * carrier's page takes several seconds), so the new location shows right as the countdown ends.
 */
export function useRefetchWhenDue(nextUpdateAt: string | null, refetch: () => void) {
  useEffect(() => {
    if (!nextUpdateAt) return;
    const due = new Date(nextUpdateAt).getTime() - Date.now();
    const timers = [1_500, 12_000, 24_000].map((extra) => setTimeout(refetch, Math.max(0, due) + extra));
    return () => timers.forEach(clearTimeout);
  }, [nextUpdateAt, refetch]);
}

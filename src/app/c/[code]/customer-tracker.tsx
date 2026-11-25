"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { formatDay } from "@/lib/dates";
import type { PublicLoad } from "@/lib/tracking";
import type { FleetPin } from "@/components/tracking/fleet-map";
import { LocationDetails, pollEvery, shortPlace, statusOf, StatusChip } from "@/components/tracking/load-parts";
import { TimeAgo } from "@/components/time-ago";
import { UpdateBar, useRefetchWhenDue, type PushResult } from "@/components/tracking/update-bar";
import { ui } from "@/components/ui";
import { Route } from "../../t/[code]/live-tracker";

const FleetMap = dynamic(() => import("@/components/tracking/fleet-map"), {
  ssr: false,
  loading: () => <div className="h-[360px] animate-pulse rounded-card bg-surface-2 sm:h-[480px]" />,
});

/** One customer's page: every load in a list that opens up, plus an all-trucks map view. */
export function CustomerTracker({ code, initial }: { code: string; initial: PublicLoad[] }) {
  const [loads, setLoads] = useState(initial);
  // With a single load there's nothing to choose between, so it starts open.
  const [open, setOpen] = useState<Set<string>>(() => new Set(initial.length === 1 ? [initial[0].key] : []));
  const [view, setView] = useState<"list" | "map">("list");

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/c/${code}`, { cache: "no-store" });
      if (res.ok) setLoads(((await res.json()) as { loads: PublicLoad[] }).loads);
    } catch {
      // Offline for a moment; try again next time.
    }
  }, [code]);

  // Behind the scenes: check every minute, plus right when the soonest automatic update is due.
  const every = pollEvery(loads);
  useEffect(() => {
    if (!every) return;
    const t = setInterval(refetch, every);
    return () => clearInterval(t);
  }, [every, refetch]);
  const soonest = loads
    .map((l) => l.nextUpdateAt)
    .filter((t): t is string => Boolean(t))
    .sort()[0] ?? null;
  useRefetchWhenDue(soonest, refetch);

  /** Push update for one load: the new location is held until the countdown ends, then shown on its own. */
  async function push(key: string): Promise<PushResult> {
    const swap = (fresh: PublicLoad) => setLoads((prev) => prev.map((l) => (l.key === key ? fresh : l)));
    const res = await fetch(`/api/t/${key}`, { method: "POST", cache: "no-store" });
    if (!res.ok) return { show: () => {}, error: "Couldn't get a newer location right now. Try again in a minute." };
    const r = (await res.json()) as { load: PublicLoad; error?: string };
    if (r.error) {
      swap(r.load);
      return { show: () => {}, error: "Couldn't get a newer location right now. Showing the last one we have." };
    }
    return { show: () => swap(r.load) };
  }

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const pins: FleetPin[] = loads.flatMap((l, i) =>
    l.status === "active" && l.position ? [{ key: l.key, number: i + 1, label: `Load ${l.loadNumber}`, position: l.position }] : [],
  );

  // "2 in transit · 1 stopped · 1 delivered"
  const counts = new Map<string, number>();
  for (const l of loads) counts.set(statusOf(l).label, (counts.get(statusOf(l).label) ?? 0) + 1);
  const summary = [...counts].map(([label, n]) => `${n} ${label.toLowerCase().replace("…", "")}`).join(" · ");

  if (loads.length === 0) {
    return <p className={`${ui.card} p-6 text-center text-[14px] text-muted`}>No shipments are being tracked right now.</p>;
  }

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="flex flex-col">
          <h1 className="text-[22px] leading-tight font-black">Your shipments</h1>
          <p className="text-[14px] text-muted">{summary}</p>
        </div>
        {/* The all-trucks map: there when it's useful, quiet otherwise. */}
        {pins.length >= 2 && (
          <button
            type="button"
            onClick={() => setView(view === "list" ? "map" : "list")}
            className="flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-accent"
          >
            {view === "list" ? (
              <>
                <MapIcon /> All trucks on one map
              </>
            ) : (
              <>← Back to list</>
            )}
          </button>
        )}
      </section>

      {view === "map" ? (
        <>
          <FleetMap
            pins={pins}
            onSelect={(key) => {
              setOpen((prev) => new Set(prev).add(key));
              setView("list");
              setTimeout(() => document.getElementById(`load-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
            }}
          />
          <p className="text-[13px] text-muted">Tap a numbered pin to see that load.</p>
        </>
      ) : (
        <ul className="flex flex-col gap-3">
          {loads.map((l, i) => {
            const isOpen = open.has(l.key);
            const canOpen = l.status === "active";
            const place = shortPlace(l.position?.address ?? null);
            return (
              <li key={l.key} id={`load-${l.key}`} className={`${ui.card} scroll-mt-4 overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => canOpen && toggle(l.key)}
                  aria-expanded={canOpen ? isOpen : undefined}
                  disabled={!canOpen}
                  className="flex w-full items-center gap-3 p-4 text-left disabled:cursor-default"
                >
                  <span
                    className={`grid h-7 w-7 flex-none place-items-center rounded-full text-[13px] font-extrabold ${
                      l.status === "active" ? "bg-accent text-on-accent" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[16px] font-black tabular-nums">Load {l.loadNumber}</span>
                      <StatusChip load={l} small />
                    </span>
                    <span className="text-[13px] text-muted">
                      {[
                        l.trailerNumber && `Trailer ${l.trailerNumber}`,
                        l.status === "delivered"
                          ? l.delivery && `Delivered to ${l.delivery}`
                          : place && `Near ${place}`,
                        l.status === "active" && l.deliveryDate && `Delivery ${formatDay(l.deliveryDate)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {l.status === "active" && l.position && (
                        <>
                          {" · "}
                          <TimeAgo iso={l.position.at} />
                        </>
                      )}
                      {l.status === "delivered" && l.deliveredAt && (
                        <>
                          {" · "}
                          <TimeAgo iso={l.deliveredAt} />
                        </>
                      )}
                    </span>
                  </span>
                  {canOpen && (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                      className={`flex-none text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                {isOpen && canOpen && (
                  <div className="flex flex-col gap-3 border-t border-line p-4">
                    <UpdateBar tone="plain" push={() => push(l.key)} pushAvailableAt={l.pushAvailableAt} />
                    <Route load={l} />
                    <LocationDetails load={l} framed={false} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function MapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

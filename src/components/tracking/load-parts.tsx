"use client";

import dynamic from "next/dynamic";
import type { PublicLoad } from "@/lib/tracking";
import { TimeAgo } from "@/components/time-ago";
import { ui } from "@/components/ui";

// The map library needs the browser, so it loads only there.
const TruckMap = dynamic(() => import("./truck-map"), {
  ssr: false,
  loading: () => <div className="h-[300px] animate-pulse rounded-card bg-surface-2 sm:h-[420px]" />,
});

const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function direction(heading: number | null): string {
  return heading == null ? "" : compass[Math.round(heading / 45) % 8];
}

/** "In transit" / "Stopped" / "Delivered"…, with the matching chip colors. */
export function statusOf(load: PublicLoad): { label: string; chip: string } {
  if (load.status === "delivered") return { label: "Delivered", chip: "bg-ok-bg text-ok" };
  if (load.status === "expired") return { label: "Tracking ended", chip: "bg-surface-2 text-muted" };
  if (!load.position) return { label: "Locating truck…", chip: "bg-surface-2 text-muted" };
  return load.position.moving ? { label: "In transit", chip: "bg-ok-bg text-ok" } : { label: "Stopped", chip: "bg-warn-bg text-warn" };
}

export function StatusChip({ load, small = false }: { load: PublicLoad; small?: boolean }) {
  const s = statusOf(load);
  return (
    <span className={`flex-none rounded-full font-bold ${small ? "px-2.5 py-0.5 text-[12px]" : "px-3 py-1 text-[13px]"} ${s.chip}`}>
      {s.label}
    </span>
  );
}

/** Pulls "Winfield, TX" out of "I 30, Winfield, TX, 75493" for short summaries. */
export function shortPlace(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter((p) => p && !/^\d{5}(-\d{4})?$/.test(p));
  return parts.length >= 2 ? parts.slice(-2).join(", ") : parts[0] ?? null;
}

/** Map plus the current-location card for one load. */
export function LocationDetails({ load, framed = true }: { load: PublicLoad; framed?: boolean }) {
  const p = load.position;
  if (load.status !== "active") return null;
  if (!p) {
    return (
      <p className={`${framed ? ui.card : ""} p-6 text-center text-[14px] text-muted`}>
        We&apos;re getting the truck&apos;s location. This page updates by itself.
      </p>
    );
  }
  return (
    <>
      <TruckMap position={p} destination={load.destination} />
      <section className={`${framed ? ui.card : ""} flex flex-col gap-1 ${framed ? "p-4" : "px-1"}`}>
        <span className="text-[12px] font-bold tracking-wide text-muted uppercase">Current location</span>
        <span className="text-[17px] font-bold">{p.address ?? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}</span>
        <span className="text-[14px] text-muted">
          {p.moving ? `Moving${p.heading != null ? " " + direction(p.heading) : ""}` : "Stopped"} · Updated <TimeAgo iso={p.at} />
        </span>
        {load.destination?.address && (
          <span className="mt-2 text-[14px]">
            <span className="text-muted">Heading to </span>
            <span className="font-semibold">{load.destination.name || load.destination.address}</span>
          </span>
        )}
      </section>
    </>
  );
}

/** Asks the server for fresh data every so often (sooner while a truck is still being located). */
export function pollEvery(loads: PublicLoad[]): number | null {
  const active = loads.filter((l) => l.status === "active");
  if (active.length === 0) return null;
  return active.some((l) => !l.position) ? 15_000 : 60_000;
}

"use client";

import { useEffect, useState } from "react";
import { formatDay } from "@/lib/dates";
import type { PublicLoad } from "@/lib/tracking";
import { LocationDetails, pollEvery, StatusChip } from "@/components/tracking/load-parts";
import { ui } from "@/components/ui";

/** The single-load tracking page. */
export function LiveTracker({ code, initial }: { code: string; initial: PublicLoad }) {
  const [load, setLoad] = useState(initial);

  const every = pollEvery([load]);
  useEffect(() => {
    if (!every) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/t/${code}`, { cache: "no-store" });
        if (res.ok) setLoad((await res.json()) as PublicLoad);
      } catch {
        // Offline for a moment; try again next time.
      }
    }, every);
    return () => clearInterval(t);
  }, [code, every]);

  return (
    <>
      <section className={`${ui.card} flex flex-col gap-3 p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col">
            <h1 className="text-[22px] leading-tight font-black tabular-nums">Load {load.loadNumber}</h1>
            {load.trailerNumber && <span className="text-[14px] text-muted tabular-nums">Trailer {load.trailerNumber}</span>}
          </div>
          <StatusChip load={load} />
        </div>
        <Route load={load} />
      </section>

      <LocationDetails load={load} />

      {load.status === "delivered" && (
        <p className={`${ui.card} p-6 text-center text-[14px]`}>This shipment has been delivered. Live location is no longer shown.</p>
      )}
      {load.status === "expired" && (
        <p className={`${ui.card} p-6 text-center text-[14px] text-muted`}>This tracking link has ended. Contact your broker for an update.</p>
      )}
    </>
  );
}

export function Route({ load }: { load: PublicLoad }) {
  const day = formatDay(load.deliveryDate);
  if (!load.pickup && !load.delivery && !day) return null;
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
      {load.pickup && (
        <>
          <span className="text-muted">From</span>
          <span className="font-semibold">{load.pickup}</span>
        </>
      )}
      {load.delivery && (
        <>
          <span className="text-muted">To</span>
          <span className="font-semibold">{load.delivery}</span>
        </>
      )}
      {day && (
        <>
          <span className="text-muted">Delivery</span>
          <span className="font-semibold">{day}</span>
        </>
      )}
    </div>
  );
}

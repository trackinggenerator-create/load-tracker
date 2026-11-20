import { Suspense } from "react";
import { notFound } from "next/navigation";
import { defaultCompanyName } from "@/lib/company";
import { TrackingFrame } from "@/components/tracking/tracking-frame";
import { readSamsaraLink } from "@/lib/samsara";
import type { PublicLoad } from "@/lib/tracking";
import { LiveTracker } from "../../t/[code]/live-tracker";

/**
 * Only on this PC (never on the live site): shows the customer page for any Samsara link
 * without saving anything. Open /dev/preview?link=<samsara share link>
 */
async function Preview({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { link } = await searchParams;
  if (!link) return <p>Add ?link=&lt;Samsara share link&gt; to the address.</p>;
  const r = await readSamsaraLink(link);
  const load: PublicLoad = {
    key: "preview",
    deliveredAt: null,
    loadNumber: "4518823",
    trailerNumber: "53112",
    pickup: "Dallas, TX",
    delivery: "Memphis, TN",
    deliveryDate: null,
    status: "active",
    position: { lat: r.lat, lng: r.lng, heading: r.heading, moving: r.speedMph != null && r.speedMph > 2, address: r.address, at: r.positionAt },
    destination: r.destination,
    checkedAt: new Date().toISOString(),
  };
  return <LiveTracker code="preview" initial={{ ...load }} />;
}

export default function DevPreview({ searchParams }: PageProps<"/dev/preview">) {
  return (
    <TrackingFrame company={defaultCompanyName()}>
      <Suspense fallback={<p className="text-[14px] text-muted">Reading the Samsara link…</p>}>
        <Preview searchParams={searchParams as Promise<{ link?: string }>} />
      </Suspense>
    </TrackingFrame>
  );
}

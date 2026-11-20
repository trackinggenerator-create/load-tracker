import { Suspense } from "react";
import { notFound } from "next/navigation";
import { companyName } from "@/lib/company";
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
    <>
      <header className="bg-header text-on-header">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3.5">
          <span className="text-[17px] font-black tracking-tight">{companyName()}</span>
          <span className="text-[12px] font-semibold tracking-wide uppercase opacity-75">Shipment tracking</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">
        <Suspense fallback={<p className="text-[14px] text-muted">Reading the Samsara link…</p>}>
          <Preview searchParams={searchParams as Promise<{ link?: string }>} />
        </Suspense>
      </main>
      <footer className="mx-auto w-full max-w-3xl px-4 pb-6 text-[12px] text-muted">
        Tracking provided by {companyName()}. Locations update every few minutes.
      </footer>
    </>
  );
}

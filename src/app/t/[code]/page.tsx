import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import { companyName } from "@/lib/company";
import { getPublicLoad, refreshLoad } from "@/lib/tracking";
import { LiveTracker } from "./live-tracker";

export const maxDuration = 60;

export async function generateMetadata({ params }: PageProps<"/t/[code]">): Promise<Metadata> {
  const { code } = await params;
  const found = await getPublicLoad(code);
  return { title: found ? `Load ${found.load.loadNumber} tracking` : "Tracking link not found" };
}

async function Tracker({ params }: { params: Promise<{ code: string }> }) {
  await connection();
  const { code } = await params;
  const found = await getPublicLoad(code);
  if (!found) notFound();
  if (found.stale) after(() => refreshLoad(found.id));
  return <LiveTracker code={code} initial={found.load} />;
}

export default function TrackingPage({ params }: PageProps<"/t/[code]">) {
  return (
    <>
      <header className="bg-header text-on-header">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3.5">
          <span className="text-[17px] font-black tracking-tight">{companyName()}</span>
          <span className="text-[12px] font-semibold tracking-wide uppercase opacity-75">Shipment tracking</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">
        <Suspense fallback={<p className="text-[14px] text-muted">Loading shipment…</p>}>
          <Tracker params={params} />
        </Suspense>
      </main>
      <footer className="mx-auto w-full max-w-3xl px-4 pb-6 text-[12px] text-muted">
        Tracking provided by {companyName()}. Locations update every few minutes.
      </footer>
    </>
  );
}

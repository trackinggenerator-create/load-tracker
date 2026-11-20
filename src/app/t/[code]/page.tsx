import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import { companyNameFor } from "@/lib/company";
import { getPublicLoad, refreshLoad } from "@/lib/tracking";
import { TrackingFrame } from "@/components/tracking/tracking-frame";
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
  const company = await companyNameFor(found.ownerId);
  return (
    <TrackingFrame company={company}>
      <LiveTracker code={code} initial={found.load} />
    </TrackingFrame>
  );
}

export default function TrackingPage({ params }: PageProps<"/t/[code]">) {
  return (
    <Suspense
      fallback={
        <TrackingFrame company={null}>
          <p className="text-[14px] text-muted">Loading shipment…</p>
        </TrackingFrame>
      }
    >
      <Tracker params={params} />
    </Suspense>
  );
}

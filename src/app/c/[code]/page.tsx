import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import { companyNameFor } from "@/lib/company";
import { getPublicCustomer, refreshLoadsInTurn } from "@/lib/tracking";
import { TrackingFrame } from "@/components/tracking/tracking-frame";
import { CustomerTracker } from "./customer-tracker";

// Up to a few Samsara reads, one after another, after the page is sent.
export const maxDuration = 60;
export const metadata: Metadata = { title: "Your shipments" };

const NOTE = "Delivered loads stay listed for 24 hours.";

async function Tracker({ params }: { params: Promise<{ code: string }> }) {
  await connection();
  const { code } = await params;
  const found = await getPublicCustomer(code);
  if (!found) notFound();
  if (found.staleIds.length) after(() => refreshLoadsInTurn(found.staleIds));
  const company = await companyNameFor(found.ownerId);
  return (
    <TrackingFrame company={company} footerNote={NOTE}>
      <CustomerTracker code={code} initial={found.loads} />
    </TrackingFrame>
  );
}

export default function CustomerPage({ params }: PageProps<"/c/[code]">) {
  return (
    <Suspense
      fallback={
        <TrackingFrame company={null} footerNote={NOTE}>
          <p className="text-[14px] text-muted">Loading shipments…</p>
        </TrackingFrame>
      }
    >
      <Tracker params={params} />
    </Suspense>
  );
}

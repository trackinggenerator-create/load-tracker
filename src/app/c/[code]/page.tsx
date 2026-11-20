import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import { companyName } from "@/lib/company";
import { getPublicCustomer, refreshLoadsInTurn } from "@/lib/tracking";
import { CustomerTracker } from "./customer-tracker";

// Up to a few Samsara reads, one after another, after the page is sent.
export const maxDuration = 60;
export const metadata: Metadata = { title: "Your shipments" };

async function Tracker({ params }: { params: Promise<{ code: string }> }) {
  await connection();
  const { code } = await params;
  const found = await getPublicCustomer(code);
  if (!found) notFound();
  if (found.staleIds.length) after(() => refreshLoadsInTurn(found.staleIds));
  return <CustomerTracker code={code} initial={found.loads} />;
}

export default function CustomerPage({ params }: PageProps<"/c/[code]">) {
  return (
    <>
      <header className="bg-header text-on-header">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3.5">
          <span className="text-[17px] font-black tracking-tight">{companyName()}</span>
          <span className="text-[12px] font-semibold tracking-wide uppercase opacity-75">Shipment tracking</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">
        <Suspense fallback={<p className="text-[14px] text-muted">Loading shipments…</p>}>
          <Tracker params={params} />
        </Suspense>
      </main>
      <footer className="mx-auto w-full max-w-3xl px-4 pb-6 text-[12px] text-muted">
        Tracking provided by {companyName()}. Locations update every few minutes. Delivered loads stay listed for 24 hours.
      </footer>
    </>
  );
}

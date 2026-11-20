import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { linkOrigin } from "@/lib/origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BrokerShell } from "@/components/broker-shell";
import { ui } from "@/components/ui";
import { CopyLink } from "../loads/copy-link";

export const metadata: Metadata = { title: "My customers" };

type Customer = { id: string; name: string; share_code: string };
type LoadRow = { customer_id: string | null; status: "active" | "delivered"; expires_at: string };

/** The page renders per request (it reads the login cookie), so checking the clock here is fine. */
function countLoads(loads: LoadRow[]) {
  const now = Date.now();
  const counts = new Map<string, { tracking: number; delivered: number }>();
  for (const l of loads) {
    if (!l.customer_id) continue;
    const c = counts.get(l.customer_id) ?? { tracking: 0, delivered: 0 };
    if (l.status === "delivered") c.delivered++;
    else if (new Date(l.expires_at).getTime() >= now) c.tracking++;
    counts.set(l.customer_id, c);
  }
  return counts;
}

async function CustomerList() {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const [{ data: customerData }, { data: loadData }] = await Promise.all([
    supabase.from("customers").select("id, name, share_code").order("name").returns<Customer[]>(),
    supabase.from("loads").select("customer_id, status, expires_at").limit(1000).returns<LoadRow[]>(),
  ]);
  const customers = customerData ?? [];
  const counts = countLoads(loadData ?? []);
  const origin = await linkOrigin();

  if (customers.length === 0) {
    return (
      <p className={`${ui.card} p-6 text-center text-[14px] text-muted`}>
        No customers yet. Type a customer name when you <Link href="/loads">add a load</Link> and they&apos;ll show up here with their
        own page.
      </p>
    );
  }

  // Customers with loads on the road first, then the rest, each alphabetically.
  const sorted = [...customers].sort((a, b) => Number((counts.get(b.id)?.tracking ?? 0) > 0) - Number((counts.get(a.id)?.tracking ?? 0) > 0));

  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((c) => {
        const n = counts.get(c.id) ?? { tracking: 0, delivered: 0 };
        const link = `${origin}/c/${c.share_code}`;
        return (
          <li key={c.id} className={`${ui.card} flex flex-wrap items-center justify-between gap-3 p-4`}>
            <div className="flex min-w-0 flex-col">
              <span className="text-[17px] font-black">{c.name}</span>
              <span className="text-[13px] text-muted">
                {n.tracking > 0 ? (
                  <span className="font-semibold text-ok">
                    {n.tracking} load{n.tracking === 1 ? "" : "s"} tracking
                  </span>
                ) : (
                  "No loads tracking"
                )}
                {n.delivered > 0 && ` · ${n.delivered} delivered`}
              </span>
            </div>
            <div className="flex gap-2">
              <CopyLink url={link} label="Copy link" />
              <a href={link} target="_blank" rel="noopener noreferrer" className={ui.secondary}>
                Open
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function CustomersPage() {
  return (
    <BrokerShell active="customers">
      <p className="text-[14px] text-muted">
        Each customer has one page with all their loads. Send the link once: new loads show up on it, and delivered loads stay for 24
        hours.
      </p>
      <Suspense fallback={<p className="text-[14px] text-muted">Loading your customers…</p>}>
        <CustomerList />
      </Suspense>
    </BrokerShell>
  );
}

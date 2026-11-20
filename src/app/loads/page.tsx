import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { formatDay } from "@/lib/dates";
import { linkOrigin } from "@/lib/origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BrokerShell } from "@/components/broker-shell";
import { TimeAgo } from "@/components/time-ago";
import { ui } from "@/components/ui";
import { AddLoadForm } from "./add-load-form";
import { CopyLink } from "./copy-link";
import { DeleteButton } from "./delete-button";
import { EditLoad } from "./edit-load";
import { deleteLoad, refreshNow, setDelivered } from "./actions";

export const metadata: Metadata = { title: "My loads" };
// Adding a load opens the Samsara link in a hidden browser, which can take a while.
export const maxDuration = 60;

type Row = {
  id: string;
  load_number: string;
  trailer_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  carrier_name: string | null;
  samsara_url: string;
  pickup: string | null;
  delivery: string | null;
  delivery_date: string | null;
  share_code: string;
  status: "active" | "delivered";
  expires_at: string;
  last_address: string | null;
  last_speed_mph: number | null;
  last_position_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
};

/** The page renders per request (it reads the login cookie), so checking the clock here is fine. */
function isExpired(row: Row) {
  return row.status === "active" && new Date(row.expires_at).getTime() < Date.now();
}

function Status({ row }: { row: Row }) {
  const expired = isExpired(row);
  const [label, cls] =
    row.status === "delivered"
      ? ["Delivered", "bg-surface-2 text-muted"]
      : expired
        ? ["Link expired", "bg-warn-bg text-warn"]
        : row.last_error
          ? ["Needs attention", "bg-bad-bg text-bad"]
          : ["Tracking", "bg-ok-bg text-ok"];
  return <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${cls}`}>{label}</span>;
}

function LoadCard({ row, origin }: { row: Row; origin: string }) {
  const link = `${origin}/t/${row.share_code}`;
  const active = row.status === "active";
  return (
    <li className={`${ui.card} flex flex-col gap-3 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-[17px] font-black tabular-nums">Load {row.load_number}</span>
          <span className="text-[13px] text-muted">
            {[
              row.trailer_number && `Trailer ${row.trailer_number}`,
              row.customer_name,
              row.delivery_date && `Delivery ${formatDay(row.delivery_date)}`,
            ]
              .filter(Boolean)
              .join(" · ") || "No trailer # or customer"}
          </span>
        </div>
        <Status row={row} />
      </div>

      {/* Route on the left, carrier on the right: one line, so the card stays the same height. */}
      {(row.pickup || row.delivery || row.carrier_name) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[14px]">
          {row.pickup || row.delivery ? (
            <p>
              {row.pickup || "?"} <span className="text-muted">→</span> {row.delivery || "?"}
            </p>
          ) : (
            <span />
          )}
          {row.carrier_name && (
            <p className="ml-auto">
              <span className="text-muted">Carrier </span>
              <span className="font-semibold">{row.carrier_name}</span>
            </p>
          )}
        </div>
      )}

      {active && (
        <div className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[14px]">
          {row.last_position_at ? (
            <>
              <p className="font-semibold">{row.last_address ?? "Location found"}</p>
              <p className="text-[13px] text-muted">
                {row.last_speed_mph != null && row.last_speed_mph > 2 ? `Moving, ${row.last_speed_mph} mph` : "Stopped"} · GPS{" "}
                <TimeAgo iso={row.last_position_at} />
              </p>
            </>
          ) : (
            <p className="text-muted">No location yet.</p>
          )}
          {row.last_error && <p className="mt-1 text-[13px] font-semibold text-bad">{row.last_error}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {active && <CopyLink url={link} />}
        <a href={link} target="_blank" rel="noopener noreferrer" className={ui.secondary}>
          Open customer view
        </a>
        {active && (
          <form action={refreshNow.bind(null, row.id)}>
            <button type="submit" className={ui.secondary}>Refresh</button>
          </form>
        )}
        <form action={setDelivered.bind(null, row.id, active)}>
          <button type="submit" className={ui.secondary}>{active ? "Mark delivered" : "Track again"}</button>
        </form>
        <EditLoad
          // Saved changes give it a new key, which closes the form and refills it with the new details.
          key={`${row.load_number}|${row.trailer_number}|${row.carrier_name}|${row.customer_name}|${row.pickup}|${row.delivery}|${row.delivery_date}|${row.samsara_url}`}
          load={row}
        />
        <DeleteButton action={deleteLoad.bind(null, row.id)} loadNumber={row.load_number} />
      </div>
    </li>
  );
}

async function LoadList() {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("loads")
    .select(
      "id, load_number, trailer_number, customer_id, customer_name, carrier_name, samsara_url, pickup, delivery, delivery_date, share_code, status, expires_at, last_address, last_speed_mph, last_position_at, last_checked_at, last_error",
    )
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<Row[]>();
  const rows = data ?? [];
  const { data: customerData } = await supabase.from("customers").select("id, name").order("name").returns<{ id: string; name: string }[]>();
  const customers = customerData ?? [];
  const origin = await linkOrigin();

  return (
    <>
      {/* Suggestions for the Customer box on the add and edit forms. */}
      <datalist id="customer-names">
        {customers.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      {rows.length === 0 ? (
        <p className={`${ui.card} p-6 text-center text-[14px] text-muted`}>
          No loads yet. Add one with the carrier&apos;s Samsara link to get a customer tracking link.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <LoadCard key={r.id} row={r} origin={origin} />
          ))}
        </ul>
      )}
    </>
  );
}

export default function LoadsPage() {
  return (
    <BrokerShell active="loads">
      <AddLoadForm />
      <Suspense fallback={<p className="text-[14px] text-muted">Loading your loads…</p>}>
        <LoadList />
      </Suspense>
    </BrokerShell>
  );
}

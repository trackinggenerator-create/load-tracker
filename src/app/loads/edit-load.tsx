"use client";

import { useActionState, useState } from "react";
import { updateLoad, type EditState } from "./actions";
import { ui } from "@/components/ui";

export type EditableLoad = {
  id: string;
  load_number: string;
  trailer_number: string | null;
  carrier_name: string | null;
  customer_name: string | null;
  pickup: string | null;
  delivery: string | null;
  delivery_date: string | null;
  samsara_url: string;
};

const fields = [
  { name: "load_number", label: "Load #" },
  { name: "trailer_number", label: "Trailer #" },
  { name: "carrier_name", label: "Carrier" },
  { name: "customer_name", label: "Customer" },
  { name: "pickup", label: "Pickup" },
  { name: "delivery", label: "Delivery" },
  { name: "delivery_date", label: "Delivery date (optional)", type: "date" },
] as const;

/** An Edit button that opens the load's details in place, right on its card. */
export function EditLoad({ load }: { load: EditableLoad }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<EditState, FormData>(async (prev, form) => {
    const result = await updateLoad(load.id, prev, form);
    if (result.status === "ok" && !result.message) setOpen(false);
    return result;
  }, { status: "idle" });

  if (!open) {
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className={ui.secondary}>
          Edit
        </button>
        {state.status === "ok" && state.message && <p className={`${ui.alert} w-full`}>{state.message}</p>}
      </>
    );
  }

  return (
    <form action={action} className="flex w-full flex-col gap-3 rounded-[10px] border border-line bg-surface-2 p-3" noValidate>
      {state.status !== "idle" && state.message && (
        <p role="alert" className={state.status === "error" ? ui.alert : ui.ok}>
          {state.message}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <label htmlFor={`${f.name}-${load.id}`} className={ui.label}>{f.label}</label>
            <input
              id={`${f.name}-${load.id}`}
              name={f.name}
              type={"type" in f ? f.type : undefined}
              defaultValue={load[f.name] ?? ""}
              list={f.name === "customer_name" ? "customer-names" : undefined}
              autoComplete={f.name === "customer_name" ? "off" : undefined}
              className={ui.input}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`samsara_url-${load.id}`} className={ui.label}>Carrier&apos;s Samsara link</label>
        <input id={`samsara_url-${load.id}`} name="samsara_url" type="url" inputMode="url" defaultValue={load.samsara_url} className={ui.input} />
        <span className="text-[13px] text-muted">Change this only if the carrier sent a new link. The customer link stays the same.</span>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={`${ui.primary} flex-1`}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={ui.secondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}

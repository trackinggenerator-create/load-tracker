"use client";

import { useActionState, useState } from "react";
import { addLoad, type AddState } from "./actions";
import { ui } from "@/components/ui";

const fields = [
  { name: "load_number", label: "Load #", placeholder: "e.g. 4518823", required: true },
  { name: "trailer_number", label: "Trailer #", placeholder: "e.g. 53112" },
  { name: "carrier_name", label: "Carrier", placeholder: "Only you see this, never the customer" },
  { name: "customer_name", label: "Customer", placeholder: "Pick or type. Same customer = one shared page" },
  { name: "pickup", label: "Pickup", placeholder: "City, ST" },
  { name: "delivery", label: "Delivery", placeholder: "City, ST" },
  { name: "delivery_date", label: "Delivery date", placeholder: "", type: "date" },
] as const;

export function AddLoadForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AddState, FormData>(addLoad, { status: "idle" });
  const v = state.status === "error" ? state.values ?? {} : {};

  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        {state.status === "ok" && <p className={ui.ok}>{state.message}</p>}
        <button type="button" onClick={() => setOpen(true)} className={ui.primary}>
          + Add a load
        </button>
      </div>
    );
  }

  return (
    <form
      // A new key after each saved load clears the fields for the next one.
      key={state.status === "ok" ? state.message : "form"}
      action={action}
      className={`${ui.card} flex flex-col gap-4 p-4`}
      noValidate
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-bold">New load</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-[14px] font-semibold text-muted">
          Cancel
        </button>
      </div>
      {state.status === "error" && <p role="alert" className={ui.alert}>{state.message}</p>}
      {state.status === "ok" && <p className={ui.ok}>{state.message}</p>}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="samsara_url" className={ui.label}>Carrier&apos;s tracking link (Samsara or Monarch)</label>
        <input
          id="samsara_url"
          name="samsara_url"
          type="url"
          inputMode="url"
          placeholder="Paste the Samsara or Monarch link"
          defaultValue={v.samsara_url ?? ""}
          className={ui.input}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <label htmlFor={f.name} className={ui.label}>
              {f.label}
              {"required" in f ? "" : <span className="font-normal text-muted"> (optional)</span>}
            </label>
            <input
              id={f.name}
              name={f.name}
              type={"type" in f ? f.type : undefined}
              placeholder={f.placeholder || undefined}
              defaultValue={v[f.name] ?? ""}
              // Suggests customers you've used before (the list is on the My loads page).
              list={f.name === "customer_name" ? "customer-names" : undefined}
              autoComplete={f.name === "customer_name" ? "off" : undefined}
              className={ui.input}
            />
          </div>
        ))}
      </div>
      <button type="submit" disabled={pending} className={ui.primary}>
        {pending ? "Checking the tracking link…" : "Add load and make customer link"}
      </button>
    </form>
  );
}

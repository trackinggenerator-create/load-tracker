"use client";

import { useActionState, useState } from "react";
import { saveCompanyName, type NameState } from "@/app/settings/actions";

/** The company name in the dashboard header, with a small pencil to rename it in place. */
export function CompanyNameEditor({ name }: { name: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<NameState, FormData>(async (prev, form) => {
    const result = await saveCompanyName(prev, form);
    if (result.status === "ok") setEditing(false);
    return result;
  }, { status: "idle" });

  if (!editing) {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate font-black">{name}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Change company name"
          title="Change company name"
          className="grid h-8 w-8 flex-none place-items-center rounded-lg opacity-70 hover:bg-white/10 hover:opacity-100"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </button>
      </span>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <label htmlFor="company_name" className="text-[12px] font-semibold opacity-80">
        Company name customers see
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="company_name"
          name="company_name"
          defaultValue={name}
          maxLength={80}
          autoFocus
          className="min-h-10 w-[min(16rem,60vw)] rounded-lg border border-white/30 bg-white/10 px-2.5 text-[16px] text-on-header placeholder:text-on-header/60 focus:outline-2 focus:outline-white/40"
        />
        <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-white px-3 text-[14px] font-bold text-header disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="min-h-10 px-1 text-[14px] font-semibold opacity-80">
          Cancel
        </button>
      </div>
      {state.status === "error" && (
        <span role="alert" className="text-[13px] font-semibold text-[#ffb4ab]">
          {state.message}
        </span>
      )}
    </form>
  );
}

import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

/** The customer-facing header and footer, branded with the broker's company name. */
export function TrackingFrame({ company, footerNote, children }: { company: string | null; footerNote?: string; children: ReactNode }) {
  return (
    <>
      <header className="bg-header text-on-header">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
          <span className="min-w-0 truncate text-[17px] font-black tracking-tight">{company ?? " "}</span>
          <span className="flex flex-none items-center gap-3">
            {/* The label hides on narrow phones to make room for the light/dark button. */}
            <span className="hidden text-[12px] font-semibold tracking-wide uppercase opacity-75 min-[400px]:inline">Shipment tracking</span>
            <ThemeToggle />
          </span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">{children}</main>
      <footer className="mx-auto w-full max-w-3xl px-4 pb-6 text-[12px] text-muted">
        {company ? `Tracking provided by ${company}. ` : ""}Locations update every few minutes.{footerNote ? ` ${footerNote}` : ""}
      </footer>
    </>
  );
}

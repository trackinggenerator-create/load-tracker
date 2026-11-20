import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { companyNameFor } from "@/lib/company";
import { signOut } from "@/app/login/actions";
import { CompanyNameEditor } from "./company-name-editor";

/** Company name (with its rename pencil) and the signed-in username. */
async function Who() {
  const user = await requireUser();
  const name = await companyNameFor(user.id);
  return (
    <>
      <CompanyNameEditor key={name} name={name} />
      <span className="truncate text-[13px] opacity-80">{user.username}</span>
    </>
  );
}

const tabs = [
  { href: "/loads", label: "My loads", key: "loads" },
  { href: "/customers", label: "My customers", key: "customers" },
] as const;

/** Header, log out and the My loads / My customers tabs shared by the broker pages. */
export function BrokerShell({ active, children }: { active: (typeof tabs)[number]["key"]; children: ReactNode }) {
  return (
    <>
      <header className="bg-header text-on-header">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <Suspense
              fallback={
                <>
                  <span className="font-black">&nbsp;</span>
                  <span className="text-[13px] opacity-80">&nbsp;</span>
                </>
              }
            >
              <Who />
            </Suspense>
          </div>
          <form action={signOut}>
            <button type="submit" className="min-h-11 rounded-[10px] border border-white/30 px-3 text-[14px] font-semibold">
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
        <nav aria-label="Sections" className="flex gap-6 border-b border-line">
          {tabs.map((t) => {
            const on = t.key === active;
            return (
              <Link
                key={t.key}
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`-mb-px flex min-h-12 items-center border-b-[3px] text-[20px] font-black no-underline ${
                  on ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </main>
    </>
  );
}

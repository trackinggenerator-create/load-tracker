"use client";

import { ui } from "@/components/ui";

/** Delete with a "are you sure?" that says exactly what happens. */
export function DeleteCustomerButton({ action, name, loadCount }: { action: () => Promise<void>; name: string; loadCount: number }) {
  const loads =
    loadCount === 0
      ? ""
      : ` Their ${loadCount} load${loadCount === 1 ? "" : "s"} stay${loadCount === 1 ? "s" : ""} in My loads without a customer.`;
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Delete ${name}? Their customer page link will stop working.${loads}`)) e.preventDefault();
      }}
    >
      <button type="submit" className={`${ui.secondary} text-bad`}>
        Delete
      </button>
    </form>
  );
}

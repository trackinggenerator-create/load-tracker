"use client";

import { ui } from "@/components/ui";

export function DeleteButton({ action, loadNumber }: { action: () => Promise<void>; loadNumber: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Delete load ${loadNumber}? Its customer link will stop working.`)) e.preventDefault();
      }}
    >
      <button type="submit" className={`${ui.secondary} text-bad`}>Delete</button>
    </form>
  );
}

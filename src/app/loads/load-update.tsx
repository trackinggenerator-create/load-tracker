"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { UpdateBar, useRefetchWhenDue, type PushResult } from "@/components/tracking/update-bar";
import { refreshNow } from "./actions";

/**
 * Push update for one load card (no limit for the broker): a short countdown, then the card redraws
 * with the new location on its own. Behind the scenes it also picks up the automatic 5–10 minute updates.
 */
export function LoadUpdate({ id, code, nextUpdateAt }: { id: string; code: string; nextUpdateAt: string }) {
  const router = useRouter();

  const refetch = useCallback(async () => {
    try {
      await fetch(`/api/t/${code}`, { cache: "no-store" });
    } catch {
      // Offline for a moment; the next try picks it up.
    }
    router.refresh();
  }, [code, router]);
  useRefetchWhenDue(nextUpdateAt, refetch);

  async function push(): Promise<PushResult> {
    const r = await refreshNow(id);
    if (r.error) {
      router.refresh(); // show the problem on the card
      return { show: () => {}, error: r.error };
    }
    return { show: () => router.refresh() };
  }

  return <UpdateBar tone="button" push={push} />;
}

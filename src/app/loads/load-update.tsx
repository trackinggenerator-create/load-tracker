"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UpdateBar, useRefetchWhenDue } from "@/components/tracking/update-bar";
import { refreshNow } from "./actions";

/**
 * The broker's countdown and Push update for one load card. When the countdown ends it asks for
 * the new location (same as a customer's page would) and redraws the card. Push update has no limit.
 */
export function LoadUpdate({ id, code, nextUpdateAt }: { id: string; code: string; nextUpdateAt: string }) {
  const router = useRouter();
  const [pushing, startPush] = useTransition();

  const refetch = useCallback(async () => {
    try {
      await fetch(`/api/t/${code}`, { cache: "no-store" });
    } catch {
      // Offline for a moment; the next try picks it up.
    }
    router.refresh();
  }, [code, router]);
  useRefetchWhenDue(nextUpdateAt, refetch);

  return <UpdateBar tone="plain" nextUpdateAt={nextUpdateAt} onPush={() => startPush(() => refreshNow(id))} pushing={pushing} />;
}

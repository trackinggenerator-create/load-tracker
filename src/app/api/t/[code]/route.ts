import { after, NextResponse } from "next/server";
import { getPublicLoad, refreshLoad } from "@/lib/tracking";

// Reading the tracking link opens a hidden browser after the answer is sent, which can take a while.
export const maxDuration = 60;

/** Latest safe tracking data for a customer link. Polled by the tracking page. */
export async function GET(_req: Request, { params }: RouteContext<"/api/t/[code]">) {
  const { code } = await params;
  const found = await getPublicLoad(code);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Answer right away with what we have, then fetch a newer position for the next poll.
  if (found.stale) after(() => refreshLoad(found.id));

  return NextResponse.json(found.load, { headers: { "Cache-Control": "no-store" } });
}

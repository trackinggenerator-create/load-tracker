import { after, NextResponse } from "next/server";
import { getPublicLoad, pushPublicLoad, refreshLoad } from "@/lib/tracking";

// Reading the tracking link opens a hidden browser, which can take a while.
export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store" };

/** Latest safe tracking data for a customer link. Polled by the tracking pages. */
export async function GET(_req: Request, { params }: RouteContext<"/api/t/[code]">) {
  const { code } = await params;
  const found = await getPublicLoad(code);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });

  // Answer right away with what we have, then fetch a newer position for the next poll.
  if (found.stale) after(() => refreshLoad(found.id));

  return NextResponse.json(found.load, { headers: noStore });
}

/**
 * Push update: reads the truck's position now and answers with it (a few seconds).
 * Limited to once every 2 minutes per load, so a customer can't hammer the carrier's page.
 */
export async function POST(_req: Request, { params }: RouteContext<"/api/t/[code]">) {
  const { code } = await params;
  const result = await pushPublicLoad(code);
  if (!result) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
  return NextResponse.json(result, { headers: noStore });
}

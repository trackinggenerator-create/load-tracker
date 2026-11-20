import { after, NextResponse } from "next/server";
import { getPublicCustomer, refreshLoadsInTurn } from "@/lib/tracking";

export const maxDuration = 60;

/** Latest safe tracking data for every load on a customer's page. Polled by that page. */
export async function GET(_req: Request, { params }: RouteContext<"/api/c/[code]">) {
  const { code } = await params;
  const found = await getPublicCustomer(code);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (found.staleIds.length) after(() => refreshLoadsInTurn(found.staleIds));
  return NextResponse.json({ loads: found.loads }, { headers: { "Cache-Control": "no-store" } });
}

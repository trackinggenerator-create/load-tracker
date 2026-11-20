import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readSamsaraLink, SamsaraError } from "@/lib/samsara";

/**
 * Samsara is read again a random 5 to 10 minutes after the last read, and only while someone has a
 * tracking page open. The gap is picked from the load's id and the last read time, so it's the same
 * for every visitor (no extra database column needed) but different every time.
 */
const MIN_GAP_MS = 5 * 60 * 1000;
const MAX_GAP_MS = 10 * 60 * 1000;

function hashToUnit(text: string): number {
  // FNV-1a: turns the text into a steady number between 0 and 1.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

export function nextCheckAt(id: string, checkedAt: string | null): number {
  if (!checkedAt) return 0;
  return new Date(checkedAt).getTime() + MIN_GAP_MS + hashToUnit(`${id}|${checkedAt}`) * (MAX_GAP_MS - MIN_GAP_MS);
}

/** What a customer is allowed to see. No carrier, no driver, no speed, no Samsara link. */
export type PublicLoad = {
  /** The load's own tracking code: a stable key for lists. */
  key: string;
  loadNumber: string;
  trailerNumber: string | null;
  pickup: string | null;
  delivery: string | null;
  /** The day it's due to deliver, like "2026-11-22", if the broker set one. */
  deliveryDate: string | null;
  status: "active" | "delivered" | "expired";
  position: { lat: number; lng: number; heading: number | null; moving: boolean; address: string | null; at: string } | null;
  destination: { name: string | null; address: string | null; lat: number | null; lng: number | null } | null;
  checkedAt: string | null;
  deliveredAt: string | null;
};

type LoadRow = {
  id: string;
  share_code: string;
  delivered_at: string | null;
  delivery_date: string | null;
  load_number: string;
  trailer_number: string | null;
  pickup: string | null;
  delivery: string | null;
  samsara_url: string;
  status: "active" | "delivered";
  expires_at: string;
  last_lat: number | null;
  last_lng: number | null;
  last_heading: number | null;
  last_speed_mph: number | null;
  last_address: string | null;
  last_position_at: string | null;
  dest_name: string | null;
  dest_address: string | null;
  dest_lat: number | null;
  dest_lng: number | null;
  last_checked_at: string | null;
};

const COLUMNS =
  "id, share_code, delivered_at, delivery_date, load_number, trailer_number, pickup, delivery, samsara_url, status, expires_at, last_lat, last_lng, last_heading, last_speed_mph, last_address, last_position_at, dest_name, dest_address, dest_lat, dest_lng, last_checked_at";

function toPublic(row: LoadRow): PublicLoad {
  const expired = row.status === "active" && new Date(row.expires_at).getTime() < Date.now();
  const status = expired ? "expired" : row.status;
  const live = status === "active";
  return {
    key: row.share_code,
    loadNumber: row.load_number,
    trailerNumber: row.trailer_number,
    pickup: row.pickup,
    delivery: row.delivery,
    deliveryDate: row.delivery_date,
    status,
    // Once delivered or expired, the customer no longer sees where the truck is.
    position:
      live && row.last_lat != null && row.last_lng != null && row.last_position_at
        ? {
            lat: row.last_lat,
            lng: row.last_lng,
            heading: row.last_heading,
            // Only moving or stopped: the actual speed stays with the broker.
            moving: row.last_speed_mph != null && row.last_speed_mph > 2,
            address: row.last_address,
            at: row.last_position_at,
          }
        : null,
    destination:
      live && (row.dest_name || row.dest_address)
        ? { name: row.dest_name, address: row.dest_address, lat: row.dest_lat, lng: row.dest_lng }
        : null,
    checkedAt: row.last_checked_at,
    deliveredAt: status === "delivered" ? row.delivered_at : null,
  };
}

export function isStale(id: string, checkedAt: string | null): boolean {
  return Date.now() >= nextCheckAt(id, checkedAt);
}

/** Looks up a load by its customer link code. Returns null for codes that don't exist. */
export async function getPublicLoad(code: string): Promise<{ id: string; load: PublicLoad; stale: boolean } | null> {
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(code)) return null;
  const db = createSupabaseAdminClient();
  const { data } = await db.from("loads").select(COLUMNS).eq("share_code", code).maybeSingle<LoadRow>();
  if (!data) return null;
  const load = toPublic(data);
  return { id: data.id, load, stale: load.status === "active" && isStale(data.id, data.last_checked_at) };
}

/** Delivered loads stay on a customer's page for this long, marked Delivered, then drop off. */
const DELIVERED_SHOWN_MS = 24 * 60 * 60 * 1000;
/** At most this many Samsara reads per visit, one after another; the rest wait for the next visit. */
const MAX_READS_PER_VISIT = 4;

/**
 * Looks up a customer's page by its code: all their tracking loads, plus loads delivered in the last
 * 24 hours. Returns null for codes that don't exist. Never returns the customer's name, which is the
 * broker's own label.
 */
export async function getPublicCustomer(code: string): Promise<{ loads: PublicLoad[]; staleIds: string[] } | null> {
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(code)) return null;
  const db = createSupabaseAdminClient();
  const { data: customer } = await db.from("customers").select("id").eq("share_code", code).maybeSingle<{ id: string }>();
  if (!customer) return null;

  const deliveredSince = new Date(Date.now() - DELIVERED_SHOWN_MS).toISOString();
  const { data } = await db
    .from("loads")
    .select(COLUMNS)
    .eq("customer_id", customer.id)
    .or(`status.eq.active,delivered_at.gte."${deliveredSince}"`)
    .order("created_at", { ascending: true })
    .limit(100)
    .returns<LoadRow[]>();
  const rows = data ?? [];

  const loads = rows.map(toPublic).filter((l) => l.status !== "expired");
  // Tracking first (in the order they were added), delivered at the bottom.
  loads.sort((a, b) => Number(a.status === "delivered") - Number(b.status === "delivered"));
  const staleIds = rows
    .filter((r) => r.status === "active" && new Date(r.expires_at).getTime() >= Date.now() && isStale(r.id, r.last_checked_at))
    .map((r) => r.id)
    .slice(0, MAX_READS_PER_VISIT);
  return { loads, staleIds };
}

/** Reads several loads one at a time, so a customer with many loads doesn't open many browsers at once. */
export async function refreshLoadsInTurn(ids: string[]): Promise<void> {
  for (const id of ids) await refreshLoad(id);
}

/**
 * Opens the load's Samsara link and saves the new position.
 * Unless `force` is set (the broker's Refresh button), it waits for the random 5 to 10 minute gap,
 * and marks the load as being checked first so two visitors at once don't both open Samsara.
 */
export async function refreshLoad(id: string, { force = false } = {}): Promise<{ ok: boolean; error?: string }> {
  const db = createSupabaseAdminClient();
  const now = new Date().toISOString();
  let claim = db.from("loads").update({ last_checked_at: now }).eq("id", id).eq("status", "active");
  if (!force) {
    const { data: current } = await db.from("loads").select("last_checked_at").eq("id", id).maybeSingle<{ last_checked_at: string | null }>();
    if (!current || !isStale(id, current.last_checked_at)) return { ok: true };
    // Only claim it if nobody else has checked it since we looked.
    claim = current.last_checked_at ? claim.eq("last_checked_at", current.last_checked_at) : claim.is("last_checked_at", null);
  }
  const { data: claimed } = await claim.select("samsara_url").maybeSingle<{ samsara_url: string }>();
  if (!claimed) return { ok: true }; // Someone else just checked it, or it's no longer active.

  try {
    const r = await readSamsaraLink(claimed.samsara_url);
    await db
      .from("loads")
      .update({
        last_lat: r.lat,
        last_lng: r.lng,
        last_heading: r.heading,
        last_speed_mph: r.speedMph,
        last_address: r.address,
        last_position_at: r.positionAt,
        dest_name: r.destination?.name ?? null,
        dest_address: r.destination?.address ?? null,
        dest_lat: r.destination?.lat ?? null,
        dest_lng: r.destination?.lng ?? null,
        last_checked_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", id);
    return { ok: true };
  } catch (e) {
    const message = e instanceof SamsaraError ? e.message : "Couldn't read the Samsara link. Try again in a minute.";
    if (!(e instanceof SamsaraError)) console.error("Samsara read failed", e);
    await db.from("loads").update({ last_error: message }).eq("id", id);
    return { ok: false, error: message };
  }
}

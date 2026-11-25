"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { normalizeTrackingLink } from "@/lib/trackers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { refreshLoad } from "@/lib/tracking";

export type AddState = { status: "idle" | "error" | "ok"; message?: string; values?: Record<string, string> };

const text = (f: FormData, k: string, max: number) => {
  const v = f.get(k);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

function readValues(form: FormData) {
  return {
    load_number: text(form, "load_number", 40).toUpperCase(),
    trailer_number: text(form, "trailer_number", 40).toUpperCase(),
    carrier_name: text(form, "carrier_name", 80),
    customer_name: text(form, "customer_name", 80),
    pickup: text(form, "pickup", 120),
    delivery: text(form, "delivery", 120),
    delivery_date: text(form, "delivery_date", 10),
    samsara_url: text(form, "samsara_url", 300),
  };
}

/** A real calendar day like "2026-11-22", or null when left blank. False if it isn't a valid date. */
function parseDay(day: string): string | null | false {
  if (!day) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(`${day}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day ? day : false;
}

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Finds the broker's customer with this name ("xyz foods" matches "XYZ Foods"), or creates it.
 * Returns null for a blank name. Loads with the same customer share one customer page.
 */
async function resolveCustomer(supabase: Db, name: string): Promise<{ id: string; name: string } | null> {
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const find = async () => {
    const { data } = await supabase.from("customers").select("id, name").limit(1000);
    return (data ?? []).find((c) => c.name.toLowerCase() === clean.toLowerCase()) ?? null;
  };
  const existing = await find();
  if (existing) return existing;
  const { data, error } = await supabase.from("customers").insert({ name: clean }).select("id, name").single();
  if (data) return data;
  if (error?.code === "23505") return find(); // Created a moment ago by another save.
  throw new Error(`Couldn't save customer: ${error?.message}`);
}

export type EditState = { status: "idle" | "error" | "ok"; message?: string };

/** Saves changes to a load's details. A new tracking link is read right away. */
export async function updateLoad(id: string, _prev: EditState, form: FormData): Promise<EditState> {
  await requireUser();
  const values = readValues(form);
  if (!values.load_number) return { status: "error", message: "Enter the load number." };
  const link = normalizeTrackingLink(values.samsara_url);
  if (!link) return { status: "error", message: "That isn't a Samsara or Monarch tracking link." };
  const deliveryDate = parseDay(values.delivery_date);
  if (deliveryDate === false) return { status: "error", message: "Pick a valid delivery date, or leave it blank." };

  // Row Level Security only lets brokers read and change their own loads.
  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("loads").select("samsara_url").eq("id", id).maybeSingle<{ samsara_url: string }>();
  if (!before) return { status: "error", message: "That load wasn't found." };
  const linkChanged = before.samsara_url !== link;
  let customer: Awaited<ReturnType<typeof resolveCustomer>>;
  try {
    customer = await resolveCustomer(supabase, values.customer_name);
  } catch (e) {
    console.error(e);
    return { status: "error", message: "Couldn't save the customer. Try again." };
  }

  const { error } = await supabase
    .from("loads")
    .update({
      load_number: values.load_number,
      trailer_number: values.trailer_number || null,
      carrier_name: values.carrier_name || null,
      customer_id: customer?.id ?? null,
      customer_name: customer?.name ?? null,
      pickup: values.pickup || null,
      delivery: values.delivery || null,
      delivery_date: deliveryDate,
      samsara_url: link,
      // A different truck: forget the old position so the customer never sees the wrong one.
      ...(linkChanged
        ? { last_lat: null, last_lng: null, last_heading: null, last_speed_mph: null, last_address: null, last_position_at: null, last_error: null }
        : {}),
    })
    .eq("id", id);
  if (error) {
    console.error("Update load failed", error);
    return { status: "error", message: "Couldn't save the changes. Try again." };
  }

  if (linkChanged) {
    const result = await refreshLoad(id, { force: true });
    refresh();
    return result.ok ? { status: "ok" } : { status: "ok", message: `Saved, but: ${result.error}` };
  }
  refresh();
  return { status: "ok" };
}

export async function addLoad(_prev: AddState, form: FormData): Promise<AddState> {
  await requireUser();
  const values = readValues(form);
  if (!values.load_number) return { status: "error", message: "Enter the load number.", values };
  const link = normalizeTrackingLink(values.samsara_url);
  if (!link) {
    return { status: "error", message: "Paste the carrier's Samsara or Monarch tracking link.", values };
  }
  const deliveryDate = parseDay(values.delivery_date);
  if (deliveryDate === false) return { status: "error", message: "Pick a valid delivery date, or leave it blank.", values };

  const supabase = await createSupabaseServerClient();
  let customer: Awaited<ReturnType<typeof resolveCustomer>>;
  try {
    customer = await resolveCustomer(supabase, values.customer_name);
  } catch (e) {
    console.error(e);
    return { status: "error", message: "Couldn't save the customer. Try again.", values };
  }
  const { data, error } = await supabase
    .from("loads")
    .insert({
      load_number: values.load_number,
      trailer_number: values.trailer_number || null,
      carrier_name: values.carrier_name || null,
      customer_id: customer?.id ?? null,
      customer_name: customer?.name ?? null,
      pickup: values.pickup || null,
      delivery: values.delivery || null,
      delivery_date: deliveryDate,
      samsara_url: link,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("Add load failed", error);
    return { status: "error", message: "Couldn't save the load. Try again.", values };
  }

  // Read the link right away so you know it works before sending it to the customer.
  const result = await refreshLoad(data.id, { force: true });
  refresh();
  return result.ok
    ? {
        status: "ok",
        message: customer
          ? `Load ${values.load_number} added. It's also on ${customer.name}'s customer page.`
          : `Load ${values.load_number} added. Its customer link is ready below.`,
      }
    : { status: "ok", message: `Load ${values.load_number} saved, but: ${result.error}` };
}

/** Makes sure the load belongs to the signed-in broker (Row Level Security hides everyone else's). */
async function ownLoad(id: string) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("loads").select("id").eq("id", id).maybeSingle();
  return data ? supabase : null;
}

/**
 * The broker's Push update: reads the load's tracking link now (no limit). The card isn't redrawn
 * here; the countdown redraws it when it ends, so the new location shows right on time.
 */
export async function refreshNow(id: string): Promise<{ error?: string }> {
  if (!(await ownLoad(id))) return { error: "That load wasn't found." };
  const result = await refreshLoad(id, { force: true });
  return result.ok ? {} : { error: result.error };
}

export async function setDelivered(id: string, delivered: boolean) {
  const supabase = await ownLoad(id);
  if (!supabase) return;
  const update = delivered
    ? { status: "delivered", delivered_at: new Date().toISOString() }
    : { status: "active", delivered_at: null, expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString() };
  await supabase.from("loads").update(update).eq("id", id);
  refresh();
}

export async function deleteLoad(id: string) {
  const supabase = await ownLoad(id);
  if (!supabase) return;
  await supabase.from("loads").delete().eq("id", id);
  refresh();
}

"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Deletes one of the broker's customers. Their customer page link stops working. Their loads stay
 * in My loads, just without a customer (each load's own link keeps working).
 * Row Level Security only lets brokers touch their own customers and loads.
 */
export async function deleteCustomer(id: string) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: customer } = await supabase.from("customers").select("id").eq("id", id).maybeSingle();
  if (!customer) return;

  // Clear the name on their loads too, so editing a load later doesn't quietly bring the customer back.
  await supabase.from("loads").update({ customer_id: null, customer_name: null }).eq("customer_id", id);
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) console.error("Delete customer failed", error);
  refresh();
}

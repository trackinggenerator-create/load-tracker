"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NameState = { status: "idle" | "error" | "ok"; message?: string };

/** Saves the company name shown on the broker's dashboard and on every one of their customer pages. */
export async function saveCompanyName(_prev: NameState, form: FormData): Promise<NameState> {
  const user = await requireUser();
  const raw = form.get("company_name");
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!name) return { status: "error", message: "Enter a company name." };
  if (name.length > 80) return { status: "error", message: "Keep it under 80 characters." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("broker_settings")
    .upsert({ owner_id: user.id, company_name: name, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
  if (error) {
    console.error("Save company name failed", error);
    return { status: "error", message: "Couldn't save the name. Try again." };
  }
  refresh();
  return { status: "ok" };
}

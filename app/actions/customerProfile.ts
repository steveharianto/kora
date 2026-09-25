"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomer } from "./customerAuth";
import { revalidatePath } from "next/cache";

/* ── Update profile ──────────────────────────────────────────────── */

export async function updateCustomerProfile(formData: {
  firstName: string;
  lastName?: string;
  dob?: string;
  phone: string;
}) {
  const session = await getCurrentCustomer();
  if (!session) return { error: "Unauthorized." };

  if (!formData.firstName?.trim()) return { error: "First name is required." };
  if (!formData.phone?.trim()) return { error: "WhatsApp number is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      first_name: formData.firstName.trim(),
      last_name: formData.lastName?.trim() || null,
      dob: formData.dob || null,
      phone: formData.phone.trim(),
    })
    .eq("id", session.id);

  if (error) return { error: error.message };

  revalidatePath("/account");
  return { success: true };
}

/* ── Addresses ───────────────────────────────────────────────────── */

export async function saveCustomerAddress(data: {
  id?: number;
  label?: string;
  street_address: string;
  city: string;
  postal_code?: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default?: boolean;
}) {
  const session = await getCurrentCustomer();
  if (!session) return { error: "Unauthorized." };

  if (!data.street_address?.trim() || !data.city?.trim()) {
    return { error: "Street and city are required." };
  }

  const supabase = await createClient();

  // If this will become the default, unset all others first.
  if (data.is_default) {
    await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("customer_id", session.id);
  }

  const payload = {
    customer_id: session.id,
    label: data.label?.trim() || "Home",
    street_address: data.street_address.trim(),
    city: data.city.trim(),
    postal_code: data.postal_code?.trim() || null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    is_default: data.is_default ?? false,
  };

  if (data.id) {
    const { error } = await supabase
      .from("addresses")
      .update(payload)
      .eq("id", data.id)
      .eq("customer_id", session.id);
    if (error) return { error: error.message };
  } else {
    // First address is always default
    const { count } = await supabase
      .from("addresses")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", session.id);
    if (count === 0) payload.is_default = true;

    const { error } = await supabase.from("addresses").insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath("/account");
  return { success: true };
}

export async function deleteCustomerAddress(addressId: number) {
  const session = await getCurrentCustomer();
  if (!session) return { error: "Unauthorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("addresses")
    .delete()
    .eq("id", addressId)
    .eq("customer_id", session.id);

  if (error) return { error: error.message };

  revalidatePath("/account");
  return { success: true };
}

export async function setDefaultCustomerAddress(addressId: number) {
  const session = await getCurrentCustomer();
  if (!session) return { error: "Unauthorized." };

  const supabase = await createClient();

  await supabase
    .from("addresses")
    .update({ is_default: false })
    .eq("customer_id", session.id);

  const { error } = await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", addressId)
    .eq("customer_id", session.id);

  if (error) return { error: error.message };

  revalidatePath("/account");
  return { success: true };
}

/* ── KTP upload ──────────────────────────────────────────────────── */
export async function uploadCustomerKtp(input: {
  photoUrl: string;
  photoPath: string;
}) {
  const session = await getCurrentCustomer();
  if (!session) return { error: "Unauthorized." };

  if (!input.photoUrl || !input.photoPath) {
    return { error: "Missing KTP file details." };
  }

  const supabase = await createClient();

  // Look up the previous KTP so we can clean up its storage object.
  const { data: prev } = await supabase
    .from("ktp_logs")
    .select("photo_path")
    .eq("customer_id", session.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: logErr } = await supabase.from("ktp_logs").insert({
    customer_id: session.id,
    photo_url: input.photoUrl,
    photo_path: input.photoPath,
    status: "KTP Pending",
    description: "Uploaded by customer via storefront",
  });

  if (logErr) return { error: logErr.message };

  const { error: upErr } = await supabase
    .from("customers")
    .update({ status: "KTP Pending" })
    .eq("id", session.id);

  if (upErr) return { error: upErr.message };

  // Best-effort: drop the previous file so we don't accumulate private data.
  if (prev?.photo_path && prev.photo_path !== input.photoPath) {
    await supabase.storage.from("ktp-photos").remove([prev.photo_path]);
  }

  revalidatePath("/account");
  return { success: true };
}

/* ── Delete account ──────────────────────────────────────────────── */

export async function deleteCustomerAccount() {
  const session = await getCurrentCustomer();
  if (!session) return { error: "Unauthorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", session.id);
  if (error) {
    return {
      error:
        "This account cannot be deleted because it has existing order history. Please contact us to deactivate it.",
    };
  }

  return { success: true };
}

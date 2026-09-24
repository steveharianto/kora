"use server";

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";

export interface CustomerSession {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string;
  status: string;
  currentCredit: number;
  dateJoined: string | null;
}

const SESSION_COOKIE = "kora_customer_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/* ── Login ───────────────────────────────────────────────────────── */

export async function loginCustomer(formData: { email: string; password: string }) {
  const supabase = await createClient();
  const email = formData.email.trim().toLowerCase();
  const password = formData.password;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email, phone, status, current_credit, date_joined, password")
    .ilike("email", email)
    .maybeSingle();

  if (error) {
    console.error("Login query error:", error.message);
    return { error: "Something went wrong. Please try again." };
  }

  if (!customer || !customer.password) {
    // Same generic message for both "no customer" and "no password set" to
    // avoid leaking which emails exist in the system.
    return { error: "Invalid email or password." };
  }

  const valid = await bcrypt.compare(password, customer.password);
  if (!valid) {
    return { error: "Invalid email or password." };
  }

  if (customer.status === "Inactive") {
    return { error: "This account has been deactivated. Please contact us." };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE,
    JSON.stringify({ id: customer.id }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    },
  );

  return { success: true };
}

/* ── Register ────────────────────────────────────────────────────── */

export async function registerCustomer(formData: {
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  password: string;
}) {
  const supabase = await createClient();
  const email = formData.email.trim().toLowerCase();
  const phone = formData.phone.trim();

  if (!formData.firstName?.trim()) return { error: "First name is required." };
  if (!email) return { error: "Email is required." };
  if (!phone) return { error: "WhatsApp number is required." };
  if (!formData.password || formData.password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  // Reject duplicate email
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    return { error: "An account with this email already exists. Please sign in." };
  }

  const hashedPassword = await bcrypt.hash(formData.password, 10);

  const { data: created, error } = await supabase
    .from("customers")
    .insert({
      first_name: formData.firstName.trim(),
      last_name: formData.lastName?.trim() || null,
      email,
      phone,
      password: hashedPassword,
      status: "Not Submitted",
      current_credit: 0,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("Register error:", error?.message);
    return { error: "Could not create account. Please try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE,
    JSON.stringify({ id: created.id }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    },
  );

  return { success: true };
}

/* ── Logout ──────────────────────────────────────────────────────── */

export async function logoutCustomer() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return { success: true };
}

/* ── Session reader ──────────────────────────────────────────────── */

export async function getCurrentCustomer(): Promise<CustomerSession | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE);
  if (!cookie?.value) return null;

  let parsed: { id?: string };
  try {
    parsed = JSON.parse(cookie.value);
  } catch {
    return null;
  }
  if (!parsed?.id) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email, phone, status, current_credit, date_joined")
    .eq("id", parsed.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    phone: data.phone,
    status: data.status,
    currentCredit: Number(data.current_credit) || 0,
    dateJoined: data.date_joined,
  };
}

/* ── Change password (authenticated) ─────────────────────────────── */

export async function changeCustomerPassword(formData: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const session = await getCurrentCustomer();
  if (!session) return { error: "Unauthorized." };

  const { currentPassword, newPassword, confirmPassword } = formData;
  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required." };
  }
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match." };
  }
  if (currentPassword === newPassword) {
    return { error: "New password must be different from the current one." };
  }

  const supabase = await createClient();
  const { data: record } = await supabase
    .from("customers")
    .select("password")
    .eq("id", session.id)
    .single();

  if (!record?.password) {
    return { error: "No password is set on this account." };
  }

  const valid = await bcrypt.compare(currentPassword, record.password);
  if (!valid) return { error: "Current password is incorrect." };

  const hashed = await bcrypt.hash(newPassword, 10);
  const { error: upErr } = await supabase
    .from("customers")
    .update({ password: hashed })
    .eq("id", session.id);

  if (upErr) return { error: upErr.message };

  return { success: true };
}

/* ── Password reset request ──────────────────────────────────────── */

export async function requestPasswordReset(email: string) {
  const clean = email.trim().toLowerCase();
  if (!clean) return { error: "Email is required." };

  // TODO: wire up an email provider (Resend / SendGrid / Postmark).
  // For now we always return success so we don't leak which emails exist.
  const supabase = await createClient();
  await supabase
    .from("customers")
    .select("id")
    .ilike("email", clean)
    .maybeSingle();

  return { success: true };
}

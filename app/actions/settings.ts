"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "./auth";
import { revalidatePath, revalidateTag } from "next/cache";
import bcrypt from "bcryptjs";

function isSuperAdmin(role?: string): boolean {
  return role?.toLowerCase().replace(/[\s_-]+/g, "") === "superadmin";
}

export async function saveAppSetting(key: string, value: any) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  if (!isSuperAdmin(admin.role)) {
    return {
      error: "Unauthorized: Only Superadmins can change system settings.",
    };
  }

  const { error } = await supabase.from("app_settings").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: admin.id,
  });

  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "setting",
    entity_id: key,
    action_type: "UPDATE_SETTING",
    field_name: key,
    details: value,
  });

  revalidatePath("/admin/settings");
  revalidateTag("settings");
  // Rental rules also feed the storefront terms + how-to-rent pages.
  if (key === "rental_rules") revalidateTag("rental-rules");
  return { success: true };
}

export async function saveDepositTiers(
  tiers: { id?: number; price_up_to: number; deposit_value: number }[],
) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin || !isSuperAdmin(admin.role)) {
    return {
      error: "Unauthorized: Only Superadmins can update deposit tiers.",
    };
  }

  for (const tier of tiers) {
    if (tier.id) {
      await supabase
        .from("deposit_tiers")
        .update({
          price_up_to: tier.price_up_to,
          deposit_value: tier.deposit_value,
        })
        .eq("id", tier.id);
    } else {
      await supabase.from("deposit_tiers").insert({
        price_up_to: tier.price_up_to,
        deposit_value: tier.deposit_value,
      });
    }
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/inventory");
  revalidateTag("settings");
  revalidateTag("deposit-tiers");
  return { success: true };
}

export async function createAdminUser(formData: {
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin || !isSuperAdmin(admin.role)) {
    return { error: "Unauthorized: Only Superadmins can create system users." };
  }

  if (!formData.name || !formData.email || !formData.password) {
    return { error: "Name, email, and password are required." };
  }

  const hashedPassword = await bcrypt.hash(formData.password, 10);

  const { data, error } = await supabase
    .from("admins")
    .insert({
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      password: hashedPassword,
      role: formData.role || "staff",
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "admin",
    entity_id: data.id,
    action_type: "CREATE_ADMIN",
    field_name: "all",
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function updateAdminRole(adminId: string, role: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin || !isSuperAdmin(admin.role)) {
    return { error: "Unauthorized: Only Superadmins can change user roles." };
  }

  if (admin.id === adminId && role !== "superadmin") {
    return { error: "You cannot demote your own account from Super Admin." };
  }

  const { error } = await supabase
    .from("admins")
    .update({ role })
    .eq("id", adminId);

  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "admin",
    entity_id: adminId,
    action_type: "UPDATE_ROLE",
    field_name: "role",
    new_value: role,
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function toggleAdminStatus(
  adminId: string,
  currentStatus: boolean,
) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin || !isSuperAdmin(admin.role)) {
    return { error: "Unauthorized: Only Superadmins can deactivate users." };
  }

  if (admin.id === adminId) {
    return { error: "You cannot deactivate your own account." };
  }

  const { error } = await supabase
    .from("admins")
    .update({ is_active: !currentStatus })
    .eq("id", adminId);

  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function deleteAdminUser(adminId: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin || !isSuperAdmin(admin.role)) {
    return { error: "Unauthorized: Only Superadmins can delete users." };
  }

  if (admin.id === adminId) {
    return { error: "You cannot delete your own account." };
  }

  const { error } = await supabase.from("admins").delete().eq("id", adminId);
  if (error) return { error: error.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "admin",
    entity_id: adminId,
    action_type: "DELETE_ADMIN",
    field_name: "all",
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function changeOwnPassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  const { currentPassword, newPassword, confirmPassword } = payload;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All three fields are required." };
  }
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation do not match." };
  }
  if (currentPassword === newPassword) {
    return { error: "New password must be different from the current one." };
  }

  const { data: record, error: fetchErr } = await supabase
    .from("admins")
    .select("password")
    .eq("id", admin.id)
    .single();

  if (fetchErr || !record) {
    return { error: fetchErr?.message || "Admin record not found." };
  }

  const isValid = await bcrypt.compare(currentPassword, record.password);
  if (!isValid) {
    return { error: "Current password is incorrect." };
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  const { error: updateErr } = await supabase
    .from("admins")
    .update({ password: hashed })
    .eq("id", admin.id);

  if (updateErr) return { error: updateErr.message };

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "admin",
    entity_id: admin.id,
    action_type: "CHANGE_OWN_PASSWORD",
    field_name: "password",
  });

  return { success: true };
}

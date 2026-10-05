"use client";

import { createClient } from "@/lib/supabase/client";

const BUCKET = "ktp-photos";
const SIGNED_URL_TTL_S = 60 * 60 * 24 * 365; // 1 year — Supabase signed-URL max
const MAX_SIZE_MB = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export const KTP_MAX_SIZE_MB = MAX_SIZE_MB;
export const KTP_ACCEPTED_TYPES = ACCEPTED_TYPES;

export interface KtpUploadResult {
  photoUrl: string;
  photoPath: string;
}

/**
 * Uploads a KTP image blob to Supabase Storage and returns a long-lived
 * signed URL + the storage path. Shared by the customer-facing ID modal,
 * the in-app camera capture, and the admin "on behalf" capture modal so
 * the upload contract never drifts.
 */
export async function uploadKtpFile(
  file: Blob,
  filename: string,
): Promise<KtpUploadResult | { error: string }> {
  if (!file || file.size === 0) {
    return { error: "The file is empty. Please try again." };
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return { error: `File is too large. Maximum size is ${MAX_SIZE_MB}MB.` };
  }
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
    return { error: "Please use a JPG, PNG, or WebP image." };
  }

  const supabase = createClient();
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const path = `ktp/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

  if (upErr) return { error: upErr.message };

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_S);

  if (signErr || !signed?.signedUrl) {
    return {
      error: signErr?.message || "Could not sign the uploaded file.",
    };
  }

  return { photoUrl: signed.signedUrl, photoPath: path };
}

/**
 * Best-effort removal of an orphaned KTP upload (e.g. when a customer
 * retakes a photo, or an admin closes the modal without saving). Failures
 * are swallowed — an orphaned file is not a user-facing problem.
 */
export async function removeKtpFile(path: string): Promise<void> {
  if (!path) return;
  try {
    const supabase = createClient();
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // ignore
  }
}

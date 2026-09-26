// lib/fonnte.ts
// Fonnte WhatsApp gateway — https://fonnte.com
//
// All sends go through sendFonnteMessage(). It never throws: it returns
// { success, id?, error?, code?, raw? } so callers can decide whether to
// surface or swallow the failure.
//
// IMPORTANT — Fonnte's attachment contract:
//   • `file` requires a REAL multipart/form-data upload with the raw bytes.
//     Using FormData + Blob in Node.js often produces a body that Fonnte's
//     parser silently ignores — the API returns success but no file arrives.
//     We therefore build the multipart body manually with explicit boundaries.
//   • `url` only works for publicly-fetchable URLs. Signed Supabase URLs
//     (with query-param auth) are dropped by Fonnte's fetcher.
//   • `filename` must be sent as a separate form field for file type.

const FONNTE_API = "https://api.fonnte.com/send";

export type FonnteErrorCode =
  | "invalid_token"
  | "quota_exhausted"
  | "target_not_registered"
  | "network"
  | "rate_limited"
  | "attachment_fetch_failed"
  | "unknown";

export interface FonnteAttachment {
  /** Raw base64 of the file bytes. Preferred — no server fetch needed. */
  base64?: string;
  /** Publicly-fetchable URL. Only reliable for public buckets. */
  url?: string;
  /** Display filename on the WhatsApp document bubble. */
  filename: string;
  /** MIME type. Defaults to application/pdf. */
  mimeType?: string;
}

export interface FonnteSendInput {
  target: string;
  message: string;
  countryCode?: string;
  attachment?: FonnteAttachment | null;
}

export interface FonnteResult {
  success: boolean;
  id?: string;
  error?: string;
  code?: FonnteErrorCode;
  raw?: unknown;
}

/* ── Env resolver ────────────────────────────────────────────────── */

function readFonnteToken(): string {
  const raw = process.env.FONNTE_TOKEN;
  if (!raw) return "";
  return raw.replace(/^["']|["']$/g, "").trim();
}

/* ── Phone normalization ────────────────────────────────────────── */

export function normalizePhone(raw: string, defaultCountryCode = "62"): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return defaultCountryCode + digits.slice(1);
  return digits;
}

/* ── Error classifier ───────────────────────────────────────────── */

function classifyError(
  rawReason: string,
  httpStatus: number,
): { code: FonnteErrorCode; message: string } {
  const reason = (rawReason || "").toLowerCase();

  if (
    reason.includes("device") &&
    (reason.includes("disconnect") || reason.includes("not connect"))
  ) {
    return {
      code: "invalid_token",
      message:
        "Fonnte device is disconnected. Reconnect WhatsApp from the Fonnte dashboard (Device tab).",
    };
  }

  if (
    reason.includes("token") ||
    reason.includes("unauthorized") ||
    httpStatus === 401 ||
    httpStatus === 403
  ) {
    return {
      code: "invalid_token",
      message:
        "Fonnte rejected the token. Open /api/debug/fonnte to see the raw response.",
    };
  }

  if (reason.includes("quota") || reason.includes("limit")) {
    return {
      code: "quota_exhausted",
      message: "Fonnte quota exhausted. Top up your Fonnte balance.",
    };
  }

  if (
    reason.includes("file") ||
    reason.includes("attachment") ||
    reason.includes("download") ||
    reason.includes("multipart")
  ) {
    return {
      code: "attachment_fetch_failed",
      message: `Fonnte rejected the attachment: ${rawReason}`,
    };
  }

  if (
    reason.includes("not registered") ||
    reason.includes("not on whatsapp") ||
    reason.includes("invalid number") ||
    reason.includes("not found")
  ) {
    return {
      code: "target_not_registered",
      message:
        "This number is not registered on WhatsApp. Confirm the customer's phone.",
    };
  }

  if (httpStatus === 429) {
    return {
      code: "rate_limited",
      message: "Fonnte rate limit hit. Wait a moment and try again.",
    };
  }

  return {
    code: "unknown",
    message: rawReason || `Fonnte HTTP ${httpStatus}`,
  };
}

/* ── Manual multipart builder ────────────────────────────────────── */

/**
 * Builds a multipart/form-data body from explicit field values and an
 * optional binary file. Returns the concatenated Buffer and the boundary
 * string so the caller can set the Content-Type header correctly.
 *
 * This bypasses FormData/Blob quirks in Node.js — undici's FormData sometimes
 * produces a body Fonnte's parser doesn't recognize.
 */
function buildMultipartBody(
  fields: Record<string, string>,
  file?: {
    fieldName: string;
    filename: string;
    contentType: string;
    data: Buffer;
  } | null,
): { body: Buffer; boundary: string } {
  const boundary = `----KORAFonnteBoundary${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
          `${value}\r\n`,
        "utf8",
      ),
    );
  }

  if (file) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\n` +
          `Content-Type: ${file.contentType}\r\n\r\n`,
        "utf8",
      ),
    );
    chunks.push(file.data);
    chunks.push(Buffer.from("\r\n", "utf8"));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));

  return { body: Buffer.concat(chunks), boundary };
}

/* ── Send ───────────────────────────────────────────────────────── */

export async function sendFonnteMessage(
  input: FonnteSendInput,
): Promise<FonnteResult> {
  const token = readFonnteToken();

  if (!token) {
    return {
      success: false,
      code: "invalid_token",
      error:
        "FONNTE_TOKEN is not configured. Add it to .env.local and restart the dev server.",
    };
  }

  const target = normalizePhone(input.target, input.countryCode || "62");
  if (!target) {
    return {
      success: false,
      code: "target_not_registered",
      error: "No valid phone number.",
    };
  }

  // Assemble form fields.
  const fields: Record<string, string> = {
    target,
    message: input.message,
    countryCode: input.countryCode || "62",
  };

  let attachmentMode: "base64" | "url" | "none" = "none";
  let filePart:
    | {
        fieldName: string;
        filename: string;
        contentType: string;
        data: Buffer;
      }
    | null = null;

  if (input.attachment?.base64) {
    const bytes = Buffer.from(input.attachment.base64, "base64");
    filePart = {
      fieldName: "file",
      filename: input.attachment.filename,
      contentType: input.attachment.mimeType || "application/pdf",
      data: bytes,
    };
    // Fonnte accepts filename as a separate field for non-image types.
    fields.filename = input.attachment.filename;
    attachmentMode = "base64";
  } else if (input.attachment?.url) {
    fields.url = input.attachment.url;
    fields.filename = input.attachment.filename;
    attachmentMode = "url";
  }

  const { body, boundary } = buildMultipartBody(fields, filePart);

  if (process.env.NODE_ENV !== "production") {
    console.log("[Fonnte] request", {
      mode: attachmentMode,
      filename: input.attachment?.filename,
      fileBytes: filePart?.data.length,
      bodyBytes: body.length,
      boundary,
    });
  }

  try {
    const res = await fetch(FONNTE_API, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body: new Uint8Array(body),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, any>;

    if (process.env.NODE_ENV !== "production") {
      console.log("[Fonnte] response", {
        httpStatus: res.status,
        ok: res.ok,
        status: data.status,
        id: data.id,
        detail: data.detail,
        reason: data.reason,
        hasAttachment: attachmentMode !== "none",
        attachmentMode,
      });
    }

    if (!res.ok || data.status === false) {
      const rawReason =
        data.reason || data.detail || data.message || `HTTP ${res.status}`;
      const { code, message } = classifyError(String(rawReason), res.status);
      return { success: false, code, error: message, raw: data };
    }

    return {
      success: true,
      id: Array.isArray(data.id)
        ? String(data.id[0])
        : data.id
          ? String(data.id)
          : undefined,
      raw: data,
    };
  } catch (err: any) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Fonnte] network error", err);
    }
    return {
      success: false,
      code: "network",
      error: err?.message || "Network error contacting Fonnte.",
    };
  }
}

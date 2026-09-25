// lib/fonnte.ts
// Fonnte WhatsApp gateway — https://fonnte.com
//
// All sends go through sendFonnteMessage(). It never throws: it returns
// { success, id?, error? } so callers can decide whether to surface or swallow.

const FONNTE_API = "https://api.fonnte.com/send";

export interface FonnteSendInput {
  target: string; // raw phone (0…, 62…, +62…) — normalized below
  message: string;
  countryCode?: string; // defaults to '62' (Indonesia)
}

export interface FonnteResult {
  success: boolean;
  id?: string;
  error?: string;
  raw?: unknown;
}

/** 08xx / +62xx / 62xx → 62xxxx ; unknown formats pass through stripped. */
export function normalizePhone(raw: string, defaultCountryCode = "62"): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return defaultCountryCode + digits.slice(1);
  return digits;
}

export async function sendFonnteMessage(
  input: FonnteSendInput,
): Promise<FonnteResult> {
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    return { success: false, error: "FONNTE_TOKEN is not configured." };
  }

  const target = normalizePhone(input.target, input.countryCode || "62");
  if (!target) return { success: false, error: "No valid phone number." };

  try {
    const body = new URLSearchParams();
    body.append("target", target);
    body.append("message", input.message);
    body.append("countryCode", input.countryCode || "62");

    const res = await fetch(FONNTE_API, {
      method: "POST",
      headers: { Authorization: token },
      body,
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, any>;

    if (!res.ok || data.status === false) {
      return {
        success: false,
        error:
          data.reason ||
          data.detail ||
          data.message ||
          `Fonnte HTTP ${res.status}`,
        raw: data,
      };
    }

    return {
      success: true,
      id: Array.isArray(data.id) ? String(data.id[0]) : data.id ? String(data.id) : undefined,
      raw: data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Network error contacting Fonnte.",
    };
  }
}

// lib/fonnte.ts
// Fonnte WhatsApp gateway — https://fonnte.com
//
// All sends go through sendFonnteMessage(). It never throws: it returns
// { success, id?, error?, code? } so callers can decide whether to surface
// or swallow the failure.

const FONNTE_API = 'https://api.fonnte.com/send';

export type FonnteErrorCode =
  | 'invalid_token'
  | 'quota_exhausted'
  | 'target_not_registered'
  | 'network'
  | 'rate_limited'
  | 'unknown';

export interface FonnteSendInput {
  target: string; // raw phone (0…, 62…, +62…) — normalized below
  message: string;
  countryCode?: string; // defaults to '62' (Indonesia)
}

export interface FonnteResult {
  success: boolean;
  id?: string;
  error?: string;
  code?: FonnteErrorCode;
  raw?: unknown;
}

/** 08xx / +62xx / 62xx → 62xxxx ; unknown formats pass through stripped. */
export function normalizePhone(raw: string, defaultCountryCode = '62'): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return defaultCountryCode + digits.slice(1);
  return digits;
}

function classifyError(
  rawReason: string,
  httpStatus: number,
): { code: FonnteErrorCode; message: string } {
  const reason = (rawReason || '').toLowerCase();

  if (
    reason.includes('token') ||
    reason.includes('unauthorized') ||
    httpStatus === 401 ||
    httpStatus === 403
  ) {
    return {
      code: 'invalid_token',
      message:
        'Fonnte rejected the token. Check FONNTE_TOKEN in your environment.',
    };
  }

  if (reason.includes('quota') || reason.includes('limit')) {
    return {
      code: 'quota_exhausted',
      message: 'Fonnte quota exhausted. Top up your Fonnte balance.',
    };
  }

  if (
    reason.includes('not registered') ||
    reason.includes('not on whatsapp') ||
    reason.includes('invalid number') ||
    reason.includes('not found')
  ) {
    return {
      code: 'target_not_registered',
      message:
        'This number is not registered on WhatsApp. Confirm the customer’s phone.',
    };
  }

  if (httpStatus === 429) {
    return {
      code: 'rate_limited',
      message: 'Fonnte rate limit hit. Wait a moment and try again.',
    };
  }

  return {
    code: 'unknown',
    message: rawReason || `Fonnte HTTP ${httpStatus}`,
  };
}

export async function sendFonnteMessage(
  input: FonnteSendInput,
): Promise<FonnteResult> {
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    return {
      success: false,
      code: 'invalid_token',
      error: 'FONNTE_TOKEN is not configured.',
    };
  }

  const target = normalizePhone(input.target, input.countryCode || '62');
  if (!target) {
    return {
      success: false,
      code: 'target_not_registered',
      error: 'No valid phone number.',
    };
  }

  try {
    const body = new URLSearchParams();
    body.append('target', target);
    body.append('message', input.message);
    body.append('countryCode', input.countryCode || '62');

    const res = await fetch(FONNTE_API, {
      method: 'POST',
      headers: { Authorization: token },
      body,
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, any>;

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
    return {
      success: false,
      code: 'network',
      error: err?.message || 'Network error contacting Fonnte.',
    };
  }
}

// app/api/debug/fonnte/route.ts
//
// Diagnostic endpoint for Fonnte. Visit /api/debug/fonnte in your browser
// while the dev server is running. It shows:
//   • whether the token env var is present
//   • the exact token bytes (length + tail) so you can spot whitespace
//   • the RAW response from Fonnte's /send endpoint
//
// DELETE THIS FILE BEFORE DEPLOYING TO PRODUCTION.

import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/app/actions/auth';

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized — sign in as admin first.' }, { status: 401 });
  }

  const raw = process.env.FONNTE_TOKEN;
  const trimmed = (raw ?? '').trim();

  const diagnosis = {
    envVarPresent: raw !== undefined && raw !== '',
    rawLength: (raw ?? '').length,
    trimmedLength: trimmed.length,
    /** Last 6 chars — enough to eyeball-match the dashboard, safe to log. */
    tail: trimmed.slice(-6),
    /** First 6 chars — helps confirm it's not a NEXT_PUBLIC_ typo. */
    head: trimmed.slice(0, 6),
    hasLeadingWhitespace: raw !== raw?.trimStart(),
    hasTrailingWhitespace: raw !== raw?.trimEnd(),
    hasQuotes: /^["'].*["']$/.test(raw ?? ''),
    hasNewline: /\n|\r/.test(raw ?? ''),
  };

  // Try the actual send with a dummy phone number — we WANT it to fail at
  // the "invalid number" stage, which proves the token is accepted.
  let fonnteRaw: any = null;
  let fonnteHttpStatus: number | null = null;
  let fonnteError: string | null = null;

  if (trimmed) {
    try {
      const body = new URLSearchParams();
      body.append('target', '62000000000'); // dummy
      body.append('message', 'KORA debug ping — safe to ignore');

      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: trimmed },
        body,
      });

      fonnteHttpStatus = res.status;
      fonnteRaw = await res.json().catch(() => ({ _parse_error: 'non-JSON response' }));
    } catch (e: any) {
      fonnteError = e?.message || 'network error';
    }
  }

  return NextResponse.json(
    {
      diagnosis,
      fonnteRequest: {
        url: 'https://api.fonnte.com/send',
        headerName: 'Authorization',
        headerValueShape: trimmed ? `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}` : '(empty)',
      },
      fonnteResponse: {
        httpStatus: fonnteHttpStatus,
        error: fonnteError,
        body: fonnteRaw,
      },
      hint:
        fonnteHttpStatus === 401 || fonnteRaw?.detail?.toLowerCase?.().includes('token')
          ? 'Token rejected by Fonnte. Compare diagnosis.tail against the dashboard. If they match, your device may be disconnected on Fonnte — reconnect WhatsApp in the Device tab.'
          : 'Token reached Fonnte. If body contains a different error (e.g. "number not found"), the auth is fine and this endpoint is working — the real issue is the target phone.',
    },
    { status: 200 },
  );
}

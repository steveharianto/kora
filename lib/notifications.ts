// lib/notifications.ts
import { createClient } from '@/lib/supabase/server';
import { markNotification } from './orderLifecycle';
import { sendFonnteMessage, normalizePhone } from './fonnte';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface EmitWaInput {
  entity: 'order' | 'return' | 'fitting' | 'customer';
  entityId: string;
  /** Matches the notification template key in app_settings.notifications */
  kind: string;
  vars: Record<string, string>;
  to: string;
  fallbackTemplate?: string;
}

export interface EmitWaResult {
  /** Deep-link an admin can open to send manually if the auto-send fails. */
  waUrl: string;
  /** True when Fonnte accepted the send. */
  sent: boolean;
  /** Populated when sent === false. */
  error?: string;
  /** Fully rendered message that was dispatched. */
  renderedMessage: string;
}

export interface LastSentInfo {
  at: string;
  sent: boolean;
  error?: string;
  waUrl?: string;
}

/* ── Template rendering ──────────────────────────────────────────── */

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\[${k}\\]`, 'g'), v);
  }
  return out;
}

async function resolveTemplate(
  supabase: SupabaseClient,
  kind: string,
  fallback?: string,
): Promise<string> {
  const { data: settings } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'notifications')
    .single();

  const stored = settings?.value?.[kind]?.template as string | undefined;
  const template = stored || fallback || '';
  if (!template) {
    throw new Error(`No template for notification kind "${kind}".`);
  }
  return template;
}

/* ── Preview (no send) ───────────────────────────────────────────── */

export async function renderWa(
  supabase: SupabaseClient,
  input: {
    kind: string;
    vars: Record<string, string>;
    to?: string | null;
    fallbackTemplate?: string;
  },
): Promise<{ text: string; waUrl: string | null }> {
  const template = await resolveTemplate(
    supabase,
    input.kind,
    input.fallbackTemplate,
  );
  const text = renderTemplate(template, input.vars);
  const phone = input.to ? normalizePhone(input.to) : '';
  const waUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : null;
  return { text, waUrl };
}

/* ── Emit (send via Fonnte + audit log) ──────────────────────────── */

export async function emitWa(
  supabase: SupabaseClient,
  admin: { id: string; name: string; role: string } | null,
  input: EmitWaInput,
): Promise<EmitWaResult> {
  if (!input.to) throw new Error('Cannot emit WA: no phone number.');

  const template = await resolveTemplate(
    supabase,
    input.kind,
    input.fallbackTemplate,
  );
  const rendered = renderTemplate(template, input.vars);

  const phone = normalizePhone(input.to);
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(rendered)}`;

  // Attempt Fonnte delivery. Never throws — always returns a result object.
  const sendRes = await sendFonnteMessage({ target: phone, message: rendered });

  // Log the attempt (sent or failed) into the audit trail so the
  // "WA Sent" badges and lastSentMap() keep working unchanged.
  await markNotification(supabase, admin, input.entity, input.entityId, input.kind, {
    waUrl,
    sent: sendRes.success,
    error: sendRes.error,
    fonnteId: sendRes.id,
  });

  return {
    waUrl,
    sent: sendRes.success,
    error: sendRes.error,
    renderedMessage: rendered,
  };
}

/* ── Last-sent lookup (drives UI badges) ─────────────────────────── */

/**
 * Returns a map of { kind → lastSentInfo } for the given entity + kinds.
 * Uses admin_audit_logs (action_type = 'WA_DISPATCHED', field_name = kind).
 * The most recent row per kind wins.
 */
export async function lastSentMap(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  kinds: string[],
): Promise<Record<string, LastSentInfo>> {
  if (kinds.length === 0) return {};

  const { data } = await supabase
    .from('admin_audit_logs')
    .select('field_name, new_value, details, created_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('action_type', 'WA_DISPATCHED')
    .in('field_name', kinds)
    .order('created_at', { ascending: false });

  const map: Record<string, LastSentInfo> = {};
  for (const row of data || []) {
    // First hit per kind wins (results already sorted DESC).
    if (!map[row.field_name]) {
      const details = (row.details || {}) as any;
      map[row.field_name] = {
        at: row.created_at,
        sent: row.new_value === 'sent',
        error: details.error,
        waUrl: details.waUrl,
      };
    }
  }
  return map;
}

export async function lastSentInfo(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  kind: string,
): Promise<LastSentInfo | null> {
  const map = await lastSentMap(supabase, entityType, entityId, [kind]);
  return map[kind] ?? null;
}

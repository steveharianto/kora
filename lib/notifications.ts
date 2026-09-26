// lib/notifications.ts
import { createClient } from '@/lib/supabase/server';
import { markNotification } from './orderLifecycle';
import { sendFonnteMessage, normalizePhone } from './fonnte';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface EmitWaInput {
  entity: 'order' | 'return' | 'fitting' | 'customer';
  entityId: string;
  kind: string;
  vars: Record<string, string>;
  to: string;
  fallbackTemplate?: string;
  /**
   * Optional file to attach. Pass `base64` (preferred) or `url` (fallback).
   * Fonnte silently drops attachments fetched from signed URLs — always
   * pass base64 when you have the bytes in memory.
   */
  attachment?: {
    base64?: string;
    url?: string;
    filename: string;
  } | null;
}

export interface EmitWaResult {
  waUrl: string;
  sent: boolean;
  error?: string;
  renderedMessage: string;
  /** True when an attachment was passed (not a guarantee it was delivered). */
  attachmentAttempted?: boolean;
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

  const sendRes = await sendFonnteMessage({
    target: phone,
    message: rendered,
    attachment: input.attachment ?? null,
  });

  await markNotification(supabase, admin, input.entity, input.entityId, input.kind, {
    waUrl,
    sent: sendRes.success,
    error: sendRes.error,
    fonnteId: sendRes.id,
    // Audit trail stores url + filename (never the raw base64 — bloat).
    attachment: input.attachment
      ? {
          url: input.attachment.url ?? null,
          filename: input.attachment.filename,
          mode: input.attachment.base64 ? 'base64' : 'url',
        }
      : null,
  });

  return {
    waUrl,
    sent: sendRes.success,
    error: sendRes.error,
    renderedMessage: rendered,
    attachmentAttempted: Boolean(input.attachment),
  };
}

/* ── Last-sent lookup (drives UI badges) ─────────────────────────── */

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

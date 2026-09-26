// app/actions/notifications.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from './auth';
import { emitWa, renderTemplate } from '@/lib/notifications';
import { lastSentMap } from '@/lib/notifications';
import {
  getDef,
  defsForEntity,
  type Entity,
} from '@/lib/notifications/registry';
import { normalizePhone } from '@/lib/fonnte';
import { revalidatePath } from 'next/cache';

/* ── Types shared with the client picker ─────────────────────────── */

export interface NotificationListItem {
  kind: string;
  label: string;
  description?: string;
  autoTriggered: boolean;
  requiresReasonInput: boolean;
  lastSentAt: string | null;
  lastSentStatus: 'sent' | 'failed' | null;
  lastSentError: string | null;
}

export interface NotificationPreview {
  kind: string;
  /** Normalized destination phone, or null when missing. */
  to: string | null;
  text: string;
  /** Manual fallback link (wa.me). Null when no phone. */
  waUrl: string | null;
  /** Required vars that couldn't be resolved from the entity. */
  missing: { key: string; label: string }[];
  lastSentAt: string | null;
  lastSentStatus: 'sent' | 'failed' | null;
  error?: string;
}

export interface SendResult {
  sent: boolean;
  waUrl: string | null;
  error?: string;
}

/* ── List ─────────────────────────────────────────────────────────── */

export async function listNotificationsForEntity(
  entity: Entity,
  entityId: string,
): Promise<{ items: NotificationListItem[]; error?: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { items: [], error: 'Unauthorized' };

  const defs = defsForEntity(entity);
  const supabase = await createClient();
  const sent = await lastSentMap(
    supabase,
    entity,
    entityId,
    defs.map((d) => d.kind),
  );

  return {
    items: defs.map((d) => {
      const info = sent[d.kind];
      return {
        kind: d.kind,
        label: d.label,
        description: d.description,
        autoTriggered: Boolean(d.autoTriggered),
        requiresReasonInput: Boolean(d.requiresReasonInput),
        lastSentAt: info?.at ?? null,
        lastSentStatus: info ? (info.sent ? 'sent' : 'failed') : null,
        lastSentError: info?.error ?? null,
      };
    }),
  };
}

/* ── Entity context fetchers ─────────────────────────────────────── */

async function fetchEntityContext(
  entity: Entity,
  entityId: string,
): Promise<Record<string, any>> {
  const supabase = await createClient();

  if (entity === 'order') {
    const { data } = await supabase
      .from('orders')
      .select(
        `
        id, total, total_deposit, packing_slip_id, return_label_url,
        customers ( first_name, last_name, phone )
      `,
      )
      .eq('id', entityId)
      .maybeSingle();
    return { order: data };
  }

  if (entity === 'return') {
    const { data } = await supabase
      .from('returns')
      .select(
        `
        id, order_id,
        has_stains, has_damage, is_incomplete, has_odor,
        refund_amount, deposit_held,
        orders ( id, return_date ),
        customers ( first_name, last_name, phone )
      `,
      )
      .eq('id', entityId)
      .maybeSingle();
    return { return: data };
  }

  if (entity === 'fitting') {
    const { data } = await supabase
      .from('fittings')
      .select(
        `
        id, date, slot,
        customers ( first_name, last_name, phone )
      `,
      )
      .eq('id', entityId)
      .maybeSingle();
    return { fitting: data };
  }

  if (entity === 'customer') {
    const { data } = await supabase
      .from('customers')
      .select('id, first_name, last_name, phone')
      .eq('id', entityId)
      .maybeSingle();
    return { customer: data };
  }

  return {};
}

function getPhoneForEntity(entity: Entity, ctx: any): string | null {
  if (entity === 'order') return ctx.order?.customers?.phone ?? null;
  if (entity === 'return') return ctx.return?.customers?.phone ?? null;
  if (entity === 'fitting') return ctx.fitting?.customers?.phone ?? null;
  if (entity === 'customer') return ctx.customer?.phone ?? null;
  return null;
}

/* ── Shared var resolution ───────────────────────────────────────── */

interface ResolvedVars {
  vars: Record<string, string>;
  missing: { key: string; label: string }[];
  to: string | null;
}

function resolveVars(
  def: ReturnType<typeof getDef>,
  ctx: any,
  rawPhone: string | null,
): ResolvedVars {
  const vars: Record<string, string> = {};
  const missing: { key: string; label: string }[] = [];

  if (!def) return { vars, missing, to: null };

  for (const v of def.vars) {
    const value = v.compute(ctx);
    if (value === null || value === undefined || value === '') {
      if (v.required) missing.push({ key: v.key, label: v.label });
      vars[v.key] = '';
    } else {
      vars[v.key] = String(value);
    }
  }

  const to = rawPhone ? normalizePhone(rawPhone) : null;
  return { vars, missing, to };
}

/* ── Preview ─────────────────────────────────────────────────────── */

export async function previewNotification(
  entity: Entity,
  entityId: string,
  kind: string,
  overrides: Record<string, string> = {},
): Promise<NotificationPreview> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return emptyPreview(kind, 'Unauthorized');
  }

  const def = getDef(kind);
  if (!def) {
    return emptyPreview(kind, `Unknown notification "${kind}"`);
  }

  const ctx = await fetchEntityContext(entity, entityId);
  (ctx as any).overrides = overrides;

  const rawPhone = getPhoneForEntity(entity, ctx);
  const { vars, missing, to } = resolveVars(def, ctx, rawPhone);

  const supabase = await createClient();

  // Pull the effective template (settings override or fallback).
  const { data: settings } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'notifications')
    .single();

  const template =
    (settings?.value?.[kind]?.template as string | undefined) ||
    def.fallbackTemplate;

  const text = renderTemplate(template, vars);
  const waUrl = to
    ? `https://wa.me/${to}?text=${encodeURIComponent(text)}`
    : null;

  const sentMap = await lastSentMap(supabase, entity, entityId, [kind]);
  const info = sentMap[kind];

  return {
    kind,
    to,
    text,
    waUrl,
    missing,
    lastSentAt: info?.at ?? null,
    lastSentStatus: info ? (info.sent ? 'sent' : 'failed') : null,
  };
}

function emptyPreview(kind: string, error: string): NotificationPreview {
  return {
    kind,
    to: null,
    text: '',
    waUrl: null,
    missing: [],
    lastSentAt: null,
    lastSentStatus: null,
    error,
  };
}

/* ── Send ────────────────────────────────────────────────────────── */

export async function sendNotificationNow(
  entity: Entity,
  entityId: string,
  kind: string,
  overrides: Record<string, string> = {},
): Promise<SendResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { sent: false, waUrl: null, error: 'Unauthorized' };

  const def = getDef(kind);
  if (!def) return { sent: false, waUrl: null, error: `Unknown notification "${kind}"` };

  const ctx = await fetchEntityContext(entity, entityId);
  (ctx as any).overrides = overrides;

  const rawPhone = getPhoneForEntity(entity, ctx);
  if (!rawPhone) {
    return { sent: false, waUrl: null, error: 'Customer has no phone number on file.' };
  }

  const { vars, missing } = resolveVars(def, ctx, rawPhone);
  if (missing.length > 0) {
    return {
      sent: false,
      waUrl: null,
      error: `Missing required field(s): ${missing.map((m) => m.label).join(', ')}.`,
    };
  }

  const supabase = await createClient();

  let result: SendResult;
  try {
    const res = await emitWa(supabase, admin, {
      entity,
      entityId,
      kind,
      to: rawPhone,
      vars,
      fallbackTemplate: def.fallbackTemplate,
    });
    result = { sent: res.sent, waUrl: res.waUrl, error: res.error };
  } catch (e: any) {
    result = { sent: false, waUrl: null, error: e?.message || 'Send failed.' };
  }

  // Preserve the original fitting-reminder side effect: timestamp
  // reminder_sent_at so the "REMINDER DUE" badge clears.
  if (entity === 'fitting' && kind === 'fitting_reminder') {
    await supabase
      .from('fittings')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', entityId);
  }

  // Best-effort cache invalidation for detail / list pages.
  if (entity === 'order') {
    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${entityId}`);
  } else if (entity === 'fitting') {
    revalidatePath('/admin/fittings');
    revalidatePath(`/admin/fittings/${entityId}`);
  } else if (entity === 'return') {
    revalidatePath('/admin/returns');
    revalidatePath(`/admin/returns/${entityId}`);
  } else if (entity === 'customer') {
    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/${entityId}`);
  }

  return result;
}

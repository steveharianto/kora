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
  waUrl: string;   // manual fallback link for the admin UI
  sent: boolean;   // true when Fonnte accepted the send
  error?: string;  // populated when sent === false
}

export async function emitWa(
  supabase: SupabaseClient,
  admin: { id: string; name: string; role: string } | null,
  input: EmitWaInput,
): Promise<EmitWaResult> {
  if (!input.to) throw new Error('Cannot emit WA: no phone number.');

  const { data: settings } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'notifications')
    .single();

  const stored = settings?.value?.[input.kind]?.template as string | undefined;
  const template = stored || input.fallbackTemplate || '';
  if (!template) throw new Error(`No template for notification kind "${input.kind}".`);

  let rendered = template;
  for (const [k, v] of Object.entries(input.vars)) {
    rendered = rendered.replace(new RegExp(`\\[${k}\\]`, 'g'), v);
  }

  const phone = normalizePhone(input.to);
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(rendered)}`;

  // Attempt Fonnte delivery. Never throws — always returns a result object.
  const sendRes = await sendFonnteMessage({ target: phone, message: rendered });

  // Log the attempt (sent or failed) into the audit trail so OrderForm's
  // "WA Sent" badge and hasNotification() keep working unchanged.
  await markNotification(supabase, admin, input.entity, input.entityId, input.kind, {
    waUrl,
    sent: sendRes.success,
    error: sendRes.error,
    fonnteId: sendRes.id,
  });

  return { waUrl, sent: sendRes.success, error: sendRes.error };
}

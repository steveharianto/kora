import { createClient } from '@/lib/supabase/server';
import { markNotification } from './orderLifecycle';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface EmitWaInput {
  entity: 'order' | 'return' | 'fitting';
  entityId: string;
  kind: string; // matches notification template key + audit field_name
  vars: Record<string, string>;
  to: string; // raw phone
  fallbackTemplate?: string;
}

export interface EmitWaResult {
  waUrl: string;
}

function normalizePhone(raw: string): string {
  let p = String(raw || '').replace(/\D/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  return p;
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

  const stored = settings?.value?.[input.kind]?.template;
  const template = stored || input.fallbackTemplate || '';
  if (!template) throw new Error(`No template for notification kind "${input.kind}".`);

  let rendered = template;
  for (const [k, v] of Object.entries(input.vars)) {
    rendered = rendered.replace(new RegExp(`\\[${k}\\]`, 'g'), v);
  }

  const waUrl = `https://wa.me/${normalizePhone(input.to)}?text=${encodeURIComponent(rendered)}`;
  await markNotification(supabase, admin, input.entity, input.entityId, input.kind, waUrl);
  return { waUrl };
}

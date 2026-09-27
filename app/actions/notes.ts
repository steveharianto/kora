'use server';

/**
 * Chat Log Format
 * ===============
 *
 * Team messages on admin entity pages are stored in `admin_audit_logs`
 * using a dedicated action_type that ends in "_CHAT". This lets us
 * distinguish chat messages from regular audit-trail entries without
 * any database change.
 *
 *   action_type: 'ORDER_CHAT' | 'FITTING_CHAT' | 'RETURN_CHAT'
 *   field_name:  'message'
 *   new_value:   plain text ("Hey @Shelda, can you confirm this order?")
 *   details:     { mentions: ["<admin_uuid>", ...] } | null
 *
 * Rendering rules:
 *   • audit rows with a *_CHAT action_type → chat widget
 *   • every other row (including legacy ORDER_NOTE / FITTING_NOTE /
 *     RETURN_NOTE) → traditional Activity log
 */

import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from './auth';
import { revalidatePath } from 'next/cache';

export type ChatEntity = 'order' | 'fitting' | 'return';

const ACTION_TYPE_BY_ENTITY: Record<ChatEntity, string> = {
  order: 'ORDER_CHAT',
  fitting: 'FITTING_CHAT',
  return: 'RETURN_CHAT',
};

const REVALIDATE_PATH_BY_ENTITY: Record<ChatEntity, (id: string) => string> = {
  order: (id) => `/admin/orders/${id}`,
  fitting: (id) => `/admin/fittings/${id}`,
  return: (id) => `/admin/returns/${id}`,
};

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Writes a chat-style team message to admin_audit_logs.
 *
 * `mentions` is the list of admin UUIDs whose @Name appears in `text`.
 * The action computes them client-side (matching against the admins list)
 * and passes them through so the renderer can highlight the mention pill
 * and flag "mentioned you" for the current admin.
 */
export async function postChatMessage(
  entity: ChatEntity,
  entityId: string,
  text: string,
  mentions: string[] = [],
) {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized.' };

  const trimmed = text.trim();
  if (!trimmed) return { error: 'Message cannot be empty.' };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars).` };
  }
  if (!entityId) return { error: 'Missing entity reference.' };

  const supabase = await createClient();

  const { error } = await supabase.from('admin_audit_logs').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: entity,
    entity_id: entityId,
    action_type: ACTION_TYPE_BY_ENTITY[entity],
    field_name: 'message',
    new_value: trimmed,
    details: mentions.length > 0 ? { mentions } : null,
  });

  if (error) return { error: error.message };

  revalidatePath(REVALIDATE_PATH_BY_ENTITY[entity](entityId));
  return { success: true };
}

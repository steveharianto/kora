import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import FittingDetailForm from './FittingDetailForm';

export default async function FittingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [fittingRes, allItemsRes, settingsRes, auditRes] = await Promise.all([
    supabase
      .from('fittings')
      .select(`
        *,
        customers (
          id,
          first_name,
          last_name,
          phone,
          addresses (
            city
          )
        ),
        fitting_items (
          id,
          slot_number,
          item_sku,
          is_evicted,
          evicted_by_order_id,
          eviction_reason,
          items (
            name,
            size,
            rental_price
          )
        )
      `)
      .eq('id', id)
      .single(),

    supabase.from('items').select('sku, name, size, rental_price').order('name'),
    supabase.from('app_settings').select('value').eq('key', 'notifications').single(),
    supabase.from('admin_audit_logs').select('*').eq('entity_id', id).order('created_at', { ascending: false }),
  ]);

  if (fittingRes.error || !fittingRes.data) {
    notFound();
  }

  const notificationTemplates = settingsRes.data?.value || {};

  return (
    <div className="pb-24 font-sans text-ink">
      <FittingDetailForm
        initialFitting={fittingRes.data}
        allItems={allItemsRes.data || []}
        notificationTemplates={notificationTemplates}
        auditLogs={auditRes.data || []}
      />
    </div>
  );
}

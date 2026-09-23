import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import ReturnDetailForm from './ReturnDetailForm';

export default async function ReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Validate format to protect PostgREST filter clauses
  if (!/^[A-Za-z0-9\-_]+$/.test(id)) {
    notFound();
  }

  const supabase = await createClient();

  // 1. Fetch return record (look up by return ID or order ID)
  const [returnRes, settingsRes, auditRes] = await Promise.all([
    supabase
      .from('returns')
      .select(`
        *,
        orders (
          *,
          order_products (
            item_sku,
            quantity,
            price,
            deposit,
            subtotal,
            items (
              name,
              size
            )
          )
        ),
        customers (
          id,
          first_name,
          last_name,
          phone,
          addresses (*)
        )
      `)
      .or(`id.eq.${id},order_id.eq.${id}`)
      .maybeSingle(),

    supabase.from('app_settings').select('key, value').in('key', ['shipping', 'rental_rules', 'notifications']),
    supabase.from('admin_audit_logs').select('*').or(`entity_id.eq.${id},entity_id.eq.RET-${id}`).order('created_at', { ascending: false }),
  ]);

  if (!returnRes.data) {
    notFound();
  }

  const settingsMap: Record<string, any> = {};
  (settingsRes.data || []).forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  return (
    <div className="pb-24 font-sans text-ink">
      <ReturnDetailForm
        initialReturn={returnRes.data}
        shippingSettings={settingsMap.shipping || {}}
        rentalRules={settingsMap.rental_rules || {}}
        notificationTemplates={settingsMap.notifications || {}}
        auditLogs={auditRes.data || []}
      />
    </div>
  );
}

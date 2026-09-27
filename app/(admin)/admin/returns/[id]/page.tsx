import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from '@/app/actions/auth';
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
  const currentAdmin = await getCurrentAdmin();

  const [returnRes, settingsRes, auditRes, adminsRes] = await Promise.all([
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
    supabase
      .from('admin_audit_logs')
      .select('*')
      .or(`entity_id.eq.${id},entity_id.eq.RET-${id}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('admins')
      .select('id, name, role')
      .eq('is_active', true)
      .order('name'),
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
        admins={adminsRes.data || []}
        currentAdmin={currentAdmin}
      />
    </div>
  );
}

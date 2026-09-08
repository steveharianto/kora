import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from '@/app/actions/auth';
import { notFound } from 'next/navigation';
import OrderForm from './OrderForm';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const currentAdmin = await getCurrentAdmin();

  // Fetch Order with relations, customer addresses, lookup items, and system settings
  const [orderRes, customersRes, itemsRes, shippingSettingsRes, notificationSettingsRes, auditRes] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        *,
        customers (
          id,
          first_name,
          last_name,
          phone,
          status,
          current_credit,
          addresses (
            id,
            label,
            city,
            postal_code,
            street_address,
            latitude,
            longitude,
            is_default
          )
        ),
        order_products (
          id,
          item_sku,
          quantity,
          price,
          deposit,
          subtotal,
          items (
            name,
            rental_price
          )
        )
      `)
      .eq('id', id)
      .single(),

    supabase
      .from('customers')
      .select(`
        id,
        first_name,
        last_name,
        phone,
        status,
        current_credit,
        addresses (
          id,
          label,
          city,
          postal_code,
          street_address,
          latitude,
          longitude,
          is_default
        )
      `)
      .order('first_name'),

    supabase.from('items').select('sku, name, rental_price').order('sku'),
    supabase.from('app_settings').select('value').eq('key', 'shipping').single(),
    supabase.from('app_settings').select('value').eq('key', 'notifications').single(),
    supabase.from('admin_audit_logs').select('*').eq('entity_id', id).order('created_at', { ascending: false }),
  ]);

  if (orderRes.error || !orderRes.data) {
    notFound();
  }

  const deliveryLeadTimes = shippingSettingsRes.data?.value?.delivery_lead_times || [];
  const notificationTemplates = notificationSettingsRes.data?.value || {};

  return (
    <div className="max-w-[1250px] pb-24 font-sans text-ink">
      <OrderForm
        initialOrder={orderRes.data}
        allCustomers={customersRes.data || []}
        allItems={itemsRes.data || []}
        deliveryLeadTimes={deliveryLeadTimes}
        notificationTemplates={notificationTemplates}
        auditLogs={auditRes.data || []}
        currentAdmin={currentAdmin}
      />
    </div>
  );
}

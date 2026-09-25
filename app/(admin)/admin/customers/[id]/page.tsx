import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import CustomerDetailClient from './CustomerDetailClient';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [customerRes, addressesRes, ktpRes, ordersRes, auditRes] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).single(),
    supabase.from('addresses').select('*').eq('customer_id', id).order('is_default', { ascending: false }),
    supabase.from('ktp_logs').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
    supabase.from('orders').select('*').eq('customer_id', id).order('order_date', { ascending: false }),
    supabase.from('admin_audit_logs').select('*').eq('entity_id', id).order('created_at', { ascending: false }),
  ]);

  if (customerRes.error || !customerRes.data) {
    notFound();
  }

  const ktpLogs = ktpRes.data || [];
  const latestKtp = ktpLogs[0] ?? null;

  // Sign the latest KTP photo for display. Falls back to the legacy
  // public-item-images URL for rows created before the storage migration.
  let ktpPhotoUrl: string | null = null;
  if (latestKtp?.photo_path) {
    const { data: signed } = await supabase.storage
      .from('ktp-photos')
      .createSignedUrl(latestKtp.photo_path, 60 * 60); // 1 hour
    ktpPhotoUrl = signed?.signedUrl ?? null;
  } else if (latestKtp?.photo_url) {
    ktpPhotoUrl = latestKtp.photo_url;
  }

  return (
    <div className="pb-20">
      <Link
        href="/admin/customers"
        className="text-[12.5px] text-muted hover:text-wine-ink inline-block mb-2.5 transition"
      >
        ← Back to Customers
      </Link>

      <CustomerDetailClient
        customer={customerRes.data}
        addresses={addressesRes.data || []}
        ktpLogs={ktpLogs}
        ktpPhotoUrl={ktpPhotoUrl}
        orders={ordersRes.data || []}
        auditLogs={auditRes.data || []}
      />
    </div>
  );
}

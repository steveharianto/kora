import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from '@/app/actions/auth';

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Neutralize CSV formula injection (=, +, -, @)
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return new NextResponse('Unauthorized: Session not found.', { status: 401 });
  }

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const search = (searchParams.get('search') || '').trim().toLowerCase();
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const status = searchParams.get('status') || 'all';
  const view = searchParams.get('view') || 'all';

  let query = supabase
    .from('orders')
    .select(`
      id,
      order_date,
      event_start_date,
      event_days,
      pickup_date,
      return_date,
      city,
      postal_code,
      street_address,
      total_price,
      total_deposit,
      shipping_fee,
      store_credit_applied,
      total,
      order_method,
      status,
      pick_up_method,
      packing_slip_id,
      payment_method,
      created_at,
      customers (
        first_name,
        last_name,
        phone,
        status
      ),
      order_products (
        item_sku,
        quantity,
        price,
        deposit,
        items (
          name
        )
      )
    `)
    .order('order_date', { ascending: false });

  if (from) query = query.gte('order_date', from);
  if (to) query = query.lte('order_date', to);
  if (status !== 'all') query = query.ilike('status', status);

  const { data: orders, error } = await query;

  if (error) {
    return new NextResponse(`Database error: ${error.message}`, { status: 500 });
  }

  let filtered = orders || [];

  if (view === 'active') {
    filtered = filtered.filter((o) => !['Completed', 'Cancelled'].includes(o.status));
  }

  if (search) {
    filtered = filtered.filter((o: any) => {
      const custName = `${o.customers?.first_name || ''} ${o.customers?.last_name || ''}`.toLowerCase();
      const idMatch = o.id.toLowerCase().includes(search);
      const nameMatch = custName.includes(search);
      const cityMatch = (o.city || '').toLowerCase().includes(search);
      const skuMatch = (o.order_products || []).some((p: any) => p.item_sku?.toLowerCase().includes(search));
      return idMatch || nameMatch || cityMatch || skuMatch;
    });
  }

  const headers = [
    'Order ID',
    'Order Date',
    'Customer Name',
    'Customer Phone',
    'KTP Status',
    'City',
    'Postal Code',
    'Delivery Address',
    'Event Start Date',
    'Event Days',
    'Pickup / Send Date',
    'Return Date',
    'Items (SKU x Qty)',
    'Rental Subtotal (IDR)',
    'Deposit (IDR)',
    'Shipping Fee (IDR)',
    'Store Credit Applied (IDR)',
    'Grand Total (IDR)',
    'Order Method',
    'Status',
    'Courier Service',
    'Waybill / Resi',
    'Payment Method',
  ];

  const rows = filtered.map((o: any) => {
    const custName = `${o.customers?.first_name || ''} ${o.customers?.last_name || ''}`.trim() || 'Guest';
    const itemsStr = (o.order_products || [])
      .map((p: any) => `${p.item_sku}${p.quantity > 1 ? ` (${p.quantity}x)` : ''}`)
      .join(', ');

    return [
      escapeCSV(o.id),
      escapeCSV(o.order_date),
      escapeCSV(custName),
      escapeCSV(o.customers?.phone || ''),
      escapeCSV(o.customers?.status || 'Not Submitted'),
      escapeCSV(o.city || ''),
      escapeCSV(o.postal_code || ''),
      escapeCSV(o.street_address || ''),
      escapeCSV(o.event_start_date || ''),
      escapeCSV(o.event_days || 1),
      escapeCSV(o.pickup_date || ''),
      escapeCSV(o.return_date || ''),
      escapeCSV(itemsStr),
      escapeCSV(o.total_price || 0),
      escapeCSV(o.total_deposit || 0),
      escapeCSV(o.shipping_fee || 0),
      escapeCSV(o.store_credit_applied || 0),
      escapeCSV(o.total || 0),
      escapeCSV(o.order_method || 'Manual'),
      escapeCSV(o.status || 'Draft'),
      escapeCSV(o.pick_up_method || ''),
      escapeCSV(o.packing_slip_id || ''),
      escapeCSV(o.payment_method || ''),
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const filename = `kora-orders-${new Date().toISOString().split('T')[0]}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

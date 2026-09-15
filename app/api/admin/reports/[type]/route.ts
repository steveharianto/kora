import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from '@/app/actions/auth';
import { generateCsvString } from '@/lib/csv';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const admin = await getCurrentAdmin();
  if (!admin) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start') || undefined;
  const end = searchParams.get('end') || undefined;

  const supabase = await createClient();

  let filename = `kora-${type}-report.csv`;
  let csvContent = '';

  if (type === 'revenue') {
    let q = supabase
      .from('orders')
      .select(`
        id, order_date, total_price, total_deposit, shipping_fee, store_credit_applied, total, payment_method, order_method, status,
        customers ( first_name, last_name )
      `)
      .not('status', 'in', '("Cancelled", "Draft")')
      .order('order_date', { ascending: false });

    if (start) q = q.gte('order_date', start);
    if (end) q = q.lte('order_date', end);

    const { data } = await q;
    const headers = [
      'Order Date',
      'Order ID',
      'Customer',
      'Rental Subtotal',
      'Deposit',
      'Shipping Fee',
      'Store Credit Applied',
      'Total Paid',
      'Payment Method',
      'Channel',
      'Status',
    ];

    const rows = (data || []).map((o: any) => [
      o.order_date,
      o.id,
      `${o.customers?.first_name || ''} ${o.customers?.last_name || ''}`.trim(),
      o.total_price,
      o.total_deposit,
      o.shipping_fee,
      o.store_credit_applied,
      o.total,
      o.payment_method,
      o.order_method,
      o.status,
    ]);

    csvContent = generateCsvString(headers, rows);
    filename = `kora-revenue-${start || 'all'}-to-${end || 'today'}.csv`;
  } else if (type === 'inventory') {
    const { data } = await supabase
      .from('items')
      .select(`
        sku, name, rental_price, status, is_archived,
        brands ( name ),
        types ( name ),
        order_products ( price, quantity, orders ( status ) )
      `)
      .order('sku');

    const headers = ['SKU', 'Name', 'Brand', 'Type', 'Rental Price', 'Times Rented', 'Gross Revenue', 'Status'];
    const rows = (data || []).map((item: any) => {
      const rentals = (item.order_products || []).filter(
        (op: any) => op.orders && !['Cancelled', 'Draft'].includes(op.orders.status)
      );
      const revenue = rentals.reduce((acc: number, r: any) => acc + (Number(r.price) || 0) * (r.quantity || 1), 0);
      return [
        item.sku,
        item.name,
        item.brands?.name || '',
        item.types?.name || '',
        item.rental_price,
        rentals.length,
        revenue,
        item.is_archived ? 'Archived' : item.status,
      ];
    });

    csvContent = generateCsvString(headers, rows);
    filename = `kora-inventory-utilization-${Date.now()}.csv`;
  } else if (type === 'returns') {
    let q = supabase
      .from('returns')
      .select(`
        id, order_id, status, requested_at, has_stains, has_damage, is_incomplete, has_odor,
        deposit_held, late_days, qc_deduction, return_shipping_cost, refund_amount, refund_destination, refunded_at,
        customers ( first_name, last_name ),
        orders ( return_date )
      `)
      .order('requested_at', { ascending: false });

    if (start) q = q.gte('requested_at', start);
    if (end) q = q.lte('requested_at', end);

    const { data } = await q;
    const headers = [
      'Return ID',
      'Order ID',
      'Customer',
      'Deadline',
      'Refunded Date',
      'Days Late',
      'QC Issues',
      'Deposit Held',
      'QC Deduction',
      'Return Ongkir',
      'Net Refund',
      'Destination Account',
      'Status',
    ];

    const rows = (data || []).map((r: any) => {
      const issues = [];
      if (r.has_stains) issues.push('Stains');
      if (r.has_damage) issues.push('Damage');
      if (r.is_incomplete) issues.push('Incomplete');
      if (r.has_odor) issues.push('Odor');

      return [
        r.id,
        r.order_id,
        `${r.customers?.first_name || ''} ${r.customers?.last_name || ''}`.trim(),
        r.orders?.return_date || '',
        r.refunded_at || '',
        r.late_days || 0,
        issues.join('; ') || 'None',
        r.deposit_held,
        r.qc_deduction,
        r.return_shipping_cost,
        r.refund_amount,
        r.refund_destination,
        r.status,
      ];
    });

    csvContent = generateCsvString(headers, rows);
    filename = `kora-returns-qc-${start || 'all'}-to-${end || 'today'}.csv`;
  } else if (type === 'customers') {
    const { data } = await supabase
      .from('customers')
      .select(`
        id, first_name, last_name, phone, status, date_joined, current_credit,
        addresses ( city ),
        orders ( total, status )
      `)
      .order('date_joined', { ascending: false });

    const headers = [
      'Customer ID',
      'First Name',
      'Last Name',
      'Phone',
      'City',
      'Status',
      'Total Orders',
      'LTV (Spend)',
      'Store Credit',
      'Date Joined',
    ];

    const rows = (data || []).map((c: any) => {
      const validOrders = (c.orders || []).filter((o: any) => !['Cancelled', 'Draft'].includes(o.status));
      const ltv = validOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
      return [
        c.id,
        c.first_name,
        c.last_name || '',
        c.phone || '',
        c.addresses?.[0]?.city || '',
        c.status,
        validOrders.length,
        ltv,
        c.current_credit,
        c.date_joined,
      ];
    });

    csvContent = generateCsvString(headers, rows);
    filename = `kora-customer-ltv-${Date.now()}.csv`;
  } else if (type === 'audit') {
    let q = supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false });
    if (start) q = q.gte('created_at', start);
    if (end) q = q.lte('created_at', end);

    const { data } = await q;
    const headers = ['Timestamp', 'Admin', 'Entity Type', 'Entity ID', 'Action Type', 'Field', 'Old Value', 'New Value'];
    const rows = (data || []).map((l: any) => [
      l.created_at,
      l.admin_name,
      l.entity_type,
      l.entity_id,
      l.action_type,
      l.field_name,
      l.old_value,
      l.new_value,
    ]);

    csvContent = generateCsvString(headers, rows);
    filename = `kora-audit-logs-${start || 'all'}-to-${end || 'today'}.csv`;
  } else {
    return new NextResponse('Invalid report type', { status: 400 });
  }

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

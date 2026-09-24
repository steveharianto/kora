'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from './auth';

export async function getRevenueReportData(startDate?: string, endDate?: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  let query = supabase
    .from('orders')
    .select(`id, order_date, total_price, total_deposit, shipping_fee, store_credit_applied, total, order_method, payment_method, status, customers(first_name, last_name), order_products(item_sku)`)
    .not('status', 'in', '("Cancelled", "Draft")')
    .order('order_date', { ascending: false });
  if (startDate) query = query.gte('order_date', startDate);
  if (endDate) query = query.lte('order_date', endDate);

  const { data: orders, error } = await query;
  if (error) return { error: error.message };

  let fittingsQuery = supabase
    .from('fittings')
    .select('id, date, after_hours_fee, fee_payment_method')
    .eq('fee_payment_status', 'Paid');
  if (startDate) fittingsQuery = fittingsQuery.gte('date', startDate);
  if (endDate) fittingsQuery = fittingsQuery.lte('date', endDate);
  const { data: fittings } = await fittingsQuery;

  let returnsQuery = supabase
    .from('returns')
    .select('refund_amount')
    .eq('refund_status', 'Refunded');
  if (startDate) returnsQuery = returnsQuery.gte('refunded_at', startDate);
  if (endDate) returnsQuery = returnsQuery.lte('refunded_at', endDate);
  const { data: completedReturns } = await returnsQuery;
  const totalRefundedDeposits = (completedReturns || []).reduce((s, r) => s + (Number(r.refund_amount) || 0), 0);

  const grossRental = (orders || []).reduce((s, o) => s + (Number(o.total_price) || 0), 0);
  const depositsHeld = (orders || []).reduce((s, o) => s + (Number(o.total_deposit) || 0), 0);
  const shippingFees = (orders || []).reduce((s, o) => s + (Number(o.shipping_fee) || 0), 0);
  const creditApplied = (orders || []).reduce((s, o) => s + (Number(o.store_credit_applied) || 0), 0);
  const fittingsIncome = (fittings || []).reduce((s, f) => s + (Number(f.after_hours_fee) || 0), 0);
  const netCashflow =
    grossRental + (depositsHeld - totalRefundedDeposits) + shippingFees + fittingsIncome - creditApplied;

  const rows = (orders || []).map((o) => {
    const custName = `${(o.customers as any)?.first_name || ''} ${(o.customers as any)?.last_name || ''}`.trim() || 'Customer';
    const items = (o.order_products || []).map((p: any) => p.item_sku).join(', ');
    return {
      date: o.order_date,
      orderId: o.id,
      customer: custName,
      items: items || '—',
      rentalPrice: Number(o.total_price) || 0,
      deposit: Number(o.total_deposit) || 0,
      shipping: Number(o.shipping_fee) || 0,
      storeCredit: Number(o.store_credit_applied) || 0,
      totalPaid: Number(o.total) || 0,
      paymentMethod: o.payment_method || '—',
      channel: o.order_method || 'Website',
    };
  });

  return {
    kpis: {
      grossRental,
      depositsHeld,
      shippingFees,
      fittingsIncome,
      creditApplied,
      netCashflow,
      totalCount: rows.length,
    },
    rows,
  };
}

export async function getInventoryReportData() {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  const { data: items, error } = await supabase
    .from('items')
    .select(`sku, name, rental_price, status, is_archived, brands(name), types(name), order_products(price, quantity, orders(status, pickup_date, return_date))`)
    .order('sku');
  if (error) return { error: error.message };

  let fleetTotalRevenue = 0;
  let activeFleetCount = 0;

  const rows = (items || []).map((item) => {
    const valid = (item.order_products || []).filter(
      (op: any) => op.orders && !['Cancelled', 'Draft'].includes(op.orders.status),
    );
    const timesRented = valid.length;
    let daysOnLoan = 0;
    let skuRevenue = 0;
    valid.forEach((op: any) => {
      skuRevenue += (Number(op.price) || 0) * (op.quantity || 1);
      if (op.orders.pickup_date && op.orders.return_date) {
        const s = new Date(op.orders.pickup_date).getTime();
        const e = new Date(op.orders.return_date).getTime();
        daysOnLoan += Math.max(1, Math.round((e - s) / 86400000));
      }
    });
    fleetTotalRevenue += skuRevenue;
    if (!item.is_archived && item.status !== 'Under Repair') activeFleetCount++;
    return {
      sku: item.sku,
      name: item.name,
      brand: (item.brands as any)?.name || '—',
      type: (item.types as any)?.name || 'Dress',
      rentalPrice: Number(item.rental_price) || 0,
      timesRented,
      daysOnLoan,
      revenueYield: skuRevenue,
      status: item.is_archived ? 'Archived' : item.status,
    };
  });

  return {
    kpis: { totalItems: rows.length, activeFleetCount, fleetTotalRevenue },
    rows: rows.sort((a, b) => b.revenueYield - a.revenueYield),
  };
}

export async function getReturnsReportData(startDate?: string, endDate?: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  let query = supabase
    .from('returns')
    .select(`id, order_id, status, requested_at, has_stains, has_damage, is_incomplete, has_odor, deposit_held, late_days, qc_deduction, return_shipping_cost, refund_amount, refund_destination, refunded_at, refund_status, orders(return_date), customers(first_name, last_name)`)
    .order('requested_at', { ascending: false });
  if (startDate) query = query.gte('requested_at', startDate);
  if (endDate) query = query.lte('requested_at', endDate);

  const { data: returns, error } = await query;
  if (error) return { error: error.message };

  const allRows = returns || [];

  let totalDepositsHeld = 0;
  let totalQcDeductions = 0;
  let totalLateDays = 0;
  let totalRefunded = 0;

  const rows = allRows.map((r) => {
    const custName = `${(r.customers as any)?.first_name || ''} ${(r.customers as any)?.last_name || ''}`.trim() || 'Customer';
    const depHeld = Number(r.deposit_held) || 0;
    const deduction = Number(r.qc_deduction) || 0;
    const refunded = Number(r.refund_amount) || 0;
    const daysLate = Number(r.late_days) || 0;
    const isRefunded = r.refund_status === 'Refunded';

    // KPIs count only refunded rows for deposits, deductions, refunds; late_days for all
    totalDepositsHeld += isRefunded ? depHeld : 0;
    totalQcDeductions += isRefunded ? deduction : 0;
    totalRefunded += isRefunded ? refunded : 0;
    totalLateDays += daysLate;

    const issues: string[] = [];
    if (r.has_stains) issues.push('Stains');
    if (r.has_damage) issues.push('Damage');
    if (r.is_incomplete) issues.push('Incomplete');
    if (r.has_odor) issues.push('Odor');

    return {
      returnId: r.id,
      orderId: r.order_id,
      customer: custName,
      date: r.requested_at ? r.requested_at.split('T')[0] : (r.orders as any)?.return_date,
      deadline: (r.orders as any)?.return_date || '—',
      actualDate: r.refunded_at ? r.refunded_at.split('T')[0] : 'In Progress',
      daysLate,
      qcIssues: issues.length > 0 ? issues.join(', ') : 'Clean',
      depositHeld: depHeld,
      qcDeduction: deduction,
      refundAmount: refunded,
      refundDestination: r.refund_destination || '—',
      status: r.status,
      refundStatus: r.refund_status || '—',
    };
  });

  return {
    kpis: { totalReturns: rows.length, totalDepositsHeld, totalQcDeductions, totalRefunded, totalLateDays },
    rows,
  };
}

export async function getCustomersReportData() {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  const { data: customers, error } = await supabase
    .from('customers')
    .select(`id, first_name, last_name, phone, status, date_joined, current_credit, addresses(city), orders(total, status)`)
    .order('date_joined', { ascending: false });
  if (error) return { error: error.message };

  let totalLtvSum = 0;
  let totalCreditLiability = 0;
  const rows = (customers || []).map((c) => {
    const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Customer';
    const validOrders = (c.orders || []).filter((o: any) => !['Cancelled', 'Draft'].includes(o.status));
    const totalOrdersCount = validOrders.length;
    const ltv = validOrders.reduce((a: number, o: any) => a + (Number(o.total) || 0), 0);
    const aov = totalOrdersCount > 0 ? Math.round(ltv / totalOrdersCount) : 0;
    const credit = Number(c.current_credit) || 0;
    totalLtvSum += ltv;
    totalCreditLiability += credit;
    return {
      id: c.id,
      name,
      phone: c.phone || '—',
      city: c.addresses?.[0]?.city || '—',
      status: c.status,
      ordersCount: totalOrdersCount,
      ltv,
      aov,
      storeCredit: credit,
      date_joined: c.date_joined ? c.date_joined.split('T')[0] : '—',
    };
  });

  return {
    kpis: {
      totalCustomers: rows.length,
      totalLtvSum,
      totalCreditLiability,
      averageLtv: rows.length > 0 ? Math.round(totalLtvSum / rows.length) : 0,
    },
    rows: rows.sort((a, b) => b.ltv - a.ltv),
  };
}

export async function getAuditReportData(startDate?: string, endDate?: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  let query = supabase
    .from('admin_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data: logs, error } = await query;
  if (error) return { error: error.message };

  const rows = (logs || []).map((l) => ({
    id: l.id,
    date: l.created_at ? l.created_at.split('T')[0] : undefined,
    timestamp: l.created_at ? l.created_at.replace('T', ' ').slice(0, 19) : '—',
    admin: l.admin_name || 'System',
    entityType: l.entity_type,
    entityId: l.entity_id,
    action: l.action_type,
    field: l.field_name || 'all',
    oldVal: l.old_value || '—',
    newVal: l.new_value || '—',
  }));

  return { kpis: { totalEntries: rows.length }, rows };
}

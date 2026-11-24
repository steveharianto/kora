'use server';

import { createClient } from '@/lib/supabase/server';
import { fetchAllRows, toWibEnd, toWibStart } from '@/lib/supabase/paginate';
import { getCurrentAdmin } from './auth';

/* ─────────────────────────────────────────────────────────────────
 * REVENUE
 * ---------------------------------------------------------------*/

export async function getRevenueReportData(startDate?: string, endDate?: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  const [ordersRes, fittingsRes, returnsRes] = await Promise.all([
    fetchAllRows<any>((from, to) => {
      let query = supabase
        .from('orders')
        .select(`
          id, order_date, total_price, total_deposit, shipping_fee,
          store_credit_applied, total, order_method, payment_method, status,
          customers(first_name, last_name),
          order_products(item_sku)
        `)
        .not('status', 'in', '("Cancelled", "Draft")')
        .order('order_date', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);

      if (startDate) query = query.gte('order_date', startDate);
      if (endDate) query = query.lte('order_date', endDate);
      return query;
    }),
    // Fittings income — same window
    fetchAllRows<any>((from, to) => {
      let fittingsQuery = supabase
        .from('fittings')
        .select('id, date, after_hours_fee, fee_payment_method')
        .eq('fee_payment_status', 'Paid')
        .order('date', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);
      if (startDate) fittingsQuery = fittingsQuery.gte('date', startDate);
      if (endDate) fittingsQuery = fittingsQuery.lte('date', endDate);
      return fittingsQuery;
    }),
    // Deposits refunded — same window (uses refunded_at, not order_date)
    fetchAllRows<any>((from, to) => {
      let returnsQuery = supabase
        .from('returns')
        .select('id, refund_amount')
        .eq('refund_status', 'Refunded')
        .order('refunded_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);
      if (startDate) returnsQuery = returnsQuery.gte('refunded_at', toWibStart(startDate));
      if (endDate) returnsQuery = returnsQuery.lte('refunded_at', toWibEnd(endDate));
      return returnsQuery;
    }),
  ]);

  if (ordersRes.error) return { error: ordersRes.error.message };
  if (fittingsRes.error) return { error: fittingsRes.error.message };
  if (returnsRes.error) return { error: returnsRes.error.message };

  const orders = ordersRes.data;
  const fittings = fittingsRes.data;
  const completedReturns = returnsRes.data;

  const totalRefundedDeposits = (completedReturns || []).reduce(
    (s, r) => s + (Number(r.refund_amount) || 0),
    0,
  );

  const grossRental = (orders || []).reduce(
    (s, o) => s + (Number(o.total_price) || 0),
    0,
  );
  const depositsHeld = (orders || []).reduce(
    (s, o) => s + (Number(o.total_deposit) || 0),
    0,
  );
  const shippingFees = (orders || []).reduce(
    (s, o) => s + (Number(o.shipping_fee) || 0),
    0,
  );
  const creditApplied = (orders || []).reduce(
    (s, o) => s + (Number(o.store_credit_applied) || 0),
    0,
  );
  const fittingsIncome = (fittings || []).reduce(
    (s, f) => s + (Number(f.after_hours_fee) || 0),
    0,
  );

  // Gross collected: everything the customer actually paid in this window.
  // (Includes refundable deposits — that's what "collected" means.)
  const grossCollected = (orders || []).reduce(
    (s, o) => s + (Number(o.total) || 0),
    0,
  );

  // Realized (net): what the business actually gets to keep in this window.
  // = grossCollected − refundedDeposits + fittingsIncome
  const realizedNet = grossCollected - totalRefundedDeposits + fittingsIncome;

  const rows = (orders || []).map((o) => {
    const custName =
      `${(o.customers as any)?.first_name || ''} ${(o.customers as any)?.last_name || ''}`.trim() ||
      'Customer';
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
      totalRefundedDeposits,
      grossCollected,
      realizedNet,
      totalCount: rows.length,
    },
    rows,
  };
}

/* ─────────────────────────────────────────────────────────────────
 * INVENTORY — lifetime only, no date filter
 * ---------------------------------------------------------------*/

export async function getInventoryReportData() {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  const [itemsRes, orderProductsRes] = await Promise.all([
    fetchAllRows<any>((from, to) =>
      supabase
        .from('items')
        .select(`
          sku, name, rental_price, status, is_archived,
          brands(name),
          types(name)
        `)
        .order('sku', { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<any>((from, to) =>
      supabase
        .from('order_products')
        .select(`
          id, item_sku, price, quantity,
          orders(status, pickup_date, return_date)
        `)
        .order('id', { ascending: true })
        .range(from, to),
    ),
  ]);

  if (itemsRes.error) return { error: itemsRes.error.message };
  if (orderProductsRes.error) return { error: orderProductsRes.error.message };

  const statsBySku = new Map<
    string,
    { timesRented: number; daysOnLoan: number; skuRevenue: number }
  >();
  for (const op of orderProductsRes.data) {
    const order = op.orders as any;
    if (!order || ['Cancelled', 'Draft'].includes(order.status)) continue;
    const prev = statsBySku.get(op.item_sku) || {
      timesRented: 0,
      daysOnLoan: 0,
      skuRevenue: 0,
    };
    prev.timesRented += 1;
    prev.skuRevenue += (Number(op.price) || 0) * (op.quantity || 1);
    if (order.pickup_date && order.return_date) {
      const s = new Date(order.pickup_date).getTime();
      const e = new Date(order.return_date).getTime();
      prev.daysOnLoan += Math.max(1, Math.round((e - s) / 86400000));
    }
    statsBySku.set(op.item_sku, prev);
  }

  let fleetTotalRevenue = 0;
  let activeFleetCount = 0;

  const rows = itemsRes.data.map((item) => {
    const stats = statsBySku.get(item.sku) || {
      timesRented: 0,
      daysOnLoan: 0,
      skuRevenue: 0,
    };
    fleetTotalRevenue += stats.skuRevenue;
    if (!item.is_archived && item.status !== 'Under Repair') activeFleetCount++;
    return {
      sku: item.sku,
      name: item.name,
      brand: (item.brands as any)?.name || '—',
      type: (item.types as any)?.name || 'Dress',
      rentalPrice: Number(item.rental_price) || 0,
      timesRented: stats.timesRented,
      daysOnLoan: stats.daysOnLoan,
      revenueYield: stats.skuRevenue,
      status: item.is_archived ? 'Archived' : item.status,
    };
  });

  return {
    kpis: { totalItems: rows.length, activeFleetCount, fleetTotalRevenue },
    rows: rows.sort((a, b) => b.revenueYield - a.revenueYield),
  };
}

/* ─────────────────────────────────────────────────────────────────
 * RETURNS
 * ---------------------------------------------------------------*/

export async function getReturnsReportData(startDate?: string, endDate?: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  const { data: allRows, error } = await fetchAllRows<any>((from, to) => {
    let query = supabase
      .from('returns')
      .select(`
        id, order_id, status, requested_at,
        has_stains, has_damage, is_incomplete, has_odor,
        deposit_held, late_days, qc_deduction, return_shipping_cost,
        refund_amount, refund_destination, refunded_at, refund_status,
        orders(return_date),
        customers(first_name, last_name)
      `)
      .order('requested_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (startDate) query = query.gte('requested_at', toWibStart(startDate));
    if (endDate) query = query.lte('requested_at', toWibEnd(endDate));
    return query;
  });

  if (error) return { error: error.message };

  let totalDepositsUnderCustody = 0;
  let totalQcDeductions = 0;
  let totalLateDays = 0;
  let totalRefunded = 0;

  const rows = allRows.map((r) => {
    const custName =
      `${(r.customers as any)?.first_name || ''} ${(r.customers as any)?.last_name || ''}`.trim() ||
      'Customer';
    const depHeld = Number(r.deposit_held) || 0;
    const deduction = Number(r.qc_deduction) || 0;
    const refunded = Number(r.refund_amount) || 0;
    const daysLate = Number(r.late_days) || 0;
    const isRefunded = r.refund_status === 'Refunded';

    // Deposits still under custody = deposits on returns that haven't
    // been released yet. (Was inverted before — counted only refunded rows.)
    totalDepositsUnderCustody += !isRefunded ? depHeld : 0;
    // Deductions and refunds are counted at the moment they're issued —
    // i.e. only on refunded rows.
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
      date: r.requested_at
        ? r.requested_at.split('T')[0]
        : (r.orders as any)?.return_date,
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
    kpis: {
      totalReturns: rows.length,
      totalDepositsUnderCustody,
      totalQcDeductions,
      totalRefunded,
      totalLateDays,
    },
    rows,
  };
}

/* ─────────────────────────────────────────────────────────────────
 * CUSTOMERS — lifetime only
 * ---------------------------------------------------------------*/

export async function getCustomersReportData() {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  const [customersRes, ordersRes] = await Promise.all([
    fetchAllRows<any>((from, to) =>
      supabase
        .from('customers')
        .select(`
          id, first_name, last_name, phone, status, date_joined, current_credit,
          addresses(city)
        `)
        .order('date_joined', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<any>((from, to) =>
      supabase
        .from('orders')
        .select('id, customer_id, total, total_deposit, status')
        .not('status', 'in', '("Cancelled", "Draft")')
        .order('id', { ascending: true })
        .range(from, to),
    ),
  ]);

  if (customersRes.error) return { error: customersRes.error.message };
  if (ordersRes.error) return { error: ordersRes.error.message };

  const statsByCustomer = new Map<string, { count: number; ltv: number }>();
  for (const o of ordersRes.data) {
    if (!o.customer_id) continue;
    const prev = statsByCustomer.get(o.customer_id) || { count: 0, ltv: 0 };
    prev.count += 1;
    // LTV excludes refundable deposits — that money isn't revenue, it's
    // a liability that returns to the customer on the return completing.
    prev.ltv += (Number(o.total) || 0) - (Number(o.total_deposit) || 0);
    statsByCustomer.set(o.customer_id, prev);
  }

  let totalLtvSum = 0;
  let totalCreditLiability = 0;

  const rows = customersRes.data.map((c) => {
    const name =
      `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Customer';
    const stats = statsByCustomer.get(c.id) || { count: 0, ltv: 0 };
    const totalOrdersCount = stats.count;
    const ltv = stats.ltv;
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

/* ─────────────────────────────────────────────────────────────────
 * AUDIT
 * ---------------------------------------------------------------*/

const AUDIT_PAGE_SIZE = 500;

export async function getAuditReportData(startDate?: string, endDate?: string) {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: 'Unauthorized' };

  let query = supabase
    .from('admin_audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(AUDIT_PAGE_SIZE);

  if (startDate) query = query.gte('created_at', toWibStart(startDate));
  if (endDate) query = query.lte('created_at', toWibEnd(endDate));

  const { data: logs, error, count } = await query;
  if (error) return { error: error.message };

  const rows = (logs || []).map((l) => ({
    id: l.id,
    date: l.created_at ? l.created_at.split('T')[0] : undefined,
    timestamp: l.created_at
      ? l.created_at.replace('T', ' ').slice(0, 19)
      : '—',
    admin: l.admin_name || 'System',
    entityType: l.entity_type,
    entityId: l.entity_id,
    action: l.action_type,
    field: l.field_name || 'all',
    oldVal: l.old_value || '—',
    newVal: l.new_value || '—',
  }));

  return {
    kpis: {
      shownEntries: rows.length,
      totalAvailable: count ?? rows.length,
      isTruncated: (count ?? 0) > rows.length,
    },
    rows,
  };
}

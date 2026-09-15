'use server';

import { createClient } from '@/lib/supabase/server';

export interface DashboardMetrics {
  greeting: string;
  dateRangeLabel: string;
  previousRangeLabel: string;

  totalRevenue: number;
  previousRevenue: number;
  revenueDeltaPercent: number;
  dailyRevenueTrend: { date: string; amount: number }[];

  topDresses: {
    sku: string;
    name: string;
    revenue: number;
    sharePercent: number;
  }[];
  topDressLeadText: string;

  orderStatusBreakdown: {
    totalOrders: number;
    orderDeltaPercent: number;
    segments: { label: string; count: number; percent: number; color: string }[];
  };

  channelSplit: {
    websitePercent: number;
    websiteDeltaPt: number;
    segments: { label: string; count: number; percent: number; color: string }[];
  };

  customerRetention: {
    newPercent: number;
    newDeltaPt: number;
    segments: { label: string; count: number; percent: number; color: string }[];
  };

  triage: {
    dispatchToday: {
      orderId: string;
      customerName: string;
      sku: string;
      city: string;
    }[];
    returnsDue: {
      id: string;
      orderId: string;
      customerName: string;
      sku: string;
      agingText: string;
      isOverdue: boolean;
    }[];
    ktpPending: {
      customerId: string;
      customerName: string;
      status: string;
    }[];
    fittingsUpcoming: {
      id: string;
      timeLabel: string;
      customerName: string;
      dressesSummary: string;
    }[];
  };
}

export async function getDashboardMetrics(rangeKey: string = '30d'): Promise<DashboardMetrics> {
  const supabase = await createClient();

  const now = new Date();
  let days = 30;
  if (rangeKey === '7d') days = 7;
  if (rangeKey === 'today') days = 1;
  if (rangeKey === 'month') days = now.getDate();

  // Current period bounds formatted in Indonesian timezone
  const startDateObj = new Date(now);
  startDateObj.setDate(now.getDate() - days);
  startDateObj.setHours(0, 0, 0, 0);

  const startDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(startDateObj);
  const endDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);

  // Previous period bounds (for comparative metrics)
  const prevStartDateObj = new Date(startDateObj);
  prevStartDateObj.setDate(startDateObj.getDate() - days);
  const prevStartDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(prevStartDateObj);
  const prevEndDateStr = startDateStr;

  const [currentOrdersRes, previousOrdersRes] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        id,
        order_date,
        total_price,
        order_method,
        status,
        customer_id,
        order_products (
          item_sku,
          quantity,
          price,
          items (
            name
          )
        )
      `)
      .gte('order_date', startDateStr)
      .lte('order_date', endDateStr)
      .not('status', 'in', '("Cancelled", "Draft")'),

    supabase
      .from('orders')
      .select('id, total_price, order_method, customer_id')
      .gte('order_date', prevStartDateStr)
      .lt('order_date', prevEndDateStr)
      .not('status', 'in', '("Cancelled", "Draft")'),
  ]);

  const currentOrders = currentOrdersRes.data || [];
  const previousOrders = previousOrdersRes.data || [];

  // Revenue Calculations
  const totalRevenue = currentOrders.reduce((acc, o) => acc + (Number(o.total_price) || 0), 0);
  const previousRevenue = previousOrders.reduce((acc, o) => acc + (Number(o.total_price) || 0), 0);
  const revenueDeltaPercent =
    previousRevenue > 0
      ? Math.round(((totalRevenue - previousRevenue) / previousRevenue) * 100)
      : 100;

  // Daily Trend Aggregation
  const dailyMap: Record<string, number> = {};
  for (let d = new Date(startDateObj); d <= now; d.setDate(d.getDate() + 1)) {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d).slice(5);
    dailyMap[key] = 0;
  }
  currentOrders.forEach((o) => {
    const key = (o.order_date || '').slice(5);
    if (dailyMap[key] !== undefined) {
      dailyMap[key] += Number(o.total_price) || 0;
    }
  });
  const dailyRevenueTrend = Object.entries(dailyMap).map(([date, amount]) => ({
    date,
    amount,
  }));

  // Top Dresses Calculation
  const dressYieldMap: Record<string, { name: string; revenue: number }> = {};
  currentOrders.forEach((o) => {
    (o.order_products || []).forEach((p: any) => {
      const sku = p.item_sku;
      const amount = (Number(p.price) || 0) * (p.quantity || 1);
      if (!dressYieldMap[sku]) {
        dressYieldMap[sku] = { name: p.items?.name || sku, revenue: 0 };
      }
      dressYieldMap[sku].revenue += amount;
    });
  });

  const sortedDresses = Object.entries(dressYieldMap)
    .map(([sku, data]) => ({
      sku,
      name: data.name,
      revenue: data.revenue,
      sharePercent: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  const topDress = sortedDresses[0];
  const topDressLeadText = topDress
    ? `${topDress.name} leads with Rp ${(topDress.revenue / 1000000).toFixed(1)} jt — ${topDress.sharePercent}% of this period's dress revenue across ${sortedDresses.length} style(s)`
    : 'No dress rentals recorded in this window.';

  // Donut 1: Orders by Status
  const totalOrders = currentOrders.length;
  const prevTotalOrders = previousOrders.length;
  const orderDeltaPercent =
    prevTotalOrders > 0
      ? Math.round(((totalOrders - prevTotalOrders) / prevTotalOrders) * 100)
      : 100;

  const statusCounts: Record<string, number> = {};
  currentOrders.forEach((o) => {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  });

  const statusColors: Record<string, string> = {
    Ordered: '#977028',
    'In Shipping': '#2B6CB0',
    Active: '#2E7D47',
    Completed: '#1A1F16',
    Received: '#5A6253',
  };

  const statusSegments = Object.entries(statusCounts).map(([status, count]) => ({
    label: status,
    count,
    percent: totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0,
    color: statusColors[status] || '#8C827A',
  }));

  // Donut 2: Channel Split
  const websiteCount = currentOrders.filter((o) => o.order_method === 'Website').length;
  const manualCount = totalOrders - websiteCount;
  const websitePercent = totalOrders > 0 ? Math.round((websiteCount / totalOrders) * 100) : 100;

  const prevWebsiteCount = previousOrders.filter((o) => o.order_method === 'Website').length;
  const prevWebsitePercent =
    prevTotalOrders > 0 ? Math.round((prevWebsiteCount / prevTotalOrders) * 100) : websitePercent;
  const websiteDeltaPt = websitePercent - prevWebsitePercent;

  const channelSegments = [
    { label: 'Website', count: websiteCount, percent: websitePercent, color: '#5A6253' },
    { label: 'Manual', count: manualCount, percent: 100 - websitePercent, color: '#2B6CB0' },
  ];

  // Donut 3: Customer Retention
  const customerOrderCountsRes = await supabase
    .from('orders')
    .select('customer_id');
  const histMap: Record<string, number> = {};
  (customerOrderCountsRes.data || []).forEach((o) => {
    if (o.customer_id) histMap[o.customer_id] = (histMap[o.customer_id] || 0) + 1;
  });

  let newCustCount = 0;
  let returningCustCount = 0;
  const evaluatedCusts = new Set<string>();

  currentOrders.forEach((o) => {
    if (o.customer_id && !evaluatedCusts.has(o.customer_id)) {
      evaluatedCusts.add(o.customer_id);
      if ((histMap[o.customer_id] || 1) <= 1) newCustCount++;
      else returningCustCount++;
    }
  });

  const totalEvaluated = newCustCount + returningCustCount;
  const newPercent = totalEvaluated > 0 ? Math.round((newCustCount / totalEvaluated) * 100) : 0;
  const returningPercent = 100 - newPercent;

  const retentionSegments = [
    { label: 'New', count: newCustCount, percent: newPercent, color: '#2E7D47' },
    { label: 'Returning', count: returningCustCount, percent: returningPercent, color: '#2B6CB0' },
  ];

  // Live Operational Triage Feeds
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);

  const tomorrowObj = new Date(now);
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(tomorrowObj);

  const [triageDispatchRes, triageReturnsRes, triageKtpRes, triageFittingsRes] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        id,
        city,
        customers (
          first_name,
          last_name
        ),
        order_products (
          item_sku
        )
      `)
      .eq('pickup_date', todayStr)
      .eq('status', 'Ordered')
      .limit(6),

    supabase
      .from('returns')
      .select(`
        id,
        order_id,
        status,
        orders (
          return_date,
          order_products (
            item_sku
          )
        ),
        customers (
          first_name,
          last_name
        )
      `)
      .in('status', ['Requested', 'Shipping', 'Received'])
      .limit(6),

    supabase
      .from('customers')
      .select('id, first_name, last_name, status')
      .in('status', ['KTP Pending', 'Not Submitted'])
      .limit(6),

    supabase
      .from('fittings')
      .select(`
        id,
        date,
        slot,
        customers (
          first_name,
          last_name
        ),
        fitting_items (
          item_sku
        )
      `)
      .in('date', [todayStr, tomorrowStr])
      .not('status', 'in', '("Cancelled", "Conflict Evicted")')
      .order('date', { ascending: true })
      .order('slot', { ascending: true })
      .limit(6),
  ]);

  const dispatchToday = (triageDispatchRes.data || []).map((o: any) => ({
    orderId: o.id,
    customerName: `${o.customers?.first_name || ''} ${o.customers?.last_name || ''}`.trim(),
    sku: o.order_products?.[0]?.item_sku || 'Garment',
    city: o.city || 'Jakarta',
  }));

  const returnsDue = (triageReturnsRes.data || []).map((r: any) => {
    const returnDeadline = r.orders?.return_date;
    let agingText = 'due today';
    let isOverdue = false;

    if (returnDeadline) {
      const [ry, rm, rd] = returnDeadline.split('-').map(Number);
      const deadlineTime = new Date(ry, rm - 1, rd).getTime();

      const [ty, tm, td] = todayStr.split('-').map(Number);
      const todayTime = new Date(ty, tm - 1, td).getTime();

      const diff = Math.round((todayTime - deadlineTime) / (1000 * 60 * 60 * 24));
      if (diff > 0) {
        agingText = `${diff} d late`;
        isOverdue = true;
      } else if (diff === -1) {
        agingText = 'due tomorrow';
      }
    }

    return {
      id: r.id,
      orderId: r.order_id,
      customerName: `${r.customers?.first_name || ''} ${r.customers?.last_name || ''}`.trim(),
      sku: r.orders?.order_products?.[0]?.item_sku || 'Garment',
      agingText,
      isOverdue,
    };
  });

  const ktpPending = (triageKtpRes.data || []).map((c: any) => ({
    customerId: c.id,
    customerName: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
    status: c.status,
  }));

  const fittingsUpcoming = (triageFittingsRes.data || []).map((f: any) => {
    const isToday = f.date === todayStr;
    const timeLabel = `${isToday ? 'Today' : 'Tomorrow'} ${f.slot ? f.slot.slice(0, 5) : '10:00'}`;
    const skus = (f.fitting_items || []).map((fi: any) => fi.item_sku).join(', ');
    return {
      id: f.id,
      timeLabel,
      customerName: `${f.customers?.first_name || ''} ${f.customers?.last_name || ''}`.trim(),
      dressesSummary: skus || 'Fitting',
    };
  });

  const hour = now.getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  if (hour >= 17) greeting = 'Good evening';

  return {
    greeting,
    dateRangeLabel: `${startDateStr.replace(/-/g, '/')} – ${endDateStr.replace(/-/g, '/')}`,
    previousRangeLabel: `${prevStartDateStr.replace(/-/g, '/')} – ${prevEndDateStr.replace(/-/g, '/')}`,
    totalRevenue,
    previousRevenue,
    revenueDeltaPercent,
    dailyRevenueTrend,
    topDresses: sortedDresses,
    topDressLeadText,
    orderStatusBreakdown: {
      totalOrders,
      orderDeltaPercent,
      segments: statusSegments,
    },
    channelSplit: {
      websitePercent,
      websiteDeltaPt,
      segments: channelSegments,
    },
    customerRetention: {
      newPercent,
      newDeltaPt: 0,
      segments: retentionSegments,
    },
    triage: {
      dispatchToday,
      returnsDue,
      ktpPending,
      fittingsUpcoming,
    },
  };
}

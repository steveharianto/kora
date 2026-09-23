import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatRupiah } from '@/lib/utils';
import CreateOrderButton from './CreateOrderButton';

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  if (!year || !month || !day) return '—';
  return `${day}/${month}/${year}`;
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Draft: 'bg-[#EFEBE2] text-muted border-transparent',
    Ordered: 'bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]',
    'In Shipping': 'bg-[#EEF4FB] text-[#2B6CB0] border-[#C3D9F2]',
    Active: 'bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]',
    Completed: 'bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]',
    Cancelled: 'bg-[#FBEBE8] text-[#A63222] border-[#E8C0B9]',
  };
  const cls = styles[status] || 'bg-[#EFEBE2] text-muted border-transparent';
  return (
    <span
      className={`inline-block text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border whitespace-nowrap ${cls}`}
    >
      {status}
    </span>
  );
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    from?: string;
    to?: string;
    status?: string;
    view?: string;
    page?: string;
    sort?: string;
    order?: string;
  }>;
}) {
  const resolvedParams = await searchParams;
  const currentTab = resolvedParams.tab === 'all' ? 'all' : 'queue';
  const searchQuery = (resolvedParams.search || '').trim().toLowerCase();
  const fromDate = resolvedParams.from || '';
  const toDate = resolvedParams.to || '';
  const statusFilter = resolvedParams.status || 'all';
  const viewFilter = resolvedParams.view || (currentTab === 'all' ? 'all' : 'active');
  const currentPage = Math.max(1, parseInt(resolvedParams.page || '1', 10));
  const sortBy = resolvedParams.sort || 'date';
  const sortOrder = resolvedParams.order === 'asc' ? 'asc' : 'desc';
  const PAGE_SIZE = 8;

  const supabase = await createClient();

  const { data: rawOrders } = await supabase
    .from('orders')
    .select(`
      *,
      customers (
        id,
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

  const allOrders = (rawOrders || []).map((o: any) => {
    const custName = `${o.customers?.first_name || ''} ${o.customers?.last_name || ''}`.trim() || 'Guest';
    const firstSku = o.order_products?.[0]?.item_sku || '—';
    const totalRevenue = Number(o.total_price) || 0;
    const totalDeposit = Number(o.total_deposit) || 0;
    const grandTotal = Number(o.total) || 0;

    return {
      ...o,
      customerName: custName,
      isKtpPending: o.customers?.status !== 'Verified',
      productSku: firstSku,
      revenueFormatted: totalRevenue > 0 ? formatRupiah(totalRevenue) : '—',
      depositFormatted: totalDeposit > 0 ? formatRupiah(totalDeposit) : '—',
      totalFormatted: formatRupiah(grandTotal),
    };
  });

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(tomorrowDate);

  // Work Queue Categories
  const packTodayOrders = allOrders.filter(
    (o) =>
      ['Ordered', 'Draft'].includes(o.status) &&
      !o.isKtpPending &&
      o.pickup_date &&
      o.pickup_date <= todayStr
  );

  const prepareTomorrowOrders = allOrders.filter(
    (o) =>
      ['Ordered', 'Draft'].includes(o.status) &&
      !o.isKtpPending &&
      o.pickup_date &&
      o.pickup_date === tomorrowStr
  );

  const heldKtpOrders = allOrders.filter(
    (o) => o.isKtpPending && ['Ordered', 'Draft'].includes(o.status)
  );

  // Filter logic for All Orders Tab
  let filtered = allOrders;

  if (searchQuery) {
    filtered = filtered.filter(
      (o) =>
        o.id.toLowerCase().includes(searchQuery) ||
        o.customerName.toLowerCase().includes(searchQuery) ||
        (o.city || '').toLowerCase().includes(searchQuery) ||
        o.productSku.toLowerCase().includes(searchQuery)
    );
  }

  if (statusFilter !== 'all') {
    filtered = filtered.filter((o) => (o.status || '').toLowerCase() === statusFilter.toLowerCase());
  }

  if (fromDate) {
    filtered = filtered.filter((o) => o.order_date && o.order_date >= fromDate);
  }

  if (toDate) {
    filtered = filtered.filter((o) => o.order_date && o.order_date <= toDate);
  }

  if (viewFilter === 'active') {
    filtered = filtered.filter((o) => !['Completed', 'Cancelled'].includes(o.status));
  }

  // Column Sorting Engine
  filtered.sort((a, b) => {
    let valA: any = a.order_date || '';
    let valB: any = b.order_date || '';

    switch (sortBy) {
      case 'id':
        valA = a.id;
        valB = b.id;
        break;
      case 'customer':
        valA = a.customerName.toLowerCase();
        valB = b.customerName.toLowerCase();
        break;
      case 'status':
        valA = (a.status || '').toLowerCase();
        valB = (b.status || '').toLowerCase();
        break;
      case 'city':
        valA = (a.city || '').toLowerCase();
        valB = (b.city || '').toLowerCase();
        break;
      case 'product':
        valA = a.productSku.toLowerCase();
        valB = b.productSku.toLowerCase();
        break;
      case 'pickup':
        valA = a.pickup_date || '';
        valB = b.pickup_date || '';
        break;
      case 'return':
        valA = a.return_date || '';
        valB = b.return_date || '';
        break;
      case 'revenue':
        valA = Number(a.total_price) || 0;
        valB = Number(b.total_price) || 0;
        break;
      case 'deposit':
        valA = Number(a.total_deposit) || 0;
        valB = Number(b.total_deposit) || 0;
        break;
      case 'total':
        valA = Number(a.total) || 0;
        valB = Number(b.total) || 0;
        break;
      case 'date':
      default:
        valA = a.order_date || '';
        valB = b.order_date || '';
        break;
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalResults = filtered.length;
  const totalPages = Math.ceil(totalResults / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalResults);
  const paginatedOrders = filtered.slice(startIndex, endIndex);

  // Safe Query String Builder that preserves explicit tab states
  const buildQueryString = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | number> = {
      tab: currentTab,
      search: searchQuery,
      from: fromDate,
      to: toDate,
      status: statusFilter,
      view: viewFilter,
      sort: sortBy,
      order: sortOrder,
      page: currentPage,
      ...overrides,
    };

    if (merged.tab === 'all') {
      params.set('tab', 'all');
    }
    if (merged.search) {
      params.set('search', String(merged.search));
    }
    if (merged.from) {
      params.set('from', String(merged.from));
    }
    if (merged.to) {
      params.set('to', String(merged.to));
    }
    if (merged.status && merged.status !== 'all') {
      params.set('status', String(merged.status));
    }
    if (merged.tab === 'all') {
      if (merged.view && merged.view !== 'all') {
        params.set('view', String(merged.view));
      }
    } else {
      if (merged.view && merged.view !== 'active') {
        params.set('view', String(merged.view));
      }
    }
    if (merged.sort && (merged.sort !== 'date' || merged.order === 'asc')) {
      params.set('sort', String(merged.sort));
      params.set('order', String(merged.order));
    }
    if (merged.page && Number(merged.page) > 1) {
      params.set('page', String(merged.page));
    }

    const str = params.toString();
    return str ? `?${str}` : '/admin/orders';
  };

  const renderSortHeader = (field: string, label: string, align: 'left' | 'right' = 'left') => {
    const isActive = sortBy === field;
    const nextOrder = isActive && sortOrder === 'asc' ? 'desc' : 'asc';
    const indicator = isActive ? (sortOrder === 'asc' ? '▲' : '▼') : '▾';

    return (
      <th className={`px-3 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
        <Link
          href={buildQueryString({ sort: field, order: nextOrder, page: 1 })}
          className="inline-flex items-center gap-1 text-muted hover:text-ink transition cursor-pointer select-none"
        >
          <span>{label}</span>
          <span className={isActive ? 'text-wine-ink font-bold' : 'text-muted/60'}>{indicator}</span>
        </Link>
      </th>
    );
  };

  const exportParams = new URLSearchParams();
  if (searchQuery) exportParams.set('search', searchQuery);
  if (fromDate) exportParams.set('from', fromDate);
  if (toDate) exportParams.set('to', toDate);
  if (statusFilter !== 'all') exportParams.set('status', statusFilter);
  if (viewFilter !== 'all') exportParams.set('view', viewFilter);
  const exportHref = `/admin/orders/export${exportParams.toString() ? `?${exportParams.toString()}` : ''}`;

  return (
    <div className="mx-auto pb-24 font-sans text-ink">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">
            Operations
          </div>
          <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink">
            Orders
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href={exportHref}
            download
            className="px-4 py-2 border border-line bg-card rounded-lg text-[13px] font-medium hover:bg-[#F6F4EF] transition inline-block"
          >
            Export CSV
          </a>
          <CreateOrderButton />
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-5 border-b border-line mb-6">
        <Link
          href="/admin/orders"
          className={`pb-2.5 text-sm font-medium transition-colors ${
            currentTab === 'queue' ? 'text-wine-ink border-b-2 border-wine' : 'text-muted hover:text-ink'
          }`}
        >
          Work Queue
        </Link>
        <Link
          href="/admin/orders?tab=all"
          className={`pb-2.5 text-sm font-medium transition-colors ${
            currentTab === 'all' ? 'text-wine-ink border-b-2 border-wine' : 'text-muted hover:text-ink'
          }`}
        >
          All Orders
        </Link>
      </div>

      {/* TAB 1: WORK QUEUE */}
      {currentTab === 'queue' && (
        <div className="space-y-7">
          {/* SECTION 1: PACK & DISPATCH TODAY */}
          <div>
            <div className="text-[12px] font-bold tracking-[0.12em] uppercase text-wine-ink mb-2.5 flex items-center gap-2">
              <span>PACK & DISPATCH TODAY</span>
              <span>—</span>
              <span>{packTodayOrders.length}</span>
            </div>

            <div className="bg-card border border-line rounded-[10px] p-2 pb-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)] mb-2">
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[1020px]">
                  <thead>
                    <tr className="border-b border-line text-[10.5px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Order ID</th>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">City</th>
                      <th className="px-3 py-2.5">Product</th>
                      <th className="px-3 py-2.5">Pick Up/Send</th>
                      <th className="px-3 py-2.5">Return</th>
                      <th className="px-3 py-2.5 text-right">Revenue</th>
                      <th className="px-3 py-2.5 text-right">Deposit</th>
                      <th className="px-3 py-2.5 text-right">Total</th>
                      <th className="px-3 py-2.5">Courier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packTodayOrders.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-3 py-6 text-center text-muted">
                          No pending packages scheduled for dispatch today.
                        </td>
                      </tr>
                    ) : (
                      packTodayOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                          <td className="px-3 py-3 text-muted">{formatDate(o.order_date)}</td>
                          <td className="px-3 py-3 font-bold text-ink">
                            <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                              {o.id}
                            </Link>
                          </td>
                          <td className="px-3 py-3">{o.customerName}</td>
                          <td className="px-3 py-3">
                            <StatusPill status={o.status} />
                          </td>
                          <td className="px-3 py-3 text-muted">{o.city || '—'}</td>
                          <td className="px-3 py-3 font-mono text-xs">{o.productSku}</td>
                          <td className="px-3 py-3 font-medium text-wine-ink">{formatDate(o.pickup_date)}</td>
                          <td className="px-3 py-3 text-muted">{formatDate(o.return_date)}</td>
                          <td className="px-3 py-3 text-right">{o.revenueFormatted}</td>
                          <td className="px-3 py-3 text-right">{o.depositFormatted}</td>
                          <td className="px-3 py-3 text-right font-bold">{o.totalFormatted}</td>
                          <td className="px-3 py-3 text-muted text-xs">{o.pick_up_method || 'Paxel'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[11.5px] text-muted">
              Courier pickup is scheduled for these send dates — pack now, then press In Shipping on each order.
            </p>
          </div>

          {/* SECTION 2: PREPARE FOR TOMORROW */}
          <div>
            <div className="text-[12px] font-bold tracking-[0.12em] uppercase text-ink mb-2.5 flex items-center gap-2">
              <span>PREPARE FOR TOMORROW</span>
              <span>—</span>
              <span>{prepareTomorrowOrders.length}</span>
            </div>

            <div className="bg-card border border-line rounded-[10px] p-2 pb-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)] mb-2">
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[1020px]">
                  <thead>
                    <tr className="border-b border-line text-[10.5px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Order ID</th>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">City</th>
                      <th className="px-3 py-2.5">Product</th>
                      <th className="px-3 py-2.5">Pick Up/Send</th>
                      <th className="px-3 py-2.5">Return</th>
                      <th className="px-3 py-2.5 text-right">Revenue</th>
                      <th className="px-3 py-2.5 text-right">Deposit</th>
                      <th className="px-3 py-2.5 text-right">Total</th>
                      <th className="px-3 py-2.5">Courier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepareTomorrowOrders.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-3 py-6 text-center text-muted">
                          No packages queued for tomorrow.
                        </td>
                      </tr>
                    ) : (
                      prepareTomorrowOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                          <td className="px-3 py-3 text-muted">{formatDate(o.order_date)}</td>
                          <td className="px-3 py-3 font-bold text-ink">
                            <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                              {o.id}
                            </Link>
                          </td>
                          <td className="px-3 py-3">{o.customerName}</td>
                          <td className="px-3 py-3">
                            <StatusPill status={o.status} />
                          </td>
                          <td className="px-3 py-3 text-muted">{o.city || '—'}</td>
                          <td className="px-3 py-3 font-mono text-xs">{o.productSku}</td>
                          <td className="px-3 py-3 font-medium">{formatDate(o.pickup_date)}</td>
                          <td className="px-3 py-3 text-muted">{formatDate(o.return_date)}</td>
                          <td className="px-3 py-3 text-right">{o.revenueFormatted}</td>
                          <td className="px-3 py-3 text-right">{o.depositFormatted}</td>
                          <td className="px-3 py-3 text-right font-bold">{o.totalFormatted}</td>
                          <td className="px-3 py-3 text-muted text-xs">{o.pick_up_method || 'Paxel'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[11.5px] text-muted">
              Send date is tomorrow — steam, pack, and confirm the address via WhatsApp today.
            </p>
          </div>

          {/* SECTION 3: HELD — KTP UNVERIFIED */}
          <div>
            <div className="text-[12px] font-bold tracking-[0.12em] uppercase text-warn-ink mb-2.5 flex items-center gap-2">
              <span>HELD — KTP UNVERIFIED</span>
              <span>—</span>
              <span>{heldKtpOrders.length}</span>
            </div>

            <div className="bg-card border border-line rounded-[10px] p-2 pb-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)] mb-2">
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[1020px]">
                  <thead>
                    <tr className="border-b border-line text-[10.5px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Order ID</th>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">City</th>
                      <th className="px-3 py-2.5">Product</th>
                      <th className="px-3 py-2.5">Pick Up/Send</th>
                      <th className="px-3 py-2.5">Return</th>
                      <th className="px-3 py-2.5 text-right">Revenue</th>
                      <th className="px-3 py-2.5 text-right">Deposit</th>
                      <th className="px-3 py-2.5 text-right">Total</th>
                      <th className="px-3 py-2.5">Courier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heldKtpOrders.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-3 py-6 text-center text-muted">
                          No orders currently blocked by KTP verification.
                        </td>
                      </tr>
                    ) : (
                      heldKtpOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                          <td className="px-3 py-3 text-muted">{formatDate(o.order_date)}</td>
                          <td className="px-3 py-3 font-bold text-ink">
                            <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                              {o.id}
                            </Link>
                          </td>
                          <td className="px-3 py-3">
                            <span className="mr-1.5">{o.customerName}</span>
                            <span className="bg-[#F8EED9] text-[#977028] text-[9px] font-bold px-1.5 py-0.5 rounded">
                              KTP
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <StatusPill status={o.status} />
                          </td>
                          <td className="px-3 py-3 text-muted">{o.city || '—'}</td>
                          <td className="px-3 py-3 font-mono text-xs">{o.productSku}</td>
                          <td className="px-3 py-3 text-muted">{formatDate(o.pickup_date)}</td>
                          <td className="px-3 py-3 text-muted">{formatDate(o.return_date)}</td>
                          <td className="px-3 py-3 text-right">{o.revenueFormatted}</td>
                          <td className="px-3 py-3 text-right">{o.depositFormatted}</td>
                          <td className="px-3 py-3 text-right font-bold">{o.totalFormatted}</td>
                          <td className="px-3 py-3 text-muted text-xs">{o.pick_up_method || 'Paxel'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[11.5px] text-muted">
              Do not dispatch — review the KTP in the customer profile first.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: ALL ORDERS */}
      {currentTab === 'all' && (
        <div>
          {/* Filters Bar */}
          <form method="GET" className="flex flex-wrap items-center gap-3 mb-4 text-[13px]">
            <input type="hidden" name="tab" value="all" />

            <input
              type="text"
              name="search"
              defaultValue={searchQuery}
              placeholder="Search"
              className="px-3.5 py-1.5 w-44 rounded-lg border border-line bg-card text-ink focus:outline-none focus:ring-1 focus:ring-wine"
            />

            <div className="flex items-center gap-2">
              <span className="text-[11px] tracking-[0.14em] uppercase text-muted font-medium">
                Order Date
              </span>
              <input
                type="date"
                name="from"
                defaultValue={fromDate}
                className="px-2.5 py-1.5 rounded-lg border border-line bg-card text-ink text-xs"
              />
              <span className="text-muted text-xs">to</span>
              <input
                type="date"
                name="to"
                defaultValue={toDate}
                className="px-2.5 py-1.5 rounded-lg border border-line bg-card text-ink text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] tracking-[0.14em] uppercase text-muted font-medium">
                Status
              </span>
              <select
                name="status"
                defaultValue={statusFilter}
                className="px-3 py-1.5 rounded-lg border border-line bg-card text-ink text-xs cursor-pointer"
              >
                <option value="all">Status (All) ▾</option>
                <option value="Draft">Draft</option>
                <option value="Ordered">Ordered</option>
                <option value="In Shipping">In Shipping</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <select
              name="view"
              defaultValue={viewFilter}
              className="px-3 py-1.5 rounded-lg border border-line bg-card text-ink text-xs cursor-pointer"
            >
              <option value="all">View: All Orders ▾</option>
              <option value="active">View: Active Work ▾</option>
            </select>

            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-muted hover:text-ink hover:bg-[#F6F4EF] transition cursor-pointer"
            >
              Filter
            </button>

            {(searchQuery || fromDate || toDate || statusFilter !== 'all' || viewFilter !== 'all') && (
              <Link
                href="/admin/orders?tab=all"
                className="text-xs text-muted hover:text-bad underline ml-1"
              >
                Reset
              </Link>
            )}
          </form>

          {/* Pagination */}
          <div className="flex justify-end items-center gap-2 mb-2.5 text-xs text-muted">
            <span>
              {totalResults === 0 ? '0 of 0' : `${startIndex + 1}-${endIndex} of ${totalResults}`}
            </span>
            <div className="flex items-center gap-1 ml-1">
              <Link
                href={buildQueryString({ page: Math.max(1, currentPage - 1) })}
                className={`w-6 h-6 flex items-center justify-center border border-line rounded bg-card hover:bg-[#F6F4EF] ${
                  currentPage <= 1 ? 'pointer-events-none opacity-40' : ''
                }`}
              >
                ‹
              </Link>
              <Link
                href={buildQueryString({ page: Math.min(totalPages, currentPage + 1) })}
                className={`w-6 h-6 flex items-center justify-center border border-line rounded bg-card hover:bg-[#F6F4EF] ${
                  currentPage >= totalPages ? 'pointer-events-none opacity-40' : ''
                }`}
              >
                ›
              </Link>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-line rounded-[10px] p-2 pb-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)] mb-4">
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[1020px]">
                <thead>
                  <tr className="border-b border-line text-[10.5px] tracking-[0.14em] uppercase text-muted font-medium">
                    {renderSortHeader('date', 'Date')}
                    {renderSortHeader('id', 'Order ID')}
                    {renderSortHeader('customer', 'Customer')}
                    {renderSortHeader('status', 'Status')}
                    {renderSortHeader('city', 'City')}
                    {renderSortHeader('product', 'Product')}
                    {renderSortHeader('pickup', 'Pick Up/Send')}
                    {renderSortHeader('return', 'Return')}
                    {renderSortHeader('revenue', 'Revenue', 'right')}
                    {renderSortHeader('deposit', 'Deposit', 'right')}
                    {renderSortHeader('total', 'Total', 'right')}
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-12 text-center text-muted">
                        No orders match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                        <td className="px-3 py-3.5 text-muted">{formatDate(o.order_date)}</td>
                        <td className="px-3 py-3.5 font-bold text-ink">
                          <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                            {o.id}
                          </Link>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="mr-1.5">{o.customerName}</span>
                          {o.isKtpPending && (
                            <span className="bg-[#F8EED9] text-[#977028] text-[9px] font-bold px-1.5 py-0.5 rounded">
                              KTP
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <StatusPill status={o.status} />
                        </td>
                        <td className="px-3 py-3.5 text-muted">{o.city || '—'}</td>
                        <td className="px-3 py-3.5 font-mono text-xs">{o.productSku}</td>
                        <td className="px-3 py-3.5">{formatDate(o.pickup_date)}</td>
                        <td className="px-3 py-3.5 text-muted">{formatDate(o.return_date)}</td>
                        <td className="px-3 py-3.5 text-right">{o.revenueFormatted}</td>
                        <td className="px-3 py-3.5 text-right">{o.depositFormatted}</td>
                        <td className="px-3 py-3.5 text-right font-bold">{o.totalFormatted}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-3 bg-[#F6F4EF] rounded-lg border border-[#E5E0D6] text-xs text-muted">
            <strong>ID convention:</strong> S-prefixed IDs are website orders, M-prefixed are manual (created here by staff).
          </div>
        </div>
      )}
    </div>
  );
}

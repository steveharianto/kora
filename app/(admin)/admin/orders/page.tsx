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
  }>;
}) {
  const resolvedParams = await searchParams;
  const currentTab = resolvedParams.tab || 'queue';
  const searchQuery = (resolvedParams.search || '').trim().toLowerCase();
  const fromDate = resolvedParams.from || '';
  const toDate = resolvedParams.to || '';
  const statusFilter = resolvedParams.status || 'all';
  const viewFilter = resolvedParams.view || 'active';
  const currentPage = Math.max(1, parseInt(resolvedParams.page || '1', 10));
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

  // Calculate local date (Asia/Jakarta)
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

  const totalResults = filtered.length;
  const totalPages = Math.ceil(totalResults / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalResults);
  const paginatedOrders = filtered.slice(startIndex, endIndex);

  // Helper to preserve filters across tab and page switches
  const buildQueryString = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    const current: Record<string, string | number> = {
      tab: currentTab,
      search: searchQuery,
      from: fromDate,
      to: toDate,
      status: statusFilter,
      view: viewFilter,
      page: currentPage,
      ...overrides,
    };

    Object.entries(current).forEach(([k, v]) => {
      if (v && v !== 'all' && !(k === 'page' && Number(v) === 1)) {
        params.set(k, String(v));
      }
    });

    const str = params.toString();
    return str ? `?${str}` : '/admin/orders';
  };

  // Forward filter state to CSV export handler
  const exportParams = new URLSearchParams();
  if (searchQuery) exportParams.set('search', searchQuery);
  if (fromDate) exportParams.set('from', fromDate);
  if (toDate) exportParams.set('to', toDate);
  if (statusFilter !== 'all') exportParams.set('status', statusFilter);
  if (viewFilter !== 'all') exportParams.set('view', viewFilter);
  const exportHref = `/admin/orders/export${exportParams.toString() ? `?${exportParams.toString()}` : ''}`;

  return (
    <div className="max-w-[1250px] pb-24 font-sans text-ink">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">
            Operations
          </div>
          <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink">
            Orders Page
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

      {/* Primary Tab Bar */}
      <div className="flex gap-5 border-b border-line mb-6">
        <Link
          href={buildQueryString({ tab: 'queue', page: 1 })}
          className={`pb-2.5 text-sm font-medium transition-colors ${
            currentTab === 'queue' ? 'text-wine-ink border-b-2 border-wine' : 'text-muted hover:text-ink'
          }`}
        >
          Work Queue
        </Link>
        <Link
          href={buildQueryString({ tab: 'all', page: 1 })}
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
                <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[980px]">
                  <thead>
                    <tr className="border-b border-line text-[10.5px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                      <th className="px-3 py-2.5">Date ▾</th>
                      <th className="px-3 py-2.5">Order ID ▾</th>
                      <th className="px-3 py-2.5">Customer ▾</th>
                      <th className="px-3 py-2.5">City ▾</th>
                      <th className="px-3 py-2.5">Product ▾</th>
                      <th className="px-3 py-2.5">Pick Up/Send ▾</th>
                      <th className="px-3 py-2.5">Return ▾</th>
                      <th className="px-3 py-2.5">Revenue ▾</th>
                      <th className="px-3 py-2.5">Deposit ▾</th>
                      <th className="px-3 py-2.5">Total ▾</th>
                      <th className="px-3 py-2.5">Courier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packTodayOrders.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-3 py-6 text-center text-muted">
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
                          <td className="px-3 py-3 text-muted">{o.city || '—'}</td>
                          <td className="px-3 py-3 font-mono text-xs">{o.productSku}</td>
                          <td className="px-3 py-3 font-medium text-wine-ink">{formatDate(o.pickup_date)}</td>
                          <td className="px-3 py-3 text-muted">{formatDate(o.return_date)}</td>
                          <td className="px-3 py-3">{o.revenueFormatted}</td>
                          <td className="px-3 py-3">{o.depositFormatted}</td>
                          <td className="px-3 py-3 font-bold">{o.totalFormatted}</td>
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
                <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[980px]">
                  <thead>
                    <tr className="border-b border-line text-[10.5px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                      <th className="px-3 py-2.5">Date ▾</th>
                      <th className="px-3 py-2.5">Order ID ▾</th>
                      <th className="px-3 py-2.5">Customer ▾</th>
                      <th className="px-3 py-2.5">City ▾</th>
                      <th className="px-3 py-2.5">Product ▾</th>
                      <th className="px-3 py-2.5">Pick Up/Send ▾</th>
                      <th className="px-3 py-2.5">Return ▾</th>
                      <th className="px-3 py-2.5">Revenue ▾</th>
                      <th className="px-3 py-2.5">Deposit ▾</th>
                      <th className="px-3 py-2.5">Total ▾</th>
                      <th className="px-3 py-2.5">Courier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepareTomorrowOrders.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-3 py-6 text-center text-muted">
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
                          <td className="px-3 py-3 text-muted">{o.city || '—'}</td>
                          <td className="px-3 py-3 font-mono text-xs">{o.productSku}</td>
                          <td className="px-3 py-3 font-medium">{formatDate(o.pickup_date)}</td>
                          <td className="px-3 py-3 text-muted">{formatDate(o.return_date)}</td>
                          <td className="px-3 py-3">{o.revenueFormatted}</td>
                          <td className="px-3 py-3">{o.depositFormatted}</td>
                          <td className="px-3 py-3 font-bold">{o.totalFormatted}</td>
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
                <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[980px]">
                  <thead>
                    <tr className="border-b border-line text-[10.5px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                      <th className="px-3 py-2.5">Date ▾</th>
                      <th className="px-3 py-2.5">Order ID ▾</th>
                      <th className="px-3 py-2.5">Customer ▾</th>
                      <th className="px-3 py-2.5">City ▾</th>
                      <th className="px-3 py-2.5">Product ▾</th>
                      <th className="px-3 py-2.5">Pick Up/Send ▾</th>
                      <th className="px-3 py-2.5">Return ▾</th>
                      <th className="px-3 py-2.5">Revenue ▾</th>
                      <th className="px-3 py-2.5">Deposit ▾</th>
                      <th className="px-3 py-2.5">Total ▾</th>
                      <th className="px-3 py-2.5">Courier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heldKtpOrders.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-3 py-6 text-center text-muted">
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
                          <td className="px-3 py-3 text-muted">{o.city || '—'}</td>
                          <td className="px-3 py-3 font-mono text-xs">{o.productSku}</td>
                          <td className="px-3 py-3 text-muted">{formatDate(o.pickup_date)}</td>
                          <td className="px-3 py-3 text-muted">{formatDate(o.return_date)}</td>
                          <td className="px-3 py-3">{o.revenueFormatted}</td>
                          <td className="px-3 py-3">{o.depositFormatted}</td>
                          <td className="px-3 py-3 font-bold">{o.totalFormatted}</td>
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
                <option value="all">Status (5/7) ▾</option>
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
              <option value="active">View: Active Work ▾</option>
              <option value="all">View: All Orders ▾</option>
            </select>

            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-muted hover:text-ink hover:bg-[#F6F4EF] transition cursor-pointer"
            >
              Filter
            </button>
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
              <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[980px]">
                <thead>
                  <tr className="border-b border-line text-[10.5px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                    <th className="px-3 py-3">Date ▾</th>
                    <th className="px-3 py-3">Order ID ▾</th>
                    <th className="px-3 py-3">Customer ▾</th>
                    <th className="px-3 py-3">City ▾</th>
                    <th className="px-3 py-3">Product ▾</th>
                    <th className="px-3 py-3">Pick Up/Send ▾</th>
                    <th className="px-3 py-3">Return ▾</th>
                    <th className="px-3 py-3">Revenue ▾</th>
                    <th className="px-3 py-3">Deposit ▾</th>
                    <th className="px-3 py-3">Total ▾</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-12 text-center text-muted">
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
                        <td className="px-3 py-3.5 text-muted">{o.city || '—'}</td>
                        <td className="px-3 py-3.5 font-mono text-xs">{o.productSku}</td>
                        <td className="px-3 py-3.5">{formatDate(o.pickup_date)}</td>
                        <td className="px-3 py-3.5 text-muted">{formatDate(o.return_date)}</td>
                        <td className="px-3 py-3.5">{o.revenueFormatted}</td>
                        <td className="px-3 py-3.5">{o.depositFormatted}</td>
                        <td className="px-3 py-3.5 font-bold">{o.totalFormatted}</td>
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

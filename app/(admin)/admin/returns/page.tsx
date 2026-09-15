import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatRupiah } from '@/lib/utils';
import { Plus } from 'lucide-react';

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  if (!year || !month || !day) return '—';
  return `${day}/${month}/${year}`;
}

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    status?: string;
  }>;
}) {
  const resolvedParams = await searchParams;
  const currentTab = resolvedParams.tab || 'queue';
  const searchQuery = (resolvedParams.search || '').trim().toLowerCase();
  const statusFilter = resolvedParams.status || 'all';

  const supabase = await createClient();

  // 1. Fetch all returns with relations
  const { data: rawReturns } = await supabase
    .from('returns')
    .select(`
      *,
      orders (
        id,
        return_date,
        order_products (
          item_sku,
          items (
            name
          )
        )
      ),
      customers (
        id,
        first_name,
        last_name,
        phone
      )
    `)
    .order('requested_at', { ascending: false });

  // 2. Fetch active orders that don't have a return record yet
  const { data: activeOrders } = await supabase
    .from('orders')
    .select(`
      id,
      return_date,
      total_deposit,
      customers (
        id,
        first_name,
        last_name,
        phone
      ),
      order_products (
        item_sku,
        items (
          name
        )
      )
    `)
    .in('status', ['Active', 'In Shipping'])
    .order('return_date', { ascending: true });

  const existingReturnOrderIds = new Set((rawReturns || []).map((r) => r.order_id));

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(tomorrowDate);

  const getAgingBadge = (deadlineStr?: string | null) => {
    if (!deadlineStr) return { text: '—', color: 'muted' };
    const [dy, dm, dd] = deadlineStr.split('-').map(Number);
    const deadline = new Date(dy, dm - 1, dd).getTime();

    const [ty, tm, td] = todayStr.split('-').map(Number);
    const today = new Date(ty, tm - 1, td).getTime();

    const diffDays = Math.round((today - deadline) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { text: 'DUE TODAY', color: 'amber' };
    if (diffDays === -1) return { text: 'DUE TOMORROW', color: 'amber' };
    if (diffDays > 0) return { text: `${diffDays} D LATE`, color: 'bad' };
    return { text: 'ON TIME', color: 'green' };
  };

  const formattedReturns = (rawReturns || []).map((r: any) => {
    const custName = `${r.customers?.first_name || ''} ${r.customers?.last_name || ''}`.trim() || 'Customer';
    const firstItem = r.orders?.order_products?.[0]?.item_sku || 'Garment';
    const deadline = r.orders?.return_date;
    const aging = getAgingBadge(deadline);

    return {
      ...r,
      customerName: custName,
      firstItem,
      deadline,
      aging,
    };
  });

  // Groupings for Work Queue
  const needsAction = formattedReturns.filter(
    (r) =>
      r.status === 'Received' ||
      r.status === 'Requested' ||
      (r.status === 'Shipping' && r.deadline && r.deadline <= todayStr)
  );

  // Orders without return request ending today or tomorrow
  const dueSoonUnrequestedOrders = (activeOrders || [])
    .filter(
      (o) =>
        !existingReturnOrderIds.has(o.id) &&
        (o.return_date === todayStr || o.return_date === tomorrowStr)
    )
    .map((o: any) => ({
      id: `NO-REQ-${o.id}`,
      order_id: o.id,
      customerName: `${o.customers?.first_name || ''} ${o.customers?.last_name || ''}`.trim(),
      firstItem: o.order_products?.[0]?.item_sku || 'Garment',
      return_method: '—',
      deadline: o.return_date,
      aging: getAgingBadge(o.return_date),
      waybill_id: '—',
      deposit_held: o.total_deposit || 150000,
      status: 'NO REQUEST',
      requested_at: null,
      isPlaceholder: true,
    }));

  // Orders without return request that are already overdue
  const overdueUnrequestedOrders = (activeOrders || [])
    .filter((o) => !existingReturnOrderIds.has(o.id) && o.return_date && o.return_date < todayStr)
    .map((o: any) => ({
      id: `NO-REQ-${o.id}`,
      order_id: o.id,
      customerName: `${o.customers?.first_name || ''} ${o.customers?.last_name || ''}`.trim(),
      firstItem: o.order_products?.[0]?.item_sku || 'Garment',
      return_method: '—',
      deadline: o.return_date,
      aging: getAgingBadge(o.return_date),
      waybill_id: '—',
      deposit_held: o.total_deposit || 150000,
      status: 'NO REQUEST',
      requested_at: null,
      isPlaceholder: true,
    }));

  const overdueShippingReturns = formattedReturns.filter(
    (r) => r.status === 'Shipping' && r.deadline && r.deadline < todayStr
  );

  const overdueGroup = [...overdueShippingReturns, ...overdueUnrequestedOrders];

  let filteredAll = formattedReturns;
  if (searchQuery) {
    filteredAll = filteredAll.filter(
      (r) =>
        r.id.toLowerCase().includes(searchQuery) ||
        r.order_id.toLowerCase().includes(searchQuery) ||
        r.customerName.toLowerCase().includes(searchQuery) ||
        (r.waybill_id || '').toLowerCase().includes(searchQuery)
    );
  }
  if (statusFilter !== 'all') {
    filteredAll = filteredAll.filter((r) => r.status.toLowerCase() === statusFilter.toLowerCase());
  }

  return (
    <div className="max-w-[1250px] pb-24 font-sans text-ink">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">
            Operations
          </div>
          <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink">
            Returns
          </h1>
        </div>

        <Link
          href="/admin/returns/new"
          className="px-4 py-2 bg-[#1A1F16] text-white rounded-lg text-xs font-semibold hover:bg-black transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          + Create Return Request
        </Link>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-5 border-b border-line mb-6">
        <Link
          href="?tab=queue"
          className={`pb-2.5 text-sm font-medium transition-colors ${
            currentTab === 'queue' ? 'text-wine-ink border-b-2 border-wine' : 'text-muted hover:text-ink'
          }`}
        >
          Work queue
        </Link>
        <Link
          href="?tab=all"
          className={`pb-2.5 text-sm font-medium transition-colors ${
            currentTab === 'all' ? 'text-wine-ink border-b-2 border-wine' : 'text-muted hover:text-ink'
          }`}
        >
          All returns
        </Link>
      </div>

      {/* TAB 1: WORK QUEUE */}
      {currentTab === 'queue' && (
        <div className="space-y-7">
          {/* SECTION 1: NEEDS ACTION */}
          <div>
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine-ink mb-2.5">
              NEEDS ACTION — {needsAction.length}
            </div>

            <div className="bg-card border border-line rounded-[10px] p-2 pb-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[950px]">
                  <thead>
                    <tr className="border-b border-line text-[10px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                      <th className="px-3 py-2.5">Requested</th>
                      <th className="px-3 py-2.5">Order ID</th>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5">Item</th>
                      <th className="px-3 py-2.5">Method</th>
                      <th className="px-3 py-2.5">Deadline</th>
                      <th className="px-3 py-2.5">Aging</th>
                      <th className="px-3 py-2.5">Resi</th>
                      <th className="px-3 py-2.5">Deposit</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {needsAction.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-6 text-center text-muted text-xs">
                          No pending return actions needed.
                        </td>
                      </tr>
                    ) : (
                      needsAction.map((r) => (
                        <tr key={r.id} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                          <td className="px-3 py-3 text-muted">{formatDate(r.requested_at)}</td>
                          <td className="px-3 py-3 font-bold text-ink">
                            <Link href={`/admin/returns/${r.id}`} className="hover:underline">
                              {r.order_id}
                            </Link>
                          </td>
                          <td className="px-3 py-3 font-medium">{r.customerName}</td>
                          <td className="px-3 py-3 font-mono text-xs">{r.firstItem}</td>
                          <td className="px-3 py-3 text-muted text-xs truncate max-w-[140px]">
                            {r.return_method.includes('Biteship') ? 'KORA arrang...' : 'Self-return'}
                          </td>
                          <td className="px-3 py-3 text-muted">{formatDate(r.deadline)}</td>
                          <td className="px-3 py-3">
                            <span
                              className={`text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                r.aging.color === 'bad'
                                  ? 'bg-[#FBEBE8] text-[#A63222] border-[#E8C0B9]'
                                  : 'bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]'
                              }`}
                            >
                              {r.aging.text}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-muted">{r.waybill_id || '—'}</td>
                          <td className="px-3 py-3 font-medium">{formatRupiah(Number(r.deposit_held))}</td>
                          <td className="px-3 py-3">
                            <span
                              className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${
                                r.status === 'Received'
                                  ? 'bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]'
                                  : r.status === 'Shipping'
                                  ? 'bg-[#EEF4FB] text-[#2B6CB0] border-[#C3D9F2]'
                                  : 'bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECTION 2: DEADLINE TODAY & TOMORROW */}
          <div>
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted mb-2.5">
              DEADLINE TODAY & TOMORROW — {dueSoonUnrequestedOrders.length}
            </div>

            <div className="bg-card border border-line rounded-[10px] p-2 pb-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[950px]">
                  <thead>
                    <tr className="border-b border-line text-[10px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                      <th className="px-3 py-2.5">Requested</th>
                      <th className="px-3 py-2.5">Order ID</th>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5">Item</th>
                      <th className="px-3 py-2.5">Method</th>
                      <th className="px-3 py-2.5">Deadline</th>
                      <th className="px-3 py-2.5">Aging</th>
                      <th className="px-3 py-2.5">Resi</th>
                      <th className="px-3 py-2.5">Deposit</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueSoonUnrequestedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-6 text-center text-muted text-xs">
                          No upcoming returns scheduled for today or tomorrow.
                        </td>
                      </tr>
                    ) : (
                      dueSoonUnrequestedOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                          <td className="px-3 py-3 text-muted">—</td>
                          <td className="px-3 py-3 font-bold text-ink">
                            <Link href={`/admin/orders/${o.order_id}`} className="hover:underline">
                              {o.order_id}
                            </Link>
                          </td>
                          <td className="px-3 py-3 font-medium">{o.customerName}</td>
                          <td className="px-3 py-3 font-mono text-xs">{o.firstItem}</td>
                          <td className="px-3 py-3 text-muted text-xs">—</td>
                          <td className="px-3 py-3 text-muted">{formatDate(o.deadline)}</td>
                          <td className="px-3 py-3">
                            <span className="bg-[#FDF3DE] text-[#977028] text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-[#F1DFB7]">
                              {o.aging.text}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-muted text-xs">—</td>
                          <td className="px-3 py-3 font-medium">{formatRupiah(Number(o.deposit_held))}</td>
                          <td className="px-3 py-3">
                            <span className="bg-[#FBEBE8] text-[#A63222] text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border border-[#E8C0B9]">
                              NO REQUEST
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECTION 3: OVERDUE */}
          <div>
            <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted mb-2.5">
              OVERDUE — NOTHING IN MOTION — {overdueGroup.length}
            </div>

            <div className="bg-card border border-line rounded-[10px] p-2 pb-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[950px]">
                  <thead>
                    <tr className="border-b border-line text-[10px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                      <th className="px-3 py-2.5">Requested</th>
                      <th className="px-3 py-2.5">Order ID</th>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5">Item</th>
                      <th className="px-3 py-2.5">Method</th>
                      <th className="px-3 py-2.5">Deadline</th>
                      <th className="px-3 py-2.5">Aging</th>
                      <th className="px-3 py-2.5">Resi</th>
                      <th className="px-3 py-2.5">Deposit</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueGroup.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-6 text-center text-muted text-xs">
                          No overdue returns.
                        </td>
                      </tr>
                    ) : (
                      overdueGroup.map((o) => (
                        <tr key={o.id} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                          <td className="px-3 py-3 text-muted">{formatDate(o.requested_at)}</td>
                          <td className="px-3 py-3 font-bold text-ink">
                            <Link
                              href={o.isPlaceholder ? `/admin/orders/${o.order_id}` : `/admin/returns/${o.id}`}
                              className="hover:underline"
                            >
                              {o.order_id}
                            </Link>
                          </td>
                          <td className="px-3 py-3 font-medium">{o.customerName}</td>
                          <td className="px-3 py-3 font-mono text-xs">{o.firstItem}</td>
                          <td className="px-3 py-3 text-muted text-xs truncate max-w-[140px]">
                            {o.return_method?.includes('Biteship') ? 'KORA arrang...' : o.return_method || '—'}
                          </td>
                          <td className="px-3 py-3 text-muted">{formatDate(o.deadline)}</td>
                          <td className="px-3 py-3">
                            <span className="bg-[#FBEBE8] text-[#A63222] text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-[#E8C0B9]">
                              {o.aging.text}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-muted">{o.waybill_id || '—'}</td>
                          <td className="px-3 py-3 font-medium">{formatRupiah(Number(o.deposit_held))}</td>
                          <td className="px-3 py-3">
                            <span
                              className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${
                                o.status === 'Shipping'
                                  ? 'bg-[#EEF4FB] text-[#2B6CB0] border-[#C3D9F2]'
                                  : 'bg-[#FBEBE8] text-[#A63222] border-[#E8C0B9]'
                              }`}
                            >
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL RETURNS */}
      {currentTab === 'all' && (
        <div>
          <form method="GET" className="flex flex-wrap items-center gap-3 mb-4 text-[13px]">
            <input type="hidden" name="tab" value="all" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery}
              placeholder="Search Order ID, Customer, Resi..."
              className="px-3.5 py-1.5 w-64 rounded-lg border border-line bg-card text-ink focus:outline-none focus:ring-1 focus:ring-wine"
            />
            <select
              name="status"
              defaultValue={statusFilter}
              className="px-3 py-1.5 rounded-lg border border-line bg-card text-ink text-xs cursor-pointer"
            >
              <option value="all">Status (All) ▾</option>
              <option value="Requested">Requested</option>
              <option value="Shipping">Shipping</option>
              <option value="Received">Received</option>
              <option value="Completed">Completed</option>
            </select>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg border border-line bg-card text-xs text-muted hover:text-ink hover:bg-[#F6F4EF] transition cursor-pointer"
            >
              Filter
            </button>
          </form>

          <div className="bg-card border border-line rounded-[10px] p-2 pb-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[950px]">
                <thead>
                  <tr className="border-b border-line text-[10px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                    <th className="px-3 py-3">Return ID</th>
                    <th className="px-3 py-3">Order ID</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Method</th>
                    <th className="px-3 py-3">Resi</th>
                    <th className="px-3 py-3">Deposit Held</th>
                    <th className="px-3 py-3">Refund Amount</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAll.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-muted">
                        No return records match your query.
                      </td>
                    </tr>
                  ) : (
                    filteredAll.map((r) => (
                      <tr key={r.id} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                        <td className="px-3 py-3.5 font-bold text-ink">{r.id}</td>
                        <td className="px-3 py-3.5 font-mono text-xs">{r.order_id}</td>
                        <td className="px-3 py-3.5 font-medium">{r.customerName}</td>
                        <td className="px-3 py-3.5 text-xs text-muted truncate max-w-[150px]">{r.return_method}</td>
                        <td className="px-3 py-3.5 font-mono text-xs">{r.waybill_id || '—'}</td>
                        <td className="px-3 py-3.5 font-medium">{formatRupiah(Number(r.deposit_held))}</td>
                        <td className="px-3 py-3.5 font-bold text-wine-ink">{formatRupiah(Number(r.refund_amount))}</td>
                        <td className="px-3 py-3.5">
                          <span
                            className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${
                              r.status === 'Completed'
                                ? 'bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]'
                                : r.status === 'Received'
                                ? 'bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]'
                                : r.status === 'Shipping'
                                ? 'bg-[#EEF4FB] text-[#2B6CB0] border-[#C3D9F2]'
                                : 'bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <Link
                            href={`/admin/returns/${r.id}`}
                            className="px-3 py-1 border border-line rounded text-xs hover:bg-[#F6F4EF] transition font-medium"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

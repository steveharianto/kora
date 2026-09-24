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

function ReturnStatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Completed: 'bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]',
    Received: 'bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]',
    'In Review': 'bg-[#F4EDF7] text-[#6B3A8C] border-[#D9C2E8]',
    Shipping: 'bg-[#EEF4FB] text-[#2B6CB0] border-[#C3D9F2]',
    Requested: 'bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]',
    'NO REQUEST': 'bg-[#FBEBE8] text-[#A63222] border-[#E8C0B9]',
  };
  const cls = map[status] || 'bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]';
  return (
    <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${cls}`}>
      {status}
    </span>
  );
}

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; search?: string; status?: string }>;
}) {
  const resolvedParams = await searchParams;
  const currentTab = resolvedParams.tab || 'queue';
  const searchQuery = (resolvedParams.search || '').trim().toLowerCase();
  const statusFilter = resolvedParams.status || 'all';

  const supabase = await createClient();

  const [{ data: rawReturns }, { data: activeOrders }] = await Promise.all([
    supabase
      .from('returns')
      .select(`
        *,
        orders (id, return_date, order_products (item_sku, items (name))),
        customers (id, first_name, last_name, phone)
      `)
      .order('requested_at', { ascending: false }),
    supabase
      .from('orders')
      .select(`
        id, return_date, total_deposit,
        customers (id, first_name, last_name, phone),
        order_products (item_sku, items (name))
      `)
      .in('status', ['Active', 'In Shipping'])
      .order('return_date', { ascending: true }),
  ]);

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
    const diffDays = Math.round((today - deadline) / 86400000);
    if (diffDays === 0) return { text: 'DUE TODAY', color: 'amber' };
    if (diffDays === -1) return { text: 'DUE TOMORROW', color: 'amber' };
    if (diffDays > 0) return { text: `${diffDays} D LATE`, color: 'bad' };
    return { text: 'ON TIME', color: 'green' };
  };

  const formattedReturns = (rawReturns || []).map((r: any) => {
    const custName = `${r.customers?.first_name || ''} ${r.customers?.last_name || ''}`.trim() || 'Customer';
    const firstItem = r.orders?.order_products?.[0]?.item_sku || 'Garment';
    const deadline = r.orders?.return_date;
    return { ...r, customerName: custName, firstItem, deadline, aging: getAgingBadge(deadline) };
  });

  const needsAction = formattedReturns.filter(
    (r) =>
      r.status === 'Received' ||
      r.status === 'In Review' ||
      r.status === 'Requested' ||
      (r.status === 'Shipping' && r.deadline && r.deadline <= todayStr),
  );

  const dueSoonUnrequestedOrders = (activeOrders || [])
    .filter((o) => !existingReturnOrderIds.has(o.id) && (o.return_date === todayStr || o.return_date === tomorrowStr))
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
    (r) => r.status === 'Shipping' && r.deadline && r.deadline < todayStr,
  );
  const overdueGroup = [...overdueShippingReturns, ...overdueUnrequestedOrders];

  let filteredAll = formattedReturns;
  if (searchQuery) {
    filteredAll = filteredAll.filter(
      (r) =>
        r.id.toLowerCase().includes(searchQuery) ||
        r.order_id.toLowerCase().includes(searchQuery) ||
        r.customerName.toLowerCase().includes(searchQuery) ||
        (r.waybill_id || '').toLowerCase().includes(searchQuery),
    );
  }
  if (statusFilter !== 'all') {
    filteredAll = filteredAll.filter((r) => r.status.toLowerCase() === statusFilter.toLowerCase());
  }

  return (
    <div className="pb-24 font-sans text-ink">
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">Operations</div>
          <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink">Returns</h1>
        </div>
        <Link href="/admin/returns/new" className="px-4 py-2 bg-[#1A1F16] text-white rounded-lg text-xs font-semibold hover:bg-black transition flex items-center gap-1.5 shadow-sm">
          <Plus className="w-3.5 h-3.5" />+ Create Return Request
        </Link>
      </div>

      <div className="flex gap-5 border-b border-line mb-6">
        <Link href="?tab=queue" className={`pb-2.5 text-sm font-medium transition-colors ${currentTab === 'queue' ? 'text-wine-ink border-b-2 border-wine' : 'text-muted hover:text-ink'}`}>Work queue</Link>
        <Link href="?tab=all" className={`pb-2.5 text-sm font-medium transition-colors ${currentTab === 'all' ? 'text-wine-ink border-b-2 border-wine' : 'text-muted hover:text-ink'}`}>All returns</Link>
      </div>

      {currentTab === 'queue' && (
        <div className="space-y-7">
          <ReturnsSection
            heading="NEEDS ACTION"
            tone="wine"
            items={needsAction}
            emptyText="No pending return actions needed."
          />
          <ReturnsSection
            heading="DEADLINE TODAY & TOMORROW"
            tone="muted"
            items={dueSoonUnrequestedOrders}
            emptyText="No upcoming returns scheduled for today or tomorrow."
          />
          <ReturnsSection
            heading="OVERDUE — NOTHING IN MOTION"
            tone="muted"
            items={overdueGroup}
            emptyText="No overdue returns."
          />
        </div>
      )}

      {currentTab === 'all' && (
        <div>
          <form method="GET" className="flex flex-wrap items-center gap-3 mb-4 text-[13px]">
            <input type="hidden" name="tab" value="all" />
            <input type="text" name="search" defaultValue={searchQuery} placeholder="Search Order ID, Customer, Resi..."
              className="px-3.5 py-1.5 w-64 rounded-lg border border-line bg-card text-ink focus:outline-none focus:ring-1 focus:ring-wine" />
            <select name="status" defaultValue={statusFilter} className="px-3 py-1.5 rounded-lg border border-line bg-card text-ink text-xs cursor-pointer">
              <option value="all">Status (All) ▾</option>
              <option value="Requested">Requested</option>
              <option value="Shipping">Shipping</option>
              <option value="Received">Received</option>
              <option value="In Review">In Review</option>
              <option value="Completed">Completed</option>
            </select>
            <button type="submit" className="px-3.5 py-1.5 rounded-lg border border-line bg-card text-xs text-muted hover:text-ink hover:bg-[#F6F4EF] transition cursor-pointer">Filter</button>
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
                  </tr>
                </thead>
                <tbody>
                  {filteredAll.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-10 text-center text-muted">No return records match your query.</td></tr>
                  ) : (
                    filteredAll.map((r) => (
                      <tr key={r.id} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                        <td className="px-3 py-3.5 font-bold text-ink">
                          <Link href={`/admin/returns/${r.id}`} className="hover:underline text-wine-ink hover:text-black">{r.id}</Link>
                        </td>
                        <td className="px-3 py-3.5 font-mono text-xs">
                          <Link href={`/admin/orders/${r.order_id}`} className="hover:underline text-wine-ink hover:text-black">{r.order_id}</Link>
                        </td>
                        <td className="px-3 py-3.5 font-medium">{r.customerName}</td>
                        <td className="px-3 py-3.5 text-xs text-muted truncate max-w-[150px]">{r.return_method}</td>
                        <td className="px-3 py-3.5 font-mono text-xs">{r.waybill_id || '—'}</td>
                        <td className="px-3 py-3.5 font-medium">{formatRupiah(Number(r.deposit_held))}</td>
                        <td className="px-3 py-3.5 font-bold text-wine-ink">{formatRupiah(Number(r.refund_amount))}</td>
                        <td className="px-3 py-3.5"><ReturnStatusPill status={r.status} /></td>
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

function ReturnsSection({
  heading, tone, items, emptyText,
}: {
  heading: string;
  tone: 'wine' | 'muted';
  items: any[];
  emptyText: string;
}) {
  const headingCls = tone === 'wine' ? 'text-wine-ink' : 'text-muted';
  return (
    <div>
      <div className={`text-[11px] font-bold tracking-[0.14em] uppercase ${headingCls} mb-2.5`}>
        {heading} — {items.length}
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
              {items.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-6 text-center text-muted text-xs">{emptyText}</td></tr>
              ) : (
                items.map((r) => (
                  <tr key={r.id} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                    <td className="px-3 py-3 text-muted">{formatDate(r.requested_at)}</td>
                    <td className="px-3 py-3 font-bold text-ink">
                      <Link
                        href={r.isPlaceholder ? `/admin/orders/${r.order_id}` : `/admin/returns/${r.id}`}
                        className="hover:underline"
                      >
                        {r.order_id}
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-medium">{r.customerName}</td>
                    <td className="px-3 py-3 font-mono text-xs">{r.firstItem}</td>
                    <td className="px-3 py-3 text-muted text-xs truncate max-w-[140px]">
                      {r.return_method?.includes('Biteship') ? 'KORA arrang...' : r.return_method || '—'}
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
                    <td className="px-3 py-3"><ReturnStatusPill status={r.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

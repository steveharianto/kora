import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatRupiah } from '@/lib/utils';
import AddCustomerModal from './AddCustomerModal';

function formatDisplayDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function StatusPill({ status }: { status: string }) {
  const norm = (status || '').toUpperCase();

  if (norm === 'VERIFIED') {
    return (
      <span className="inline-block text-[10px] font-bold tracking-wider uppercase rounded-full px-2.5 py-0.5 bg-[#EAF3E7] text-[#2E7D47]">
        VERIFIED
      </span>
    );
  }

  if (norm === 'KTP PENDING') {
    return (
      <span className="inline-block text-[10px] font-bold tracking-wider uppercase rounded-full px-2.5 py-0.5 bg-[#F8EED9] text-[#977028]">
        KTP PENDING
      </span>
    );
  }

  return (
    <span className="inline-block text-[10px] font-bold tracking-wider uppercase rounded-full px-2.5 py-0.5 bg-[#ECE8DF] text-[#7E776B]">
      NOT SUBMITTED
    </span>
  );
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    from?: string;
    to?: string;
    status?: string;
    view?: string;
    page?: string;
  }>;
}) {
  const resolvedParams = await searchParams;
  const searchQuery = (resolvedParams.search || '').trim().toLowerCase();
  const fromDate = resolvedParams.from || '';
  const toDate = resolvedParams.to || '';
  const statusFilter = resolvedParams.status || 'all';
  const viewFilter = resolvedParams.view || 'all';
  const currentPage = Math.max(1, parseInt(resolvedParams.page || '1', 10));
  const PAGE_SIZE = 8;

  const supabase = await createClient();

  const { data: rawCustomers, error } = await supabase
    .from('customers')
    .select(`
      id,
      first_name,
      last_name,
      phone,
      gender,
      current_credit,
      status,
      date_joined,
      addresses (
        city,
        street_address,
        is_default
      ),
      orders (
        id,
        total,
        status
      )
    `)
    .order('date_joined', { ascending: false });

  if (error) {
    console.error('Error fetching customers:', error);
  }

  const allCustomers = (rawCustomers || []).map((c: any) => {
    const defaultAddr = c.addresses?.find((a: any) => a.is_default) || c.addresses?.[0];
    const city = defaultAddr?.city || '—';
    const ordersCount = c.orders?.length || 0;
    const lifetimeValue = (c.orders || []).reduce(
      (sum: number, o: any) => sum + (parseFloat(o.total) || 0),
      0
    );

    return {
      ...c,
      fullName: `${c.first_name} ${c.last_name || ''}`.trim(),
      city,
      ordersCount,
      lifetimeValue,
    };
  });

  // Filters application
  let filtered = allCustomers;

  if (searchQuery) {
    filtered = filtered.filter(
      (c) =>
        c.fullName.toLowerCase().includes(searchQuery) ||
        c.phone.toLowerCase().includes(searchQuery) ||
        c.city.toLowerCase().includes(searchQuery)
    );
  }

  if (statusFilter && statusFilter !== 'all') {
    filtered = filtered.filter(
      (c) => (c.status || '').toLowerCase() === statusFilter.toLowerCase()
    );
  }

  if (fromDate) {
    filtered = filtered.filter((c) => c.date_joined && c.date_joined >= fromDate);
  }

  if (toDate) {
    filtered = filtered.filter((c) => c.date_joined && c.date_joined <= toDate);
  }

  if (viewFilter === 'with-orders') {
    filtered = filtered.filter((c) => c.ordersCount > 0);
  } else if (viewFilter === 'with-credit') {
    filtered = filtered.filter((c) => (c.current_credit || 0) > 0);
  }

  const totalResults = filtered.length;
  const totalPages = Math.ceil(totalResults / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalResults);
  const paginatedCustomers = filtered.slice(startIndex, endIndex);

  const buildQueryString = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    const current = {
      search: searchQuery,
      from: fromDate,
      to: toDate,
      status: statusFilter,
      view: viewFilter,
      page: currentPage,
      ...overrides,
    };

    Object.entries(current).forEach(([k, v]) => {
      if (v && v !== 'all' && v !== 1) {
        params.set(k, String(v));
      }
    });

    const str = params.toString();
    return str ? `?${str}` : '/admin/customers';
  };

  return (
    <div className="max-w-[1200px]">
      {/* Page Title & Add Action */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">
            Catalog
          </div>
          <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink">
            Customers
          </h1>
        </div>
        <AddCustomerModal />
      </div>

      {/* Filter Toolbar */}
      <form method="GET" className="flex flex-wrap items-center gap-3 mb-4 text-[13px]">
        {/* Search input */}
        <input
          type="text"
          name="search"
          defaultValue={searchQuery}
          placeholder="Search"
          className="px-3.5 py-1.5 w-44 rounded-lg border border-line bg-card text-ink focus:outline-none focus:ring-1 focus:ring-wine transition placeholder-[#B0A79A]"
        />

        {/* Date Joined Range */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] tracking-[0.14em] uppercase text-muted font-medium">
            Joined
          </span>
          <input
            type="date"
            name="from"
            defaultValue={fromDate}
            className="px-2.5 py-1.5 rounded-lg border border-line bg-card text-ink text-xs focus:outline-none focus:ring-1 focus:ring-wine"
          />
          <span className="text-muted text-xs">to</span>
          <input
            type="date"
            name="to"
            defaultValue={toDate}
            className="px-2.5 py-1.5 rounded-lg border border-line bg-card text-ink text-xs focus:outline-none focus:ring-1 focus:ring-wine"
          />
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] tracking-[0.14em] uppercase text-muted font-medium">
            Status
          </span>
          <select
            name="status"
            defaultValue={statusFilter}
            className="px-3 py-1.5 rounded-lg border border-line bg-card text-ink text-xs focus:outline-none focus:ring-1 focus:ring-wine cursor-pointer"
          >
            <option value="all">Status (3/3)</option>
            <option value="Verified">Verified</option>
            <option value="KTP Pending">KTP Pending</option>
            <option value="Not Submitted">Not Submitted</option>
          </select>
        </div>

        {/* View Preset Dropdown */}
        <select
          name="view"
          defaultValue={viewFilter}
          className="px-3 py-1.5 rounded-lg border border-line bg-card text-ink text-xs focus:outline-none focus:ring-1 focus:ring-wine cursor-pointer"
        >
          <option value="all">View: All</option>
          <option value="with-orders">Has Orders</option>
          <option value="with-credit">Has Store Credit</option>
        </select>

        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-muted hover:text-ink hover:bg-[#F6F4EF] transition"
        >
          Filter
        </button>

        {(searchQuery || fromDate || toDate || statusFilter !== 'all' || viewFilter !== 'all') && (
          <Link
            href="/admin/customers"
            className="text-xs text-muted hover:text-bad underline ml-1"
          >
            Reset
          </Link>
        )}
      </form>

      {/* Pagination Counter */}
      <div className="flex justify-end items-center gap-2 mb-2.5 text-xs text-muted">
        <span>
          {totalResults === 0 ? '0 of 0' : `${startIndex + 1}-${endIndex} of ${totalResults}`}
        </span>
        <div className="flex items-center gap-1 ml-1">
          <Link
            href={buildQueryString({ page: Math.max(1, currentPage - 1) })}
            className={`w-6 h-6 flex items-center justify-center border border-line rounded bg-card hover:bg-[#F6F4EF] transition ${
              currentPage <= 1 ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            ‹
          </Link>
          <Link
            href={buildQueryString({ page: Math.min(totalPages, currentPage + 1) })}
            className={`w-6 h-6 flex items-center justify-center border border-line rounded bg-card hover:bg-[#F6F4EF] transition ${
              currentPage >= totalPages ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            ›
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-line rounded-[10px] p-2 pb-0 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[980px]">
            <thead>
              <tr className="border-b border-line text-[10.5px] tracking-[0.14em] uppercase text-muted text-left font-medium">
                <th className="px-3 py-3">Customer ▾</th>
                <th className="px-3 py-3">City ▾</th>
                <th className="px-3 py-3">Phone ▾</th>
                <th className="px-3 py-3">Joined ▾</th>
                <th className="px-3 py-3 text-center">Orders ▾</th>
                <th className="px-3 py-3">Lifetime Value ▾</th>
                <th className="px-3 py-3">Store Credit ▾</th>
                <th className="px-3 py-3">Status ▾</th>
                <th className="px-3 py-3 w-[70px]"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-muted">
                    No customers found matching the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none group">
                    <td className="px-3 py-3.5 align-middle font-medium text-ink">
                      {cust.fullName}
                    </td>
                    <td className="px-3 py-3.5 align-middle text-muted">
                      {cust.city}
                    </td>
                    <td className="px-3 py-3.5 align-middle text-muted font-tabular-nums">
                      {cust.phone.startsWith('+') ? cust.phone : `+${cust.phone}`}
                    </td>
                    <td className="px-3 py-3.5 align-middle text-muted font-tabular-nums">
                      {formatDisplayDate(cust.date_joined)}
                    </td>
                    <td className="px-3 py-3.5 align-middle text-center font-tabular-nums text-ink">
                      {cust.ordersCount}
                    </td>
                    <td className="px-3 py-3.5 align-middle font-tabular-nums text-ink">
                      {cust.lifetimeValue > 0 ? formatRupiah(cust.lifetimeValue) : '—'}
                    </td>
                    <td className="px-3 py-3.5 align-middle font-tabular-nums">
                      {cust.current_credit && cust.current_credit > 0 ? (
                        <span className="font-semibold text-ink">
                          {formatRupiah(cust.current_credit)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <StatusPill status={cust.status} />
                    </td>
                    <td className="px-3 py-3.5 align-middle text-right">
                      <Link
                        href={`/admin/customers/${cust.id}`}
                        className="inline-block text-[12.5px] font-medium border border-line bg-card text-ink rounded-lg px-3 py-1 hover:border-[#C9C2B4] transition"
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
  );
}

import {
  getRevenueReportData,
  getInventoryReportData,
  getReturnsReportData,
  getCustomersReportData,
  getAuditReportData,
} from '@/app/actions/reports';
import { formatRupiah } from '@/lib/utils';
import ReportCardWrapper from '@/components/admin/reports/ReportCardWrapper';

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default async function AdminReportsPage() {
  const [revenueData, inventoryData, returnsData, customersData, auditData] = await Promise.all([
    getRevenueReportData(),
    getInventoryReportData(),
    getReturnsReportData(),
    getCustomersReportData(),
    getAuditReportData(),
  ]);

  const rev = 'kpis' in revenueData ? revenueData : { kpis: {} as any, rows: [] };
  const inv = 'kpis' in inventoryData ? inventoryData : { kpis: {} as any, rows: [] };
  const ret = 'kpis' in returnsData ? returnsData : { kpis: {} as any, rows: [] };
  const cus = 'kpis' in customersData ? customersData : { kpis: {} as any, rows: [] };
  const aud = 'kpis' in auditData ? auditData : { kpis: {} as any, rows: [] };

  return (
    <div className="max-w-[1250px] pb-24 font-sans text-ink space-y-6">
      {/* Header */}
      <div>
        <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">Insight</div>
        <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink">Reports</h1>
        <p className="text-xs text-muted mt-0.5">
          Executive performance, fleet utilization, reverse logistics settlements, and system compliance logs.
        </p>
      </div>

      {/* =================================================================== */}
      {/* SECTION 1: REVENUE & CASHFLOW REPORT                                */}
      {/* =================================================================== */}
      <ReportCardWrapper
        title="Revenue & Cashflow Report"
        subtitle="Gross rental turnover, refundable deposit custody, shipping collections, and net realized cashflow."
        reportType="revenue"
        defaultCollapsed={false}
      >
        {/* KPI Ribbons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-tabular-nums">
          <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
            <span className="text-[10px] uppercase text-muted tracking-wider block">Gross Rental</span>
            <span className="text-xs font-bold text-ink">{formatRupiah(rev.kpis.grossRental || 0)}</span>
          </div>
          <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
            <span className="text-[10px] uppercase text-muted tracking-wider block">Fittings Fees</span>
            <span className="text-xs font-bold text-ink">{formatRupiah(rev.kpis.fittingsIncome || 0)}</span>
          </div>
          <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
            <span className="text-[10px] uppercase text-muted tracking-wider block">Deposits Held</span>
            <span className="text-xs font-bold text-[#84661E]">{formatRupiah(rev.kpis.depositsHeld || 0)}</span>
          </div>
          <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
            <span className="text-[10px] uppercase text-muted tracking-wider block">Shipping Ongkir</span>
            <span className="text-xs font-bold text-ink">{formatRupiah(rev.kpis.shippingFees || 0)}</span>
          </div>
          <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
            <span className="text-[10px] uppercase text-muted tracking-wider block">Store Credit Used</span>
            <span className="text-xs font-bold text-[#A63222]">-{formatRupiah(rev.kpis.creditApplied || 0)}</span>
          </div>
          <div className="p-2.5 bg-[#EAF3E7] rounded border border-[#CAD3C5]">
            <span className="text-[10px] uppercase text-[#2E7D47] font-semibold tracking-wider block">Net Cashflow</span>
            <span className="text-xs font-bold text-[#2E7D47]">{formatRupiah(rev.kpis.netCashflow || 0)}</span>
          </div>
        </div>

        {/* Table Preview */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-tabular-nums min-w-[850px]">
            <thead>
              <tr className="text-[10px] uppercase text-muted tracking-wider border-b border-line pb-1">
                <th className="py-2 px-2.5">Date</th>
                <th className="py-2 px-2.5">Order ID</th>
                <th className="py-2 px-2.5">Customer</th>
                <th className="py-2 px-2.5">Items</th>
                <th className="py-2 px-2.5 text-right">Rental</th>
                <th className="py-2 px-2.5 text-right">Deposit</th>
                <th className="py-2 px-2.5 text-right">Total Paid</th>
                <th className="py-2 px-2.5">Method</th>
                <th className="py-2 px-2.5">Channel</th>
              </tr>
            </thead>
            <tbody>
              {rev.rows.slice(0, 8).map((r: any, i: number) => (
                <tr key={i} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                  <td className="py-2.5 px-2.5 text-muted">{formatDate(r.date)}</td>
                  <td className="py-2.5 px-2.5 font-bold font-mono text-ink">{r.orderId}</td>
                  <td className="py-2.5 px-2.5 font-medium">{r.customer}</td>
                  <td className="py-2.5 px-2.5 font-mono text-[11px] text-muted">{r.items}</td>
                  <td className="py-2.5 px-2.5 text-right font-medium">{formatRupiah(r.rentalPrice)}</td>
                  <td className="py-2.5 px-2.5 text-right text-muted">{formatRupiah(r.deposit)}</td>
                  <td className="py-2.5 px-2.5 text-right font-bold text-wine-ink">{formatRupiah(r.totalPaid)}</td>
                  <td className="py-2.5 px-2.5 text-[11px] text-muted">{r.paymentMethod}</td>
                  <td className="py-2.5 px-2.5 text-[11px] text-muted">{r.channel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportCardWrapper>

      {/* =================================================================== */}
      {/* SECTION 2: INVENTORY & FLEET UTILIZATION REPORT                     */}
      {/* =================================================================== */}
      <ReportCardWrapper
        title="Inventory Performance & Fleet Utilization"
        subtitle="Individual garment yield, total days on loan, rental turnover cycles, and active maintenance condition."
        reportType="inventory"
        hasDateFilter={false}
        defaultCollapsed={false}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-tabular-nums mb-3">
          <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
            <span className="text-[10px] uppercase text-muted tracking-wider block">Total Catalog Items</span>
            <span className="text-xs font-bold text-ink">{inv.kpis.totalItems || 0} items</span>
          </div>
          <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
            <span className="text-[10px] uppercase text-muted tracking-wider block">Active Fleet</span>
            <span className="text-xs font-bold text-[#2E7D47]">{inv.kpis.activeFleetCount || 0} garments</span>
          </div>
          <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
            <span className="text-[10px] uppercase text-muted tracking-wider block">Total Fleet Revenue</span>
            <span className="text-xs font-bold text-wine-ink">{formatRupiah(inv.kpis.fleetTotalRevenue || 0)}</span>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-tabular-nums min-w-[850px]">
            <thead>
              <tr className="text-[10px] uppercase text-muted tracking-wider border-b border-line pb-1">
                <th className="py-2 px-2.5">SKU</th>
                <th className="py-2 px-2.5">Garment Name</th>
                <th className="py-2 px-2.5">Brand</th>
                <th className="py-2 px-2.5">Type</th>
                <th className="py-2 px-2.5 text-center">Times Rented</th>
                <th className="py-2 px-2.5 text-center">Days on Loan</th>
                <th className="py-2 px-2.5 text-right">Gross Yield</th>
                <th className="py-2 px-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {inv.rows.slice(0, 8).map((item: any, i: number) => (
                <tr key={i} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                  <td className="py-2.5 px-2.5 font-bold font-mono text-ink">{item.sku}</td>
                  <td className="py-2.5 px-2.5 font-medium">{item.name}</td>
                  <td className="py-2.5 px-2.5 text-muted">{item.brand}</td>
                  <td className="py-2.5 px-2.5 text-muted">{item.type}</td>
                  <td className="py-2.5 px-2.5 text-center">{item.timesRented}</td>
                  <td className="py-2.5 px-2.5 text-center">{item.daysOnLoan} days</td>
                  <td className="py-2.5 px-2.5 text-right font-bold text-wine-ink">{formatRupiah(item.revenueYield)}</td>
                  <td className="py-2.5 px-2.5">
                    <span
                      className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                        item.status === 'Available'
                          ? 'bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]'
                          : item.status === 'Unavailable'
                          ? 'bg-[#EEF4FB] text-[#2B6CB0] border-[#C3D9F2]'
                          : 'bg-[#FBEBE8] text-[#A63222] border-[#E8C0B9]'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportCardWrapper>

      {/* =================================================================== */}
      {/* SECTION 3: RETURNS & QC DAMAGE DEDUCTION REPORT                     */}
      {/* =================================================================== */}
      <ReportCardWrapper
        title="Returns & Deposit Settlement Ledger"
        subtitle="Reverse logistics tracking, quality control deductions (stains/tears), late fees retained, and deposit payout records."
        reportType="returns"
        defaultCollapsed={false}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-tabular-nums mb-3">
          <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
            <span className="text-[10px] uppercase text-muted tracking-wider block">Total Returns Handled</span>
            <span className="text-xs font-bold text-ink">{ret.kpis.totalReturns || 0}</span>
          </div>
          <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
            <span className="text-[10px] uppercase text-muted tracking-wider block">Deposits Under Custody</span>
            <span className="text-xs font-bold text-[#84661E]">{formatRupiah(ret.kpis.totalDepositsHeld || 0)}</span>
          </div>
          <div className="p-2.5 bg-[#FBEBE8] rounded border border-[#E8C0B9]">
            <span className="text-[10px] uppercase text-[#A63222] tracking-wider block">QC Deductions Retained</span>
            <span className="text-xs font-bold text-[#A63222]">{formatRupiah(ret.kpis.totalQcDeductions || 0)}</span>
          </div>
          <div className="p-2.5 bg-[#EAF3E7] rounded border border-[#CAD3C5]">
            <span className="text-[10px] uppercase text-[#2E7D47] tracking-wider block">Net Deposits Refunded</span>
            <span className="text-xs font-bold text-[#2E7D47]">{formatRupiah(ret.kpis.totalRefunded || 0)}</span>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-tabular-nums min-w-[850px]">
            <thead>
              <tr className="text-[10px] uppercase text-muted tracking-wider border-b border-line pb-1">
                <th className="py-2 px-2.5">Return ID</th>
                <th className="py-2 px-2.5">Order ID</th>
                <th className="py-2 px-2.5">Customer</th>
                <th className="py-2 px-2.5">Deadline</th>
                <th className="py-2 px-2.5 text-center">Days Late</th>
                <th className="py-2 px-2.5">QC Issues</th>
                <th className="py-2 px-2.5 text-right">QC Deduction</th>
                <th className="py-2 px-2.5 text-right">Refund Amount</th>
                <th className="py-2 px-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {ret.rows.slice(0, 8).map((r: any, i: number) => (
                <tr key={i} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                  <td className="py-2.5 px-2.5 font-bold font-mono text-ink">{r.returnId}</td>
                  <td className="py-2.5 px-2.5 font-mono text-muted">{r.orderId}</td>
                  <td className="py-2.5 px-2.5 font-medium">{r.customer}</td>
                  <td className="py-2.5 px-2.5 text-muted">{formatDate(r.deadline)}</td>
                  <td className="py-2.5 px-2.5 text-center">
                    {r.daysLate > 0 ? <span className="text-[#A63222] font-bold">+{r.daysLate}d</span> : '0d'}
                  </td>
                  <td className="py-2.5 px-2.5 text-[11px] text-muted">{r.qcIssues}</td>
                  <td className="py-2.5 px-2.5 text-right font-medium text-[#A63222]">{formatRupiah(r.qcDeduction)}</td>
                  <td className="py-2.5 px-2.5 text-right font-bold text-[#2E7D47]">{formatRupiah(r.refundAmount)}</td>
                  <td className="py-2.5 px-2.5 text-[11px] font-semibold">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportCardWrapper>

      {/* =================================================================== */}
      {/* SECTION 4: CUSTOMER LIFETIME VALUE & HABITS REPORT                  */}
      {/* =================================================================== */}
      <ReportCardWrapper
        title="Customer Lifetime Value (LTV) & Accounts"
        subtitle="Individual customer spend totals, order counts, average order value, and outstanding store credit balance."
        reportType="customers"
        hasDateFilter={false}
        defaultCollapsed={false}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-tabular-nums mb-3">
          <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
            <span className="text-[10px] uppercase text-muted tracking-wider block">Registered Renters</span>
            <span className="text-xs font-bold text-ink">{cus.kpis.totalCustomers || 0}</span>
          </div>
          <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
            <span className="text-[10px] uppercase text-muted tracking-wider block">Cumulative LTV</span>
            <span className="text-xs font-bold text-wine-ink">{formatRupiah(cus.kpis.totalLtvSum || 0)}</span>
          </div>
          <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
            <span className="text-[10px] uppercase text-muted tracking-wider block">Average LTV</span>
            <span className="text-xs font-bold text-ink">{formatRupiah(cus.kpis.averageLtv || 0)}</span>
          </div>
          <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
            <span className="text-[10px] uppercase text-muted tracking-wider block">Store Credit Liability</span>
            <span className="text-xs font-bold text-[#84661E]">{formatRupiah(cus.kpis.totalCreditLiability || 0)}</span>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-tabular-nums min-w-[850px]">
            <thead>
              <tr className="text-[10px] uppercase text-muted tracking-wider border-b border-line pb-1">
                <th className="py-2 px-2.5">Customer Name</th>
                <th className="py-2 px-2.5">Phone</th>
                <th className="py-2 px-2.5">City</th>
                <th className="py-2 px-2.5">KTP Status</th>
                <th className="py-2 px-2.5 text-center">Orders</th>
                <th className="py-2 px-2.5 text-right">Lifetime Spend (LTV)</th>
                <th className="py-2 px-2.5 text-right">AOV</th>
                <th className="py-2 px-2.5 text-right">Store Credit</th>
              </tr>
            </thead>
            <tbody>
              {cus.rows.slice(0, 8).map((c: any, i: number) => (
                <tr key={i} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                  <td className="py-2.5 px-2.5 font-bold text-ink">{c.name}</td>
                  <td className="py-2.5 px-2.5 font-mono text-muted">{c.phone}</td>
                  <td className="py-2.5 px-2.5 text-muted">{c.city}</td>
                  <td className="py-2.5 px-2.5">
                    <span
                      className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                        c.status === 'Verified'
                          ? 'bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]'
                          : 'bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-2.5 text-center font-medium">{c.ordersCount}</td>
                  <td className="py-2.5 px-2.5 text-right font-bold text-wine-ink">{formatRupiah(c.ltv)}</td>
                  <td className="py-2.5 px-2.5 text-right text-muted">{formatRupiah(c.aov)}</td>
                  <td className="py-2.5 px-2.5 text-right font-mono font-medium">{formatRupiah(c.storeCredit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportCardWrapper>

      {/* =================================================================== */}
      {/* SECTION 5: ADMINISTRATIVE AUDIT TRAIL LOG                           */}
      {/* =================================================================== */}
      <ReportCardWrapper
        title="Administrative Security & Audit Log"
        subtitle="Complete chronological trail of overrides, role approvals, manual credit top-ups, and courier dispatches."
        reportType="audit"
        defaultCollapsed={false}
      >
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-tabular-nums min-w-[850px]">
            <thead>
              <tr className="text-[10px] uppercase text-muted tracking-wider border-b border-line pb-1">
                <th className="py-2 px-2.5">Timestamp</th>
                <th className="py-2 px-2.5">Admin</th>
                <th className="py-2 px-2.5">Target</th>
                <th className="py-2 px-2.5">Action</th>
                <th className="py-2 px-2.5">Field</th>
                <th className="py-2 px-2.5">Previous Value</th>
                <th className="py-2 px-2.5">New Value</th>
              </tr>
            </thead>
            <tbody>
              {aud.rows.slice(0, 8).map((l: any, i: number) => (
                <tr key={i} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                  <td className="py-2.5 px-2.5 font-mono text-muted text-[11px]">{l.timestamp}</td>
                  <td className="py-2.5 px-2.5 font-bold text-ink">{l.admin}</td>
                  <td className="py-2.5 px-2.5 font-mono text-xs">
                    {l.entityType}: {l.entityId}
                  </td>
                  <td className="py-2.5 px-2.5 font-medium text-ink">{l.action}</td>
                  <td className="py-2.5 px-2.5 text-muted text-[11px]">{l.field}</td>
                  <td className="py-2.5 px-2.5 text-muted text-[11px] truncate max-w-[120px]">{l.oldVal}</td>
                  <td className="py-2.5 px-2.5 text-wine-ink font-medium text-[11px] truncate max-w-[150px]">
                    {l.newVal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportCardWrapper>
    </div>
  );
}

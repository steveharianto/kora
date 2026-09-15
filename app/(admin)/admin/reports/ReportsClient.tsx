'use client';

import { formatRupiah } from '@/lib/utils';
import ReportCardWrapper from '@/components/admin/reports/ReportCardWrapper';

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  const clean = String(dateStr).split('T')[0].split(' ')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return clean;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

interface ReportsClientProps {
  revenueData: any;
  inventoryData: any;
  returnsData: any;
  customersData: any;
  auditData: any;
}

export default function ReportsClient({
  revenueData,
  inventoryData,
  returnsData,
  customersData,
  auditData,
}: ReportsClientProps) {
  const revRows = 'rows' in revenueData && Array.isArray(revenueData.rows) ? revenueData.rows : [];
  const invRows = 'rows' in inventoryData && Array.isArray(inventoryData.rows) ? inventoryData.rows : [];
  const retRows = 'rows' in returnsData && Array.isArray(returnsData.rows) ? returnsData.rows : [];
  const cusRows = 'rows' in customersData && Array.isArray(customersData.rows) ? customersData.rows : [];
  const audRows = 'rows' in auditData && Array.isArray(auditData.rows) ? auditData.rows : [];

  return (
    <div className="max-w-[1250px] mx-auto pb-24 font-sans text-ink space-y-6">
      <div>
        <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">Insight</div>
        <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink">Reports</h1>
        <p className="text-xs text-muted mt-0.5">
          Executive performance, fleet utilization, reverse logistics settlements, and system compliance logs.
        </p>
      </div>

      {/* 1. REVENUE & CASHFLOW */}
      <ReportCardWrapper
        title="Revenue & Cashflow Report"
        subtitle="Gross rental turnover, refundable deposit custody, shipping collections, and net realized cashflow."
        reportType="revenue"
        rows={revRows}
        renderContent={(rows) => {
          const grossRental = rows.reduce((acc, r) => acc + (Number(r.rentalPrice) || 0), 0);
          const depositsHeld = rows.reduce((acc, r) => acc + (Number(r.deposit) || 0), 0);
          const shippingFees = rows.reduce((acc, r) => acc + (Number(r.shipping) || 0), 0);
          const creditApplied = rows.reduce((acc, r) => acc + (Number(r.storeCredit) || 0), 0);
          const totalInflow = rows.reduce((acc, r) => acc + (Number(r.totalPaid) || 0), 0);

          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 font-tabular-nums">
                <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
                  <span className="text-[10px] uppercase text-muted tracking-wider block">Rental Subtotal</span>
                  <span className="text-xs font-bold text-ink">{formatRupiah(grossRental)}</span>
                </div>
                <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
                  <span className="text-[10px] uppercase text-muted tracking-wider block">Deposits Held</span>
                  <span className="text-xs font-bold text-[#84661E]">{formatRupiah(depositsHeld)}</span>
                </div>
                <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
                  <span className="text-[10px] uppercase text-muted tracking-wider block">Shipping Ongkir</span>
                  <span className="text-xs font-bold text-ink">{formatRupiah(shippingFees)}</span>
                </div>
                <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
                  <span className="text-[10px] uppercase text-muted tracking-wider block">Store Credit Used</span>
                  <span className="text-xs font-bold text-[#A63222]">-{formatRupiah(creditApplied)}</span>
                </div>
                <div className="p-2.5 bg-[#EAF3E7] rounded border border-[#CAD3C5]">
                  <span className="text-[10px] uppercase text-[#2E7D47] font-semibold tracking-wider block">Realized Inflow</span>
                  <span className="text-xs font-bold text-[#2E7D47]">{formatRupiah(totalInflow)}</span>
                </div>
              </div>

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
                    {rows.slice(0, 10).map((r: any, i: number) => (
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
            </>
          );
        }}
      />

      {/* 2. INVENTORY */}
      <ReportCardWrapper
        title="Inventory Performance & Fleet Utilization"
        subtitle="Individual garment yield, total days on loan, rental turnover cycles, and active maintenance condition."
        reportType="inventory"
        hasDateFilter={false}
        rows={invRows}
        renderContent={(rows) => {
          const totalFleetRevenue = rows.reduce((acc, r) => acc + (Number(r.revenueYield) || 0), 0);
          const activeFleetCount = rows.filter((r) => r.status !== 'Under Repair' && r.status !== 'Archived').length;

          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-tabular-nums mb-3">
                <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
                  <span className="text-[10px] uppercase text-muted tracking-wider block">Total Catalog Items</span>
                  <span className="text-xs font-bold text-ink">{rows.length} items</span>
                </div>
                <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
                  <span className="text-[10px] uppercase text-muted tracking-wider block">Active Fleet</span>
                  <span className="text-xs font-bold text-[#2E7D47]">{activeFleetCount} garments</span>
                </div>
                <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
                  <span className="text-[10px] uppercase text-muted tracking-wider block">Total Fleet Revenue</span>
                  <span className="text-xs font-bold text-wine-ink">{formatRupiah(totalFleetRevenue)}</span>
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
                    {rows.slice(0, 10).map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                        <td className="py-2.5 px-2.5 font-bold font-mono text-ink">{item.sku}</td>
                        <td className="py-2.5 px-2.5 font-medium">{item.name}</td>
                        <td className="py-2.5 px-2.5 text-muted">{item.brand}</td>
                        <td className="py-2.5 px-2.5 text-muted">{item.type}</td>
                        <td className="py-2.5 px-2.5 text-center">{item.timesRented}</td>
                        <td className="py-2.5 px-2.5 text-center">{item.daysOnLoan} days</td>
                        <td className="py-2.5 px-2.5 text-right font-bold text-wine-ink">{formatRupiah(item.revenueYield)}</td>
                        <td className="py-2.5 px-2.5">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      />

      {/* 3. RETURNS */}
      <ReportCardWrapper
        title="Returns & Deposit Settlement Ledger"
        subtitle="Reverse logistics tracking, quality control deductions (stains/tears), late fees retained, and deposit payout records."
        reportType="returns"
        rows={retRows}
        renderContent={(rows) => {
          const totalHeld = rows.reduce((acc, r) => acc + (Number(r.depositHeld) || 0), 0);
          const totalDeductions = rows.reduce((acc, r) => acc + (Number(r.qcDeduction) || 0), 0);
          const totalRefunded = rows.reduce((acc, r) => acc + (Number(r.refundAmount) || 0), 0);

          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-tabular-nums mb-3">
                <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
                  <span className="text-[10px] uppercase text-muted tracking-wider block">Total Returns Handled</span>
                  <span className="text-xs font-bold text-ink">{rows.length}</span>
                </div>
                <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
                  <span className="text-[10px] uppercase text-muted tracking-wider block">Deposits Under Custody</span>
                  <span className="text-xs font-bold text-[#84661E]">{formatRupiah(totalHeld)}</span>
                </div>
                <div className="p-2.5 bg-[#FBEBE8] rounded border border-[#E8C0B9]">
                  <span className="text-[10px] uppercase text-[#A63222] tracking-wider block">QC Deductions Retained</span>
                  <span className="text-xs font-bold text-[#A63222]">{formatRupiah(totalDeductions)}</span>
                </div>
                <div className="p-2.5 bg-[#EAF3E7] rounded border border-[#CAD3C5]">
                  <span className="text-[10px] uppercase text-[#2E7D47] tracking-wider block">Net Deposits Refunded</span>
                  <span className="text-xs font-bold text-[#2E7D47]">{formatRupiah(totalRefunded)}</span>
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
                    {rows.slice(0, 10).map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                        <td className="py-2.5 px-2.5 font-bold font-mono text-ink">{r.returnId}</td>
                        <td className="py-2.5 px-2.5 font-mono text-muted">{r.orderId}</td>
                        <td className="py-2.5 px-2.5 font-medium">{r.customer}</td>
                        <td className="py-2.5 px-2.5 text-muted">{formatDate(r.deadline)}</td>
                        <td className="py-2.5 px-2.5 text-center">{r.daysLate}d</td>
                        <td className="py-2.5 px-2.5 text-[11px] text-muted">{r.qcIssues}</td>
                        <td className="py-2.5 px-2.5 text-right font-medium text-[#A63222]">{formatRupiah(r.qcDeduction)}</td>
                        <td className="py-2.5 px-2.5 text-right font-bold text-[#2E7D47]">{formatRupiah(r.refundAmount)}</td>
                        <td className="py-2.5 px-2.5 text-[11px] font-semibold">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      />

      {/* 4. CUSTOMERS */}
      <ReportCardWrapper
        title="Customer Lifetime Value (LTV) & Accounts"
        subtitle="Individual customer spend totals, order counts, average order value, and outstanding store credit balance."
        reportType="customers"
        hasDateFilter={false}
        rows={cusRows}
        renderContent={(rows) => {
          const totalLtv = rows.reduce((sum, r) => sum + (Number(r.ltv) || 0), 0);
          const totalCredit = rows.reduce((sum, r) => sum + (Number(r.storeCredit) || 0), 0);
          const avgLtv = rows.length > 0 ? Math.round(totalLtv / rows.length) : 0;

          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-tabular-nums mb-3">
                <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
                  <span className="text-[10px] uppercase text-muted tracking-wider block">Registered Renters</span>
                  <span className="text-xs font-bold text-ink">{rows.length}</span>
                </div>
                <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
                  <span className="text-[10px] uppercase text-muted tracking-wider block">Cumulative LTV</span>
                  <span className="text-xs font-bold text-wine-ink">{formatRupiah(totalLtv)}</span>
                </div>
                <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
                  <span className="text-[10px] uppercase text-muted tracking-wider block">Average LTV</span>
                  <span className="text-xs font-bold text-ink">{formatRupiah(avgLtv)}</span>
                </div>
                <div className="p-2.5 bg-[#F6F4EF] rounded border border-line">
                  <span className="text-[10px] uppercase text-muted tracking-wider block">Store Credit Liability</span>
                  <span className="text-xs font-bold text-[#84661E]">{formatRupiah(totalCredit)}</span>
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
                    {rows.slice(0, 10).map((c: any, i: number) => (
                      <tr key={i} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                        <td className="py-2.5 px-2.5 font-bold text-ink">{c.name}</td>
                        <td className="py-2.5 px-2.5 font-mono text-muted">{c.phone}</td>
                        <td className="py-2.5 px-2.5 text-muted">{c.city}</td>
                        <td className="py-2.5 px-2.5">{c.status}</td>
                        <td className="py-2.5 px-2.5 text-center font-medium">{c.ordersCount}</td>
                        <td className="py-2.5 px-2.5 text-right font-bold text-wine-ink">{formatRupiah(c.ltv)}</td>
                        <td className="py-2.5 px-2.5 text-right text-muted">{formatRupiah(c.aov)}</td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-medium">{formatRupiah(c.storeCredit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      />

      {/* 5. AUDIT TRAIL */}
      <ReportCardWrapper
        title="Administrative Security & Audit Log"
        subtitle="Complete chronological trail of overrides, role approvals, manual credit top-ups, and courier dispatches."
        reportType="audit"
        rows={audRows}
        renderContent={(rows) => (
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
                {rows.slice(0, 10).map((l: any, i: number) => (
                  <tr key={i} className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none">
                    <td className="py-2.5 px-2.5 font-mono text-muted text-[11px]">{l.timestamp}</td>
                    <td className="py-2.5 px-2.5 font-bold text-ink">{l.admin}</td>
                    <td className="py-2.5 px-2.5 font-mono text-xs">{l.entityType}: {l.entityId}</td>
                    <td className="py-2.5 px-2.5 font-medium text-ink">{l.action}</td>
                    <td className="py-2.5 px-2.5 text-muted text-[11px]">{l.field}</td>
                    <td className="py-2.5 px-2.5 text-muted text-[11px] truncate max-w-[120px]">{l.oldVal}</td>
                    <td className="py-2.5 px-2.5 text-wine-ink font-medium text-[11px] truncate max-w-[150px]">{l.newVal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      />
    </div>
  );
}

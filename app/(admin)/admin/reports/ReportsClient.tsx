'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';
import ReportCardWrapper from '@/components/admin/reports/ReportCardWrapper';

export type ReportRange = 'all' | 'year' | 'month' | 'custom';

const RANGE_PRESETS: { key: ReportRange; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'year', label: 'This Year' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  const clean = String(dateStr).split('T')[0].split(' ')[0];
  const parts = clean.split('-');
  if (parts.length !== 3) return clean;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

interface Props {
  range: ReportRange;
  rangeLabel: string;
  rangeStart: string;
  rangeEnd: string;
  revenueData: any;
  inventoryData: any;
  returnsData: any;
  customersData: any;
  auditData: any;
}

export default function ReportsClient({
  range,
  rangeLabel,
  rangeStart,
  rangeEnd,
  revenueData,
  inventoryData,
  returnsData,
  customersData,
  auditData,
}: Props) {
  const router = useRouter();

  // Local state for the custom-range inputs, so typing doesn't navigate
  // on every keystroke. Apply on explicit click.
  const [draftStart, setDraftStart] = useState(rangeStart);
  const [draftEnd, setDraftEnd] = useState(rangeEnd);

  const applyCustom = () => {
    if (!draftStart || !draftEnd || draftStart > draftEnd) return;
    router.push(
      `/admin/reports?range=custom&start=${draftStart}&end=${draftEnd}`,
    );
  };

  const revRows =
    'rows' in revenueData && Array.isArray(revenueData.rows)
      ? revenueData.rows
      : [];
  const invRows =
    'rows' in inventoryData && Array.isArray(inventoryData.rows)
      ? inventoryData.rows
      : [];
  const retRows =
    'rows' in returnsData && Array.isArray(returnsData.rows)
      ? returnsData.rows
      : [];
  const cusRows =
    'rows' in customersData && Array.isArray(customersData.rows)
      ? customersData.rows
      : [];
  const audRows =
    'rows' in auditData && Array.isArray(auditData.rows)
      ? auditData.rows
      : [];

  // Appended to every CSV export URL so downloads respect the current range.
  const rangeQS =
    rangeStart && rangeEnd
      ? `?start=${rangeStart}&end=${rangeEnd}`
      : '';

  return (
    <div className="mx-auto pb-24 font-sans text-ink space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">
          Insight
        </div>
        <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink">
          Reports
        </h1>
        <p className="text-xs text-muted mt-0.5">
          Executive performance, fleet utilization, reverse logistics
          settlements, and system compliance logs.
        </p>
      </div>

      {/* ── Range bar ───────────────────────────────────────────── */}
      <div className="bg-card border border-line rounded-[10px] p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          {RANGE_PRESETS.map((p) => {
            const active = range === p.key;
            // Custom has no href — clicking it reveals the date inputs
            // and the Apply button below.
            const href =
              p.key === 'custom'
                ? undefined
                : p.key === 'all'
                  ? '/admin/reports'
                  : `/admin/reports?range=${p.key}`;
            return active || p.key === 'custom' ? (
              <span
                key={p.key}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  active
                    ? 'bg-wine text-white'
                    : 'border border-line bg-card text-muted'
                }`}
              >
                {p.label}
              </span>
            ) : (
              <Link
                key={p.key}
                href={href!}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-line bg-card text-ink hover:bg-[#F6F4EF] transition"
              >
                {p.label}
              </Link>
            );
          })}
        </div>

        {range === 'custom' ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
              max={draftEnd || undefined}
              className="px-2.5 py-1.5 rounded-lg border border-line bg-card text-ink text-xs focus:outline-none focus:ring-1 focus:ring-wine"
            />
            <span className="text-muted text-xs">→</span>
            <input
              type="date"
              value={draftEnd}
              onChange={(e) => setDraftEnd(e.target.value)}
              min={draftStart || undefined}
              className="px-2.5 py-1.5 rounded-lg border border-line bg-card text-ink text-xs focus:outline-none focus:ring-1 focus:ring-wine"
            />
            <button
              type="button"
              onClick={applyCustom}
              disabled={!draftStart || !draftEnd || draftStart > draftEnd}
              className="px-3.5 py-1.5 rounded-lg bg-wine text-white text-xs font-medium hover:bg-[#181E15] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Apply
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-muted ml-auto">
            <Calendar className="w-3.5 h-3.5" />
            <span>{rangeLabel}</span>
          </div>
        )}
      </div>

      {/* ── 1. REVENUE & CASHFLOW ───────────────────────────────── */}
      <ReportCardWrapper
        title="Revenue & Cashflow Report"
        subtitle="Gross rental turnover, refundable deposit custody, shipping collections, and net realized cashflow."
        exportUrl={`/api/admin/reports/revenue${rangeQS}`}
        rows={revRows}
        renderContent={(rows) => {
          const grossRental = rows.reduce(
            (acc, r) => acc + (Number(r.rentalPrice) || 0),
            0,
          );
          const depositsHeld = rows.reduce(
            (acc, r) => acc + (Number(r.deposit) || 0),
            0,
          );
          const shippingFees = rows.reduce(
            (acc, r) => acc + (Number(r.shipping) || 0),
            0,
          );
          const creditApplied = rows.reduce(
            (acc, r) => acc + (Number(r.storeCredit) || 0),
            0,
          );
          const grossCollected = rows.reduce(
            (acc, r) => acc + (Number(r.totalPaid) || 0),
            0,
          );
          const refundedDeposits = Number(
            revenueData?.kpis?.totalRefundedDeposits || 0,
          );
          const fittingsIncome = Number(
            revenueData?.kpis?.fittingsIncome || 0,
          );
          const realizedNet =
            grossCollected - refundedDeposits + fittingsIncome;

          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-tabular-nums">
                <KPI label="Rental Subtotal" value={formatRupiah(grossRental)} />
                <KPI
                  label="Deposits Held"
                  value={formatRupiah(depositsHeld)}
                  tone="warn"
                />
                <KPI
                  label="Shipping Ongkir"
                  value={formatRupiah(shippingFees)}
                />
                <KPI
                  label="Store Credit Used"
                  value={`-${formatRupiah(creditApplied)}`}
                  tone="bad"
                />
                <KPI
                  label="Total Collected"
                  value={formatRupiah(grossCollected)}
                  sub="in window"
                />
                <KPI
                  label="Realized Net"
                  value={formatRupiah(realizedNet)}
                  sub={`− ${formatRupiah(refundedDeposits)} refunds + ${formatRupiah(fittingsIncome)} fittings`}
                  tone="ok"
                />
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
                      <tr
                        key={i}
                        className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none"
                      >
                        <td className="py-2.5 px-2.5 text-muted">
                          {formatDate(r.date)}
                        </td>
                        <td className="py-2.5 px-2.5 font-bold font-mono text-ink">
                          {r.orderId}
                        </td>
                        <td className="py-2.5 px-2.5 font-medium">
                          {r.customer}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-[11px] text-muted">
                          {r.items}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-medium">
                          {formatRupiah(r.rentalPrice)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right text-muted">
                          {formatRupiah(r.deposit)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-bold text-wine-ink">
                          {formatRupiah(r.totalPaid)}
                        </td>
                        <td className="py-2.5 px-2.5 text-[11px] text-muted">
                          {r.paymentMethod}
                        </td>
                        <td className="py-2.5 px-2.5 text-[11px] text-muted">
                          {r.channel}
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

      {/* ── 2. INVENTORY (lifetime) ─────────────────────────────── */}
      <ReportCardWrapper
        title="Inventory Performance & Fleet Utilization"
        subtitle="Individual garment yield, total days on loan, rental turnover cycles, and active maintenance condition. (Lifetime totals — the range filter does not apply.)"
        exportUrl={`/api/admin/reports/inventory`}
        rows={invRows}
        renderContent={(rows) => {
          const totalFleetRevenue = rows.reduce(
            (acc, r) => acc + (Number(r.revenueYield) || 0),
            0,
          );
          const activeFleetCount = rows.filter(
            (r) => r.status !== 'Under Repair' && r.status !== 'Archived',
          ).length;

          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-tabular-nums mb-3">
                <KPI label="Total Catalog Items" value={`${rows.length} items`} />
                <KPI
                  label="Active Fleet"
                  value={`${activeFleetCount} garments`}
                  tone="ok"
                />
                <KPI
                  label="Total Fleet Revenue"
                  value={formatRupiah(totalFleetRevenue)}
                />
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
                      <tr
                        key={i}
                        className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none"
                      >
                        <td className="py-2.5 px-2.5 font-bold font-mono text-ink">
                          {item.sku}
                        </td>
                        <td className="py-2.5 px-2.5 font-medium">
                          {item.name}
                        </td>
                        <td className="py-2.5 px-2.5 text-muted">
                          {item.brand}
                        </td>
                        <td className="py-2.5 px-2.5 text-muted">
                          {item.type}
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          {item.timesRented}
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          {item.daysOnLoan} days
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-bold text-wine-ink">
                          {formatRupiah(item.revenueYield)}
                        </td>
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

      {/* ── 3. RETURNS ──────────────────────────────────────────── */}
      <ReportCardWrapper
        title="Returns & Deposit Settlement Ledger"
        subtitle="Reverse logistics tracking, quality control deductions, late fees retained, and deposit payout records."
        exportUrl={`/api/admin/reports/returns${rangeQS}`}
        rows={retRows}
        renderContent={(rows) => {
          const totalUnderCustody = rows.reduce(
            (acc, r) =>
              r.refundStatus === 'Refunded'
                ? acc
                : acc + (Number(r.depositHeld) || 0),
            0,
          );
          const totalDeductions = rows.reduce(
            (acc, r) =>
              r.refundStatus === 'Refunded'
                ? acc + (Number(r.qcDeduction) || 0)
                : acc,
            0,
          );
          const totalRefunded = rows.reduce(
            (acc, r) =>
              r.refundStatus === 'Refunded'
                ? acc + (Number(r.refundAmount) || 0)
                : acc,
            0,
          );

          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-tabular-nums mb-3">
                <KPI
                  label="Total Returns Handled"
                  value={`${rows.length}`}
                />
                <KPI
                  label="Deposits Under Custody"
                  value={formatRupiah(totalUnderCustody)}
                  tone="warn"
                />
                <KPI
                  label="QC Deductions Retained"
                  value={formatRupiah(totalDeductions)}
                  tone="bad"
                />
                <KPI
                  label="Net Deposits Refunded"
                  value={formatRupiah(totalRefunded)}
                  tone="ok"
                />
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
                      <tr
                        key={i}
                        className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none"
                      >
                        <td className="py-2.5 px-2.5 font-bold font-mono text-ink">
                          {r.returnId}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-muted">
                          {r.orderId}
                        </td>
                        <td className="py-2.5 px-2.5 font-medium">
                          {r.customer}
                        </td>
                        <td className="py-2.5 px-2.5 text-muted">
                          {formatDate(r.deadline)}
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          {r.daysLate}d
                        </td>
                        <td className="py-2.5 px-2.5 text-[11px] text-muted">
                          {r.qcIssues}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-medium text-[#A63222]">
                          {formatRupiah(r.qcDeduction)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-bold text-[#2E7D47]">
                          {formatRupiah(r.refundAmount)}
                        </td>
                        <td className="py-2.5 px-2.5 text-[11px] font-semibold">
                          {r.status}
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

      {/* ── 4. CUSTOMERS (lifetime) ─────────────────────────────── */}
      <ReportCardWrapper
        title="Customer Lifetime Value (LTV) & Accounts"
        subtitle="Individual customer spend totals (net of refundable deposits), order counts, average order value, and outstanding store credit balance. (Lifetime totals — the range filter does not apply.)"
        exportUrl={`/api/admin/reports/customers`}
        rows={cusRows}
        renderContent={(rows) => {
          const totalLtv = rows.reduce(
            (sum, r) => sum + (Number(r.ltv) || 0),
            0,
          );
          const totalCredit = rows.reduce(
            (sum, r) => sum + (Number(r.storeCredit) || 0),
            0,
          );
          const avgLtv =
            rows.length > 0 ? Math.round(totalLtv / rows.length) : 0;

          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-tabular-nums mb-3">
                <KPI
                  label="Registered Renters"
                  value={`${rows.length}`}
                />
                <KPI
                  label="Cumulative LTV"
                  value={formatRupiah(totalLtv)}
                />
                <KPI label="Average LTV" value={formatRupiah(avgLtv)} />
                <KPI
                  label="Store Credit Liability"
                  value={formatRupiah(totalCredit)}
                  tone="warn"
                />
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
                      <th className="py-2 px-2.5 text-right">
                        Lifetime Spend (LTV)
                      </th>
                      <th className="py-2 px-2.5 text-right">AOV</th>
                      <th className="py-2 px-2.5 text-right">Store Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((c: any, i: number) => (
                      <tr
                        key={i}
                        className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none"
                      >
                        <td className="py-2.5 px-2.5 font-bold text-ink">
                          {c.name}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-muted">
                          {c.phone}
                        </td>
                        <td className="py-2.5 px-2.5 text-muted">{c.city}</td>
                        <td className="py-2.5 px-2.5">{c.status}</td>
                        <td className="py-2.5 px-2.5 text-center font-medium">
                          {c.ordersCount}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-bold text-wine-ink">
                          {formatRupiah(c.ltv)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right text-muted">
                          {formatRupiah(c.aov)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-medium">
                          {formatRupiah(c.storeCredit)}
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

      {/* ── 5. AUDIT ────────────────────────────────────────────── */}
      <ReportCardWrapper
        title="Administrative Security & Audit Log"
        subtitle="Complete chronological trail of overrides, role approvals, manual credit top-ups, and courier dispatches."
        exportUrl={`/api/admin/reports/audit${rangeQS}`}
        rows={audRows}
        renderContent={(rows) => {
          const total = Number(auditData?.kpis?.totalAvailable || rows.length);
          const shown = Number(auditData?.kpis?.shownEntries || rows.length);
          const truncated = Boolean(auditData?.kpis?.isTruncated);

          return (
            <>
              {truncated && (
                <div className="mb-3 p-2.5 bg-warn-bg border border-[#F1DFB7] text-warn-ink rounded-lg text-[11.5px]">
                  Showing the latest <strong>{shown}</strong> of{' '}
                  <strong>{total.toLocaleString('id-ID')}</strong> entries.
                  Narrow the range or export the CSV for the full set.
                </div>
              )}

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
                      <tr
                        key={i}
                        className="hover:bg-[#FBFAF6] border-b border-[#EFEBE2] last:border-none"
                      >
                        <td className="py-2.5 px-2.5 font-mono text-muted text-[11px]">
                          {l.timestamp}
                        </td>
                        <td className="py-2.5 px-2.5 font-bold text-ink">
                          {l.admin}
                        </td>
                        <td className="py-2.5 px-2.5 font-mono text-xs">
                          {l.entityType}: {l.entityId}
                        </td>
                        <td className="py-2.5 px-2.5 font-medium text-ink">
                          {l.action}
                        </td>
                        <td className="py-2.5 px-2.5 text-muted text-[11px]">
                          {l.field}
                        </td>
                        <td className="py-2.5 px-2.5 text-muted text-[11px] truncate max-w-[120px]">
                          {l.oldVal}
                        </td>
                        <td className="py-2.5 px-2.5 text-wine-ink font-medium text-[11px] truncate max-w-[150px]">
                          {l.newVal}
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
    </div>
  );
}

/* ── Reusable KPI tile ──────────────────────────────────────────── */

function KPI({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'ok' | 'warn' | 'bad';
}) {
  const cls = {
    default: 'bg-[#F6F4EF] border-line text-ink',
    ok: 'bg-[#EAF3E7] border-[#CAD3C5] text-[#2E7D47]',
    warn: 'bg-[#FDF3DE] border-[#F1DFB7] text-[#84661E]',
    bad: 'bg-[#FBEBE8] border-[#E8C0B9] text-[#A63222]',
  }[tone];

  const labelCls = {
    default: 'text-muted',
    ok: 'text-[#2E7D47]',
    warn: 'text-[#84661E]',
    bad: 'text-[#A63222]',
  }[tone];

  return (
    <div className={`p-2.5 rounded border ${cls}`}>
      <span
        className={`text-[10px] uppercase tracking-wider block ${labelCls}`}
      >
        {label}
      </span>
      <span className="text-xs font-bold block mt-0.5">{value}</span>
      {sub && (
        <span className="text-[10px] text-muted block mt-0.5 leading-tight">
          {sub}
        </span>
      )}
    </div>
  );
}

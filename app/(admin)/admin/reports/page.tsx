import {
  getRevenueReportData,
  getInventoryReportData,
  getReturnsReportData,
  getCustomersReportData,
  getAuditReportData,
} from '@/app/actions/reports';
import ReportsClient, { type ReportRange } from './ReportsClient';

/**
 * Resolves the range preset from the URL into concrete ISO dates.
 *
 *   ?range=all       → no filter (returns '')
 *   ?range=year      → Jan 1 of current year → today
 *   ?range=month     → 1st of current month → today
 *   ?range=custom    → ?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Range is read at the top of the page and applied to every
 * date-filterable report (Revenue · Returns · Audit). Inventory and
 * Customers are lifetime metrics and ignore the range.
 */
function resolveRange(
  raw: string | undefined,
  customStart: string | undefined,
  customEnd: string | undefined,
): { range: ReportRange; start: string; end: string; label: string } {
  const today = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  if (
    raw === 'custom' &&
    customStart &&
    customEnd &&
    /^\d{4}-\d{2}-\d{2}$/.test(customStart) &&
    /^\d{4}-\d{2}-\d{2}$/.test(customEnd)
  ) {
    return {
      range: 'custom',
      start: customStart,
      end: customEnd,
      label: `${customStart} → ${customEnd}`,
    };
  }

  if (raw === 'year') {
    const start = `${today.getFullYear()}-01-01`;
    return {
      range: 'year',
      start,
      end: iso(today),
      label: `This year · ${today.getFullYear()}`,
    };
  }

  if (raw === 'month') {
    const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const monthLabel = today.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
    return {
      range: 'month',
      start,
      end: iso(today),
      label: `This month · ${monthLabel}`,
    };
  }

  return { range: 'all', start: '', end: '', label: 'All time' };
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    start?: string;
    end?: string;
  }>;
}) {
  const resolved = await searchParams;
  const { range, start, end, label } = resolveRange(
    resolved.range,
    resolved.start,
    resolved.end,
  );

  const [
    revenueData,
    inventoryData,
    returnsData,
    customersData,
    auditData,
  ] = await Promise.all([
    getRevenueReportData(start, end),
    getInventoryReportData(),
    getReturnsReportData(start, end),
    getCustomersReportData(),
    getAuditReportData(start, end),
  ]);

  return (
    <ReportsClient
      range={range}
      rangeLabel={label}
      rangeStart={start}
      rangeEnd={end}
      revenueData={revenueData}
      inventoryData={inventoryData}
      returnsData={returnsData}
      customersData={customersData}
      auditData={auditData}
    />
  );
}

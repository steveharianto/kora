'use client';

import { useState, useMemo } from 'react';
import { Download, ChevronDown, ChevronUp, CalendarX } from 'lucide-react';

interface ReportCardWrapperProps {
  title: string;
  subtitle: string;
  reportType: 'revenue' | 'inventory' | 'returns' | 'customers' | 'audit';
  hasDateFilter?: boolean;
  defaultCollapsed?: boolean;
  rows: any[];
  renderContent: (filteredRows: any[]) => React.ReactNode;
}

export default function ReportCardWrapper({
  title,
  subtitle,
  reportType,
  hasDateFilter = true,
  defaultCollapsed = false,
  rows,
  renderContent,
}: ReportCardWrapperProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  // Client-side date filter over rows
  const filteredRows = useMemo(() => {
    if (!hasDateFilter || (!start && !end)) return rows;

    return rows.filter((r) => {
      const rawDate =
        r.date ||
        r.order_date ||
        r.requested_at ||
        r.deadline ||
        r.actualDate ||
        r.timestamp ||
        r.date_joined;
      if (!rawDate) return true;
      const rowDateStr = String(rawDate).split('T')[0].split(' ')[0];

      if (start && rowDateStr < start) return false;
      if (end && rowDateStr > end) return false;
      return true;
    });
  }, [rows, start, end, hasDateFilter]);

  const exportUrl = `/api/admin/reports/${reportType}${
    start || end ? `?start=${start}&end=${end}` : ''
  }`;

  return (
    <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all">
      {/* Header & Controls */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isCollapsed ? 'border-b-0 pb-0' : 'border-b border-line pb-4'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-left group cursor-pointer flex-1"
        >
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-[19px] font-normal tracking-[0.01em] text-ink group-hover:text-wine-ink transition-colors">
              {title}
            </h3>
            <span className="text-muted group-hover:text-ink transition-colors">
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">{subtitle}</p>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {hasDateFilter && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="border border-line rounded px-2 py-1 bg-[#FDFCFA] text-xs text-ink"
                title="Start Date"
              />
              <span>–</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="border border-line rounded px-2 py-1 bg-[#FDFCFA] text-xs text-ink"
                title="End Date"
              />
              {(start || end) && (
                <button
                  type="button"
                  onClick={() => { setStart(''); setEnd(''); }}
                  className="text-xs text-bad hover:underline px-1 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          <a
            href={exportUrl}
            download
            className="px-3 py-1.5 bg-[#1A1F16] text-white rounded-lg text-xs font-semibold hover:bg-black transition flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </a>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 border border-line bg-card rounded-lg text-muted hover:text-ink hover:bg-[#F6F4EF] transition cursor-pointer"
            title={isCollapsed ? 'Expand report' : 'Collapse report'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Content or Zero Results Notification */}
      {!isCollapsed && (
        <div className="space-y-4 pt-4">
          {filteredRows.length === 0 ? (
            <div className="p-8 text-center bg-[#FDFCFA] border border-dashed border-line rounded-lg">
              <CalendarX className="w-6 h-6 text-muted mx-auto mb-2 opacity-60" />
              <p className="text-xs font-semibold text-ink">No historical records found</p>
              <p className="text-[11px] text-muted mt-0.5">
                No data exists for the selected date range ({start || 'any'} to {end || 'today'}). Try picking a broader window or press Clear.
              </p>
            </div>
          ) : (
            renderContent(filteredRows)
          )}
        </div>
      )}
    </div>
  );
}

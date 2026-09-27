'use client';

import { useState } from 'react';
import { Download, ChevronDown, ChevronUp, CalendarX } from 'lucide-react';

interface ReportCardWrapperProps {
  title: string;
  subtitle: string;
  /** Full CSV download URL — includes any range query string. */
  exportUrl: string;
  defaultCollapsed?: boolean;
  rows: any[];
  renderContent: (filteredRows: any[]) => React.ReactNode;
}

/**
 * Collapsible report card. The date-range UI moved up to the Reports
 * page header — presets (All Time / This Year / This Month / Custom)
 * apply globally. The card itself just renders rows and offers a CSV
 * export link that respects the current range.
 */
export default function ReportCardWrapper({
  title,
  subtitle,
  exportUrl,
  defaultCollapsed = false,
  rows,
  renderContent,
}: ReportCardWrapperProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

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
              {isCollapsed ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">{subtitle}</p>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
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
            {isCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Content or zero state */}
      {!isCollapsed && (
        <div className="space-y-4 pt-4">
          {rows.length === 0 ? (
            <div className="p-8 text-center bg-[#FDFCFA] border border-dashed border-line rounded-lg">
              <CalendarX className="w-6 h-6 text-muted mx-auto mb-2 opacity-60" />
              <p className="text-xs font-semibold text-ink">
                No records in this range
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                Try a wider range — pick &ldquo;All Time&rdquo; or a custom
                window above.
              </p>
            </div>
          ) : (
            renderContent(rows)
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function DashboardRangeSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRange = searchParams.get('range') || '30d';
  const currentStart = searchParams.get('start') || '';
  const currentEnd = searchParams.get('end') || '';

  const [draftStart, setDraftStart] = useState(currentStart);
  const [draftEnd, setDraftEnd] = useState(currentEnd);

  // Keep drafts in sync when URL changes (e.g. navigating back)
  useEffect(() => {
    setDraftStart(currentStart);
    setDraftEnd(currentEnd);
  }, [currentStart, currentEnd]);

  const handleRangeChange = (val: string) => {
    if (val === 'custom') {
      const params = new URLSearchParams(searchParams.toString());
      params.set('range', 'custom');
      if (draftStart) params.set('start', draftStart);
      if (draftEnd) params.set('end', draftEnd);
      router.push(`/admin/dashboard?${params.toString()}`);
    } else {
      router.push(`/admin/dashboard?range=${val}`);
    }
  };

  const applyCustom = () => {
    if (!draftStart || !draftEnd || draftStart > draftEnd) return;
    router.push(`/admin/dashboard?range=custom&start=${draftStart}&end=${draftEnd}`);
  };

  const canApply = Boolean(draftStart && draftEnd && draftStart <= draftEnd);

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
        <span className="uppercase tracking-wider text-[10px]">Range</span>
        <select
          value={currentRange}
          onChange={(e) => handleRangeChange(e.target.value)}
          className="px-2.5 py-1 rounded-lg border border-line bg-card text-ink text-xs focus:ring-1 focus:ring-wine focus:outline-none cursor-pointer"
        >
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="month">This month</option>
          <option value="custom">Custom…</option>
        </select>
      </div>

      {currentRange === 'custom' && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)}
            max={draftEnd || undefined}
            className="px-2 py-1 rounded-lg border border-line bg-card text-ink text-xs focus:ring-1 focus:ring-wine focus:outline-none"
          />
          <span className="text-muted">→</span>
          <input
            type="date"
            value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)}
            min={draftStart || undefined}
            className="px-2 py-1 rounded-lg border border-line bg-card text-ink text-xs focus:ring-1 focus:ring-wine focus:outline-none"
          />
          <button
            type="button"
            onClick={applyCustom}
            disabled={!canApply}
            className="px-2.5 py-1 rounded-lg bg-wine text-white text-xs font-medium hover:bg-[#181E15] transition disabled:opacity-40 cursor-pointer"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

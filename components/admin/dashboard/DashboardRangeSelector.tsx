'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function DashboardRangeSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRange = searchParams.get('range') || '30d';

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    router.push(`/admin/dashboard?range=${val}`);
  };

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
      <span className="uppercase tracking-wider text-[10px]">Range</span>
      <select
        value={currentRange}
        onChange={handleChange}
        className="px-2.5 py-1 rounded-lg border border-line bg-card text-ink text-xs focus:ring-1 focus:ring-wine focus:outline-none cursor-pointer"
      >
        <option value="today">Today</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="month">This month</option>
      </select>
    </div>
  );
}

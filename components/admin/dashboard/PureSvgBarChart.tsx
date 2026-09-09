'use client';

import { useMemo } from 'react';
import { formatRupiah } from '@/lib/utils';

interface BarChartProps {
  data: { date: string; amount: number }[];
  height?: number;
}

export default function PureSvgBarChart({ data, height = 170 }: BarChartProps) {
  const maxVal = useMemo(() => {
    const values = data.map((d) => d.amount);
    const m = Math.max(...values, 1000000);
    return Math.ceil(m / 500000) * 500000;
  }, [data]);

  const chartWidth = 560;
  const chartHeight = height;
  const paddingBottom = 24;
  const paddingLeft = 38;
  const usableWidth = chartWidth - paddingLeft - 10;
  const usableHeight = chartHeight - paddingBottom - 10;

  const barWidth = Math.max(6, Math.floor(usableWidth / Math.max(data.length, 1) - 6));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto text-[10px] font-mono text-muted select-none"
      >
        {/* Horizontal Dotted Gridlines */}
        {[0, 0.5, 1].map((ratio) => {
          const y = usableHeight * (1 - ratio) + 10;
          const val = maxVal * ratio;
          const label = val >= 1000000 ? `${(val / 1000000).toFixed(1)} jt` : val > 0 ? `${val / 1000} rb` : '0';
          return (
            <g key={ratio}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={chartWidth - 10}
                y2={y}
                stroke="#EAE6DE"
                strokeDasharray="2 3"
              />
              <text x={paddingLeft - 6} y={y + 3} textAnchor="end" fill="#8C827A">
                {label}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((item, index) => {
          const x = paddingLeft + index * (usableWidth / data.length) + 4;
          const barH = (item.amount / maxVal) * usableHeight;
          const y = usableHeight - barH + 10;

          // Only display date labels for intermittent bars to maintain scannability
          const showLabel = data.length <= 10 || index % Math.ceil(data.length / 8) === 0;

          return (
            <g key={index} className="group cursor-pointer">
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barH, 2)}
                fill="#1A1F16"
                rx={1.5}
                className="transition-colors group-hover:fill-[#5A6253]"
              />
              {showLabel && (
                <text
                  x={x + barWidth / 2}
                  y={chartHeight - 6}
                  textAnchor="middle"
                  fill="#8C827A"
                  fontSize="9.5"
                >
                  {item.date.replace('-', '/')}
                </text>
              )}
              {/* Native SVG Tooltip */}
              <title>{`${item.date}: ${formatRupiah(item.amount)}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

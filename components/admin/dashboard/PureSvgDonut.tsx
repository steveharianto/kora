'use client';

interface DonutProps {
  segments: {
    label: string;
    count: number;
    percent: number;
    color: string;
  }[];
  size?: number;
  strokeWidth?: number;
}

export default function PureSvgDonut({ segments, size = 110, strokeWidth = 14 }: DonutProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Filter non-zero segments and pre-compute dash geometry (avoids mutating during render)
  const validSegments = segments.filter((s) => s.percent > 0);

  let runningOffset = 0;
  const renderedSegments = validSegments.map((segment) => {
    const dashArray = (segment.percent / 100) * circumference;
    const dashOffset = (runningOffset / 100) * circumference;
    runningOffset += segment.percent;
    return { ...segment, dashArray, dashOffset };
  });

  return (
    <div className="flex items-center justify-center gap-6 w-full">
      {/* SVG Donut */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#F1EEE7"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {renderedSegments.map((segment, idx) => (
            <circle
              key={idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segment.dashArray} ${circumference - segment.dashArray}`}
              strokeDashoffset={-segment.dashOffset}
              fill="transparent"
              className="transition-all duration-300 cursor-pointer hover:opacity-80"
            >
              <title>{`${segment.label}: ${segment.count} (${segment.percent}%)`}</title>
            </circle>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="space-y-1 text-xs">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-muted font-medium cursor-help"
            title={`${seg.label}: ${seg.count} (${seg.percent}%)`}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-ink">
              {seg.label} — {seg.count} ({seg.percent}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

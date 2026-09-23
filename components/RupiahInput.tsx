"use client";

import { cn } from "@/lib/utils";

interface RupiahInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Optional prefix shown inside the field, e.g. "Rp" */
  prefix?: string;
}

export default function RupiahInput({
  value,
  onChange,
  disabled,
  placeholder = "0",
  className,
  prefix,
}: RupiahInputProps) {
  const formatted = value ? value.toLocaleString("id-ID") : "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip every non-digit (removes "." thousand separators, spaces, "Rp", etc.)
    const raw = e.target.value.replace(/\D/g, "");

    // Empty field → 0, and allow the field to visually clear
    if (!raw) {
      onChange(0);
      return;
    }

    // Guard against overflow / absurd values
    const parsed = parseInt(raw, 10);
    onChange(Number.isNaN(parsed) ? 0 : parsed);
  };

  return (
    <div className={cn("relative", disabled && "opacity-60")}>
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={formatted}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          "w-full text-[13px] border border-line rounded-lg py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none disabled:bg-[#F6F4EF]",
          prefix ? "pl-9 pr-3" : "px-3",
          className,
        )}
      />
    </div>
  );
}

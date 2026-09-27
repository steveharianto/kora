"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import {
  SIZE_BUCKETS,
  deriveSizeBucket,
  parseNumericOrRange,
  type SizeBucket,
} from "@/lib/sizeBucket";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Optional — when present, the modal highlights the bucket this
   * specific item derives to and shows its origin (label vs measurement).
   */
  contextItem?: {
    sku?: string;
    name?: string;
    size?: string | null;
    measurements?: Record<string, any> | null;
  } | null;
}

export default function SizeGuideModal({ isOpen, onClose, contextItem }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const contextBucket = contextItem
    ? deriveSizeBucket({
        size: contextItem.size,
        measurements: contextItem.measurements,
      })
    : null;

  const contextBust = contextItem
    ? parseNumericOrRange((contextItem.measurements as any)?.outer?.bust)
    : null;

  const contextReason =
    contextBucket && contextItem
      ? explainDerivation(contextItem.size, contextBust, contextBucket)
      : null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[100]"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="bg-store-bg w-full max-w-[720px] my-8 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close size guide"
            className="absolute right-6 top-6 text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer z-10"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>

          <div className="px-8 sm:px-12 pt-12 pb-12">
            <div className="text-[10.5px] tracking-[0.22em] uppercase text-store-fg-muted mb-3">
              Size Guide
            </div>
            <h2 className="font-serif text-[28px] sm:text-[34px] text-store-fg font-normal tracking-[0.01em] mb-4 leading-tight">
              How we size every piece
            </h2>
            <p className="text-[13px] text-store-fg-muted leading-relaxed mb-8 max-w-[540px]">
              Every rental is bucketed into the same six sizes so you can
              filter by what actually fits you — regardless of the label on
              the garment. Below is exactly how each brand&apos;s sizing maps
              to our scale.
            </p>

            {/* The six buckets */}
            <section className="mb-10">
              <h3 className="text-[11px] tracking-[0.18em] uppercase text-store-fg mb-4">
                Our Scale
              </h3>
              <div className="flex flex-wrap gap-2">
                {SIZE_BUCKETS.map((b) => {
                  const isContext = contextBucket === b;
                  return (
                    <span
                      key={b}
                      className={`inline-flex items-center px-3 py-1.5 text-[12px] tracking-[0.06em] uppercase border transition-colors ${
                        isContext
                          ? "bg-store-accent text-white border-store-accent"
                          : "bg-transparent text-store-fg border-store-border-strong"
                      }`}
                    >
                      {b}
                      {isContext && (
                        <span className="ml-2 text-[10px] opacity-90">
                          ← this item
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </section>

            {/* Context callout — only when opened from a product */}
            {contextItem && contextReason && (
              <section className="mb-10 p-4 border border-store-border-strong bg-[#F1EFE1]">
                <div className="text-[10.5px] tracking-[0.18em] uppercase text-store-fg-muted mb-2">
                  This piece
                </div>
                <div className="text-[13px] text-store-fg leading-relaxed">
                  {contextItem.sku && (
                    <span className="font-mono font-semibold mr-2">
                      {contextItem.sku}
                    </span>
                  )}
                  {contextItem.name && (
                    <span className="font-serif">{contextItem.name}</span>
                  )}
                </div>
                <div className="mt-3 space-y-1 text-[12.5px] text-store-fg-muted">
                  <div>
                    <span className="text-store-fg">Label on garment:</span>{" "}
                    {contextItem.size?.trim() || "—"}
                  </div>
                  {contextBust !== null && (
                    <div>
                      <span className="text-store-fg">
                        Outer bust measurement:
                      </span>{" "}
                      {contextBust} cm
                    </div>
                  )}
                  <div>
                    <span className="text-store-fg">Filters as:</span>{" "}
                    <strong className="text-store-fg">{contextBucket}</strong>
                  </div>
                  <div className="pt-1 italic text-store-fg-subtle">
                    {contextReason}
                  </div>
                </div>
              </section>
            )}

            {/* Conversion tables */}
            <section className="mb-10">
              <h3 className="text-[11px] tracking-[0.18em] uppercase text-store-fg mb-4">
                Zimmermann Sizing
              </h3>
              <ChartTable
                headers={["Zimmermann label", "Filters as"]}
                rows={[
                  ["Size 0 / 0P / OP", "XS"],
                  ["Size 1", "S"],
                  ["Size 2", "M"],
                  ["Size 3", "L"],
                  ["Size 4", "XL"],
                ]}
              />
            </section>

            <section className="mb-10">
              <h3 className="text-[11px] tracking-[0.18em] uppercase text-store-fg mb-4">
                International Sizing
              </h3>
              <ChartTable
                headers={["UK", "AUS", "US", "Filters as"]}
                rows={[
                  ["4 – 6", "6", "0 – 2", "XS"],
                  ["8", "8", "4", "S"],
                  ["10", "10", "6", "M"],
                  ["12", "12", "8", "L"],
                  ["14+", "14+", "10+", "XL"],
                ]}
              />
            </section>

            <section className="mb-10">
              <h3 className="text-[11px] tracking-[0.18em] uppercase text-store-fg mb-4">
                By Bust Measurement
              </h3>
              <p className="text-[12.5px] text-store-fg-muted leading-relaxed mb-4 max-w-[540px]">
                When a garment has no brand label, or the label isn&apos;t
                recognised, we fall back to the outer bust measurement.
              </p>
              <ChartTable
                headers={["Outer bust (cm)", "Filters as"]}
                rows={[
                  ["Up to 80", "XS"],
                  ["81 – 86", "S"],
                  ["87 – 92", "M"],
                  ["93 – 98", "L"],
                  ["99 – 106", "XL"],
                  ["106+ or 'free size'", "Free Size"],
                ]}
              />
            </section>

            {/* Notes */}
            <section className="pt-6 border-t border-store-border space-y-3 text-[12.5px] text-store-fg-muted leading-relaxed">
              <p>
                <span className="text-store-fg font-medium">
                  Compound sets.
                </span>{" "}
                For two-piece sets (Top + Pants), we anchor on the{" "}
                <span className="text-store-fg">top&apos;s</span> size — the
                torso fit is the more sensitive dimension for filtering.
              </p>
              <p>
                <span className="text-store-fg font-medium">Free Size.</span>{" "}
                Garments marked &ldquo;free size&rdquo;, &ldquo;all size&rdquo;,
                or stretchy ranges (bust span wider than ~25 cm) bucket here.
              </p>
              <p>
                <span className="text-store-fg font-medium">Ranges.</span>{" "}
                When a label lists a range (e.g. &ldquo;80 – 110&rdquo;), we
                use the midpoint — unless the range is wider than 25 cm, in
                which case the piece is treated as Free Size.
              </p>
              <p className="pt-2 text-store-fg-subtle text-[11.5px]">
                Still unsure? Message us on WhatsApp and we&apos;ll recommend
                a piece for your measurements.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function explainDerivation(
  rawSize: string | null | undefined,
  bustCm: number | null,
  bucket: SizeBucket,
): string {
  const s = (rawSize || "").trim().toLowerCase();

  if (s === "free size" || s === "freesize" || s === "all size") {
    return "The brand labels this piece as free size.";
  }

  // Detect which rule fired by testing each parser in isolation.
  if (s) {
    if (/\b(uk|us|aus)\s*\d+/.test(s)) {
      return "Converted from the international size label above.";
    }
    if (/^(size\s*)?[0-4]p?$/.test(s) || /^op$/.test(s)) {
      return "Converted from Zimmermann's own numeric scale.";
    }
    if (s.includes("top") && s.includes("pants")) {
      return "Compound set — bucketed by the top's size.";
    }
    // Plain letter that matched
    if (/^(xs|s|m|l|xl|xxl|xxxl|2xl|3xl)$/.test(s)) {
      return "The label on this garment is already a letter size.";
    }
  }

  if (bustCm !== null) {
    return `No recognised label — derived from the ${bustCm} cm outer bust measurement.`;
  }

  return `Bucketed as ${bucket} from the available fit data.`;
}

function ChartTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="border border-store-border-strong bg-white/60">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-white">
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-store-border-strong px-4 py-3 text-left font-semibold text-store-fg tracking-[0.02em]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 1 ? "bg-[#F9F8F2]/60" : ""}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 text-store-fg-muted ${
                    i < rows.length - 1 ? "border-b border-[#E5E2D4]" : ""
                  } ${j === row.length - 1 ? "font-medium text-store-fg" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

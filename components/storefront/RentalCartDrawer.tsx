"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  readRentalCart,
  writeRentalCart,
  rentalCartSubtotal,
  type RentalCartItem,
} from "@/lib/storefront/cart";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCheckout?: () => void;
}

export default function RentalCartDrawer({ isOpen, onClose, onCheckout }: Props) {
  const [items, setItems] = useState<RentalCartItem[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setItems(readRentalCart());
    const refresh = () => setItems(readRentalCart());
    window.addEventListener("storage", refresh);
    window.addEventListener("kora-cart-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("kora-cart-updated", refresh);
    };
  }, [isOpen]);

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

  const removeAt = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    writeRentalCart(next);
  };

  // Subtotal = Σ(unit price × event days) per line.
  const subtotal = rentalCartSubtotal(items);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[60]" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-label="Rental cart"
        className="fixed top-0 right-0 bottom-0 w-full max-w-[600px] bg-store-bg z-[70] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-8 sm:px-10 pt-8 sm:pt-10 pb-8">
          <h2 className="font-serif text-[36px] sm:text-[44px] text-store-accent leading-none font-normal">
            Cart ({items.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer mt-2"
          >
            <X className="w-6 h-6" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 sm:px-10 pb-8">
          {items.length === 0 ? (
            <p className="text-[13px] text-store-fg-muted">Shopping cart is empty.</p>
          ) : (
            <div className="space-y-8">
              {items.map((it, idx) => (
                <CartRow key={`${it.sku}-${idx}`} item={it} onRemove={() => removeAt(idx)} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-8 sm:px-10 pt-6 pb-8 border-t border-store-border">
            <div className="flex items-baseline justify-between mb-6">
              <span className="font-serif text-[30px] sm:text-[36px] text-store-fg leading-none font-normal">
                Subtotal
              </span>
              <span className="text-[22px] sm:text-[26px] text-store-fg font-semibold leading-none">
                Rp {subtotal.toLocaleString("id-ID")}
              </span>
            </div>
            <button
              type="button"
              onClick={onCheckout}
              className="w-full py-4 bg-store-accent text-white text-[12px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer"
            >
              Checkout
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

/* ── Row ─────────────────────────────────────────────────────────── */

function CartRow({
  item,
  onRemove,
}: {
  item: RentalCartItem;
  onRemove: () => void;
}) {
  const days = item.eventDays || 1;
  const lineTotal = item.price * days;

  return (
    <div className="flex gap-4 sm:gap-5">
      <div className="w-20 sm:w-24 aspect-[3/4] flex-shrink-0 bg-[#E2E0D6] overflow-hidden">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-serif text-[14.5px] sm:text-[16px] text-store-fg leading-snug mb-1.5">
          {item.sku}-{item.name}
        </h3>
        {days > 1 && (
          <p className="text-[11.5px] text-store-fg-muted mb-0.5">
            Rp {item.price.toLocaleString("id-ID")} × {days} days
          </p>
        )}
        <p className="text-[13.5px] sm:text-[14px] text-store-fg font-semibold mb-3">
          Rp {lineTotal.toLocaleString("id-ID")}
        </p>
        <div className="space-y-0.5 text-[11.5px] sm:text-[12px] text-store-fg-muted">
          <p>Rental Date&nbsp;&nbsp;{fmtDateRange(item.rentalStart, item.rentalEnd)}</p>
          <p>Returning Date&nbsp;&nbsp;{fmtLongDate(item.rentalEnd)}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="self-start text-[10.5px] sm:text-[11px] tracking-[0.18em] uppercase text-store-fg-muted underline underline-offset-4 hover:text-store-fg transition-colors cursor-pointer flex-shrink-0 pt-1"
      >
        Remove
      </button>
    </div>
  );
}

/* ── Date helpers ────────────────────────────────────────────────── */

function fmtLongDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDateRange(start: string, end: string) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${sd}–${ed} ${e.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`;
  }
  return `${fmtLongDate(start)} – ${fmtLongDate(end)}`;
}

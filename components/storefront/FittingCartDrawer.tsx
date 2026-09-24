"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  readFittingCart,
  writeFittingCart,
  type FittingSession,
} from "@/lib/storefront/cart";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function FittingCartDrawer({ isOpen, onClose }: Props) {
  const [sessions, setSessions] = useState<FittingSession[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowSuccess(false);
      return;
    }
    setSessions(readFittingCart());
    const refresh = () => setSessions(readFittingCart());
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

  const totalItems = sessions.reduce((n, s) => n + s.items.length, 0);
  const totalFee = sessions.reduce((n, s) => n + s.fee, 0);
  const anyPaid = totalFee > 0;

  const removeItem = (sIdx: number, iIdx: number) => {
    const next = sessions
      .map((s, i) => {
        if (i !== sIdx) return s;
        return { ...s, items: s.items.filter((_, j) => j !== iIdx) };
      })
      .filter((s) => s.items.length > 0);
    writeFittingCart(next);
  };

  const removeSession = (sIdx: number) => {
    const next = sessions.filter((_, i) => i !== sIdx);
    writeFittingCart(next);
  };

  const handleBook = () => {
    // TODO(Phase 2): POST to /api/fittings/book to create fitting records in DB,
    // attach items, then return; on success, clear the cart and show SuccessView.
    writeFittingCart([]);
    setShowSuccess(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[60]" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-label="Fitting session cart"
        className="fixed top-0 right-0 bottom-0 w-full max-w-[600px] bg-store-bg z-[70] flex flex-col shadow-2xl"
      >
        {showSuccess ? (
          <SuccessView onClose={onClose} />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between px-8 sm:px-10 pt-8 sm:pt-10 pb-8 gap-4">
              <h2 className="font-serif text-[24px] sm:text-[30px] text-store-accent leading-[1.15] font-normal">
                Book Fitting Session Cart ({totalItems})
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close cart"
                className="text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer mt-1 flex-shrink-0"
              >
                <X className="w-6 h-6" strokeWidth={1.5} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-8 sm:px-10 pb-8">
              {sessions.length === 0 ? (
                <p className="text-[13px] text-store-fg-muted">
                  Book fitting session cart is empty.
                </p>
              ) : (
                <div className="space-y-5">
                  {sessions.map((s, sIdx) => (
                    <SessionCard
                      key={`${s.date}-${s.slot}-${sIdx}`}
                      session={s}
                      onRemoveItem={(iIdx) => removeItem(sIdx, iIdx)}
                      onRemoveSession={() => removeSession(sIdx)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {sessions.length > 0 && (
              <div className="px-8 sm:px-10 pt-6 pb-8 border-t border-store-border">
                <div className="flex items-baseline justify-between mb-6">
                  <span className="font-serif text-[30px] sm:text-[36px] text-store-fg leading-none font-normal">
                    Subtotal
                  </span>
                  <span className="text-[22px] sm:text-[26px] text-store-fg font-semibold leading-none">
                    {totalFee > 0 ? `Rp ${totalFee.toLocaleString("id-ID")}` : "FREE"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleBook}
                  className="w-full py-4 bg-store-accent text-white text-[12px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer"
                >
                  {anyPaid ? "Pay & Book Fitting Session" : "Book Fitting Session"}
                </button>
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}

/* ── Session card ────────────────────────────────────────────────── */

function SessionCard({
  session,
  onRemoveItem,
  onRemoveSession,
}: {
  session: FittingSession;
  onRemoveItem: (i: number) => void;
  onRemoveSession: () => void;
}) {
  return (
    <div className="border border-store-border bg-[#F1EFE1] p-5 sm:p-6">
      {/* Session header */}
      <div className="flex justify-between items-start gap-3 mb-1">
        <h3 className="font-serif text-[15px] sm:text-[17px] text-store-fg leading-tight font-normal">
          {fmtLongWeekday(session.date)}
        </h3>
        <span className="text-[11.5px] text-store-fg-muted font-medium flex-shrink-0">
          {session.items.length} {session.items.length === 1 ? "Item" : "Items"}
        </span>
      </div>
      <p className="text-[12.5px] text-store-fg-muted mb-5">{fmtSlot(session.slot)}</p>

      {/* Items */}
      <div className="border-t border-[#E5E2D4] pt-4 space-y-4">
        {session.items.map((it, i) => (
          <div key={`${it.sku}-${i}`} className="flex gap-3 items-start">
            <div className="w-16 aspect-[3/4] flex-shrink-0 bg-[#E2E0D6] overflow-hidden">
              {it.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-serif text-[13px] sm:text-[14px] text-store-fg leading-snug mb-1">
                {it.sku}-{it.name}
              </p>
              <p className="text-[12.5px] sm:text-[13px] text-store-fg font-semibold">
                Rp {it.price.toLocaleString("id-ID")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemoveItem(i)}
              className="self-start text-[10px] sm:text-[10.5px] tracking-[0.18em] uppercase text-store-fg-muted underline underline-offset-4 hover:text-store-fg transition-colors cursor-pointer flex-shrink-0 pt-0.5"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Session footer */}
      <div className="border-t border-[#E5E2D4] mt-5 pt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onRemoveSession}
          className="text-[10.5px] sm:text-[11px] tracking-[0.16em] uppercase text-store-fg-muted underline underline-offset-4 hover:text-store-fg transition-colors cursor-pointer text-left"
          title="Remove this session and pick a new date & time"
        >
          Change Date &amp; Time
        </button>
        <span className="text-[12.5px] sm:text-[13px] text-store-fg whitespace-nowrap">
          Fitting Session Fee:{" "}
          <strong>{session.fee > 0 ? `Rp ${session.fee.toLocaleString("id-ID")}` : "FREE"}</strong>
        </span>
      </div>
    </div>
  );
}

/* ── Success view ────────────────────────────────────────────────── */

function SuccessView({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <h2 className="font-serif text-[26px] sm:text-[34px] text-store-accent leading-[1.35] font-normal mb-12">
        Thank you for booking your fitting session!
        <br />
        See you at our studio
      </h2>
      <button
        type="button"
        onClick={onClose}
        className="px-10 py-3 bg-store-accent text-white text-[11px] tracking-[0.24em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer"
      >
        Close
      </button>
    </div>
  );
}

/* ── Date/time helpers ───────────────────────────────────────────── */

function fmtLongWeekday(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtSlot(slot: string) {
  const h = slot.split(":")[0];
  const nh = String(parseInt(h, 10) + 1).padStart(2, "0");
  return `${h}.00 – ${nh}.00`;
}

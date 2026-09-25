"use client";

import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import {
  readFittingCart,
  writeFittingCart,
  type FittingSession,
} from "@/lib/storefront/cart";
import { createFittingBooking } from "@/app/actions/customerFittingBooking";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function FittingCartDrawer({ isOpen, onClose }: Props) {
  const [sessions, setSessions] = useState<FittingSession[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setShowSuccess(false);
      setError("");
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
    writeFittingCart(sessions.filter((_, i) => i !== sIdx));
  };

  const handleBook = async () => {
    if (sessions.length === 0) return;
    setSubmitting(true);
    setError("");

    const res = await createFittingBooking(
      sessions.map((s) => ({
        date: s.date,
        slot: s.slot,
        fee: s.fee,
        isAfterHours: s.isAfterHours,
        skus: s.items.map((i) => i.sku),
      })),
    );

    setSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    // Clear local cart — the booking now lives server-side
    writeFittingCart([]);

    if (res.invoiceUrl) {
      window.location.href = res.invoiceUrl;
      return;
    }

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
                <>
                  {/* ⚠️ Eviction warning */}
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 flex gap-3">
                    <AlertTriangle
                      className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5"
                      strokeWidth={1.8}
                    />
                    <div className="text-[11.5px] text-amber-900 leading-relaxed">
                      <strong className="block mb-1 tracking-wide uppercase text-[10px]">
                        Heads up
                      </strong>
                      A fitting doesn&apos;t reserve your piece. If another customer completes a paid
                      rental for one of your selected dresses before your session, this fitting will
                      be automatically cancelled and our team will refund your session fee.
                    </div>
                  </div>

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
                </>
              )}

              {error && (
                <div className="mt-5 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-[12px]">
                  {error}
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
                  disabled={submitting}
                  className="w-full py-4 bg-store-accent text-white text-[12px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting
                    ? "Processing…"
                    : anyPaid
                      ? "Pay & Book Fitting Session"
                      : "Book Fitting Session"}
                </button>
                {anyPaid && (
                  <p className="text-[11px] text-store-fg-muted text-center mt-3 leading-relaxed">
                    You&apos;ll be redirected to Xendit to pay the after-hours session fee securely.
                  </p>
                )}
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
      <div className="flex justify-between items-start gap-3 mb-1">
        <h3 className="font-serif text-[15px] sm:text-[17px] text-store-fg leading-tight font-normal">
          {fmtLongWeekday(session.date)}
        </h3>
        <span className="text-[11.5px] text-store-fg-muted font-medium flex-shrink-0">
          {session.items.length} {session.items.length === 1 ? "Item" : "Items"}
        </span>
      </div>
      <p className="text-[12.5px] text-store-fg-muted mb-5">{fmtSlot(session.slot)}</p>

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

      <div className="border-t border-[#E5E2D4] mt-5 pt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onRemoveSession}
          className="text-[10.5px] sm:text-[11px] tracking-[0.16em] uppercase text-store-fg-muted underline underline-offset-4 hover:text-store-fg transition-colors cursor-pointer text-left"
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

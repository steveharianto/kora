"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cancelFitting } from "@/app/actions/customerFittings";
import ConfirmationModal from "@/components/storefront/ConfirmationModal";

const CANCELLATION_FEE = 100000;
const FEE_WINDOW_HOURS = 24;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fitting: { id: string; date: string; slot: string } | null;
  onCompleted: () => void;
}

export default function CancelFittingModal({
  isOpen,
  onClose,
  fitting,
  onCompleted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setDone(false);
      setLoading(false);
    }
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

  // Fee preview — mirrors server logic
  const fee = (() => {
    if (!fitting) return 0;
    const sessionDateTime = new Date(`${fitting.date}T${fitting.slot}`);
    const hoursUntil = (sessionDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < 0) return 0;
    return hoursUntil < FEE_WINDOW_HOURS ? CANCELLATION_FEE : 0;
  })();

  const handleCancel = async () => {
    if (!fitting) return;
    setLoading(true);
    setError("");
    const res = await cancelFitting(fitting.id);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDone(true);
    onCompleted();
  };

  if (!isOpen || !fitting) return null;

  if (done) {
    return (
      <ConfirmationModal
        isOpen
        onClose={onClose}
        title="Your fitting session has been cancelled."
        subtitle="We hope to see you another time."
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[80]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="bg-store-bg w-full max-w-[820px] my-8 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-6 top-6 text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>

          <h2 className="font-serif text-[26px] sm:text-[34px] text-store-accent text-center pt-12 pb-6 font-normal">
            Cancel Fitting Session?
          </h2>

          <div className="px-6 sm:px-12 pb-12 text-center">
            <p className="text-[13px] text-store-fg-muted max-w-[620px] mx-auto leading-relaxed mb-10">
              Cancellations made within 24 hours of your scheduled fitting session are subject to a
              cancellation fee.
            </p>

            {error && (
              <div className="max-w-[480px] mx-auto mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-[12px]">
                {error}
              </div>
            )}

            <div className="max-w-[480px] mx-auto border border-store-border-strong px-6 py-4 flex items-center justify-between mb-10">
              <span className="text-[13.5px] text-store-fg-muted">Cancellation Fee</span>
              <span className="text-[15px] text-store-fg font-semibold">
                {fee > 0 ? `Rp ${fee.toLocaleString("id-ID")}` : "Free"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-12 py-3.5 bg-store-accent text-white text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading
                ? "Cancelling…"
                : fee > 0
                  ? "Pay & Cancel"
                  : "Cancel Session"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

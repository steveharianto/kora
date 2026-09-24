"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { rescheduleFitting } from "@/app/actions/customerFittings";
import WeekSlotPicker, {
  type SlotSelection,
} from "@/components/storefront/WeekSlotPicker";
import ConfirmationModal from "@/components/storefront/ConfirmationModal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fitting: { id: string; date: string; slot: string } | null;
  onCompleted: () => void;
}

export default function RescheduleFittingModal({
  isOpen,
  onClose,
  fitting,
  onCompleted,
}: Props) {
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelection(null);
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

  const handleReschedule = async () => {
    if (!fitting || !selection) return;
    setLoading(true);
    setError("");
    const res = await rescheduleFitting(fitting.id, selection);
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
        title="Your fitting session has been rescheduled."
        subtitle="We look forward to seeing you at the new time."
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[80]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="bg-store-bg w-full max-w-[1280px] my-8 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-6 top-6 text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>

          <h2 className="font-serif text-[26px] sm:text-[34px] text-store-accent text-center pt-12 pb-10 font-normal">
            Reschedule Fitting Session
          </h2>

          <div className="px-6 sm:px-10 pb-6">
            {error && (
              <div className="max-w-[520px] mx-auto mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-[12px] text-center">
                {error}
              </div>
            )}

            <WeekSlotPicker
              value={selection}
              onChange={setSelection}
              excludeFittingId={fitting.id}
            />
          </div>

          <div className="flex justify-center pb-12">
            <button
              type="button"
              onClick={handleReschedule}
              disabled={!selection || loading}
              className={`px-12 py-3.5 text-[11px] tracking-[0.22em] uppercase font-medium transition-colors cursor-pointer ${
                selection && !loading
                  ? "bg-store-accent text-white hover:bg-store-accent-hover"
                  : "bg-[#C5C5C5] text-white cursor-not-allowed"
              }`}
            >
              {loading ? "Rescheduling…" : "Reschedule"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

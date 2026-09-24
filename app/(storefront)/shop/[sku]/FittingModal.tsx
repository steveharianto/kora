"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import WeekSlotPicker, {
  type SlotSelection,
} from "@/components/storefront/WeekSlotPicker";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sku: string;
  onAdded: (payload: { date: string; slot: string; sku: string }) => void;
}

export default function FittingModal({ isOpen, onClose, sku, onAdded }: Props) {
  const [selection, setSelection] = useState<SlotSelection | null>(null);

  useEffect(() => {
    if (isOpen) setSelection(null);
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

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!selection) return;
    onAdded({ date: selection.date, slot: selection.slot, sku });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[60]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="bg-store-bg w-full max-w-[1280px] my-8 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-6 top-6 text-store-fg-muted hover:text-store-fg cursor-pointer"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>

          <h2 className="font-serif text-[32px] sm:text-[40px] text-store-accent text-center pt-10 pb-8">
            Book Fitting Session
          </h2>

          <div className="px-6 sm:px-10 pb-6">
            <WeekSlotPicker value={selection} onChange={setSelection} />
          </div>

          <div className="flex justify-center pb-12">
            <button
              type="button"
              disabled={!selection}
              onClick={handleAdd}
              className={`px-10 py-3 text-[11px] tracking-[0.2em] uppercase font-medium transition-colors cursor-pointer ${
                selection
                  ? "bg-store-accent text-white hover:bg-store-accent-hover"
                  : "bg-[#C5C5C5] text-white cursor-not-allowed"
              }`}
            >
              Add to Book Fitting Cart
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

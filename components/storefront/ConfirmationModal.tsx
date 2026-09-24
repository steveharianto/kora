"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  buttonLabel?: string;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  title,
  subtitle,
  buttonLabel = "Close",
}: Props) {
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

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[80]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-8">
        <div className="bg-store-bg w-full max-w-[1200px] relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-6 top-6 text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" strokeWidth={1.5} />
          </button>

          <div className="py-24 sm:py-32 px-6 text-center">
            <h2 className="font-serif text-[28px] sm:text-[40px] text-store-accent leading-[1.3] font-normal mb-5 max-w-[720px] mx-auto">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[13px] sm:text-[14px] text-store-fg-muted max-w-[520px] mx-auto mb-16 leading-relaxed">
                {subtitle}
              </p>
            )}
            {!subtitle && <div className="mb-16" />}
            <button
              type="button"
              onClick={onClose}
              className="px-10 py-3.5 bg-store-accent text-white text-[11px] tracking-[0.24em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer"
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

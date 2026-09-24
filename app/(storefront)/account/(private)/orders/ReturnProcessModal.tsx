"use client";

import { useState, useEffect } from "react";
import { X, ArrowLeft } from "lucide-react";
import {
  requestReturn,
  submitSelfReturn,
} from "@/app/actions/customerReturns";
import ConfirmationModal from "@/components/storefront/ConfirmationModal";

type Step = "choose" | "self-form" | "submitting" | "done";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
  onCompleted: () => void;
}

const COURIERS = [
  "JNE - REG",
  "JNE - YES",
  "SiCepat - REG",
  "Gosend - Instant",
  "Paxel - Medium",
];

function todayISO() {
  return new Date().toISOString().split("T")[0];
}
function maxDateISO() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
}

export default function ReturnProcessModal({
  isOpen,
  onClose,
  orderId,
  onCompleted,
}: Props) {
  const [step, setStep] = useState<Step>("choose");
  const [courier, setCourier] = useState("");
  const [returnDate, setReturnDate] = useState(todayISO());
  const [trackingNumber, setTrackingNumber] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setStep("choose");
      setCourier("");
      setReturnDate(todayISO());
      setTrackingNumber("");
      setError("");
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

  const handleKoraHelps = async () => {
    if (!orderId) return;
    setStep("submitting");
    setError("");
    const res = await requestReturn(orderId);
    if (res.error) {
      setError(res.error);
      setStep("choose");
      return;
    }
    setStep("done");
    onCompleted();
  };

  const handleSelfReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) return;
    setStep("submitting");
    setError("");
    const res = await submitSelfReturn(orderId, {
      courier,
      returnDate,
      trackingNumber,
    });
    if (res.error) {
      setError(res.error);
      setStep("self-form");
      return;
    }
    setStep("done");
    onCompleted();
  };

  if (!isOpen) return null;

  if (step === "done") {
    return (
      <ConfirmationModal
        isOpen
        onClose={onClose}
        title="Thank you for confirming!"
        subtitle="The KORA team will be in touch with you within 24 hours."
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[80]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="bg-store-bg w-full max-w-[1080px] my-8 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-6 top-6 text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" strokeWidth={1.5} />
          </button>

          {step === "self-form" && (
            <button
              type="button"
              onClick={() => {
                setStep("choose");
                setError("");
              }}
              aria-label="Back"
              className="absolute left-6 top-6 text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-6 h-6" strokeWidth={1.5} />
            </button>
          )}

          <h2 className="font-serif text-[28px] sm:text-[36px] text-store-accent text-center pt-12 pb-12 font-normal">
            {step === "self-form" ? "Return by Yourself" : "Return Process"}
          </h2>

          <div className="px-6 sm:px-12 pb-14">
            {error && (
              <div className="max-w-[520px] mx-auto mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-[12px] text-center">
                {error}
              </div>
            )}

            {step === "choose" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-[840px] mx-auto">
                <ChoiceCard
                  title="Kora Helps You"
                  body="We'll arrange a convenient pick-up for your return. Simply schedule a time, and our team will collect it from your doorstep."
                  icon={<KoraHelpsIcon />}
                  onClick={handleKoraHelps}
                />
                <ChoiceCard
                  title="Return It Yourself"
                  body="Prefer to arrange the return yourself? Please enter your return details below. This will help us track your return efficiently."
                  icon={<ReturnYourselfIcon />}
                  onClick={() => setStep("self-form")}
                />
              </div>
            )}

            {step === "self-form" && (
              <form onSubmit={handleSelfReturn} className="max-w-[600px] mx-auto space-y-6">
                <p className="text-center text-[13px] text-store-fg-muted mb-8">
                  Please enter your return details below so we can track your return smoothly.
                </p>

                <div>
                  <label className="block text-[12.5px] text-store-fg-muted mb-2">
                    Courier
                  </label>
                  <select
                    required
                    value={courier}
                    onChange={(e) => setCourier(e.target.value)}
                    className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent cursor-pointer"
                  >
                    <option value="">Select Courier</option>
                    {COURIERS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[12.5px] text-store-fg-muted mb-2">
                    Return Date
                  </label>
                  <input
                    type="date"
                    required
                    min={todayISO()}
                    max={maxDateISO()}
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent"
                  />
                </div>

                <div>
                  <label className="block text-[12.5px] text-store-fg-muted mb-2">
                    Tracking Number
                  </label>
                  <input
                    required
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. JNE-1234567890"
                    className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent font-mono"
                  />
                </div>

                <div className="pt-6 flex justify-center">
                  <button
                    type="submit"
                    className="px-12 py-3.5 bg-store-accent text-white text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer"
                  >
                    Confirm Return
                  </button>
                </div>
              </form>
            )}

            {step === "submitting" && (
              <div className="py-24 text-center">
                <p className="text-[13px] text-store-fg-muted">
                  Processing your return…
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ChoiceCard({
  title,
  body,
  icon,
  onClick,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-store-fg/20 hover:border-store-accent bg-transparent p-8 sm:p-10 text-center transition-colors cursor-pointer flex flex-col items-center"
    >
      <div className="text-store-accent mb-6">{icon}</div>
      <h3 className="font-serif text-[20px] text-store-fg mb-4 font-normal">{title}</h3>
      <p className="text-[12.5px] text-store-fg-muted leading-relaxed">{body}</p>
    </button>
  );
}

function KoraHelpsIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="w-14 h-14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="20" y="6" width="24" height="16" />
      <path d="M26 12h12M26 16h8" />
      <path d="M14 40l6-6 6 4 14-12" />
      <path d="M34 30v16a2 2 0 0 0 2 2h14" />
    </svg>
  );
}

function ReturnYourselfIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="w-14 h-14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="42" cy="16" r="5" />
      <path d="M42 22v14l-6 6v14" />
      <path d="M42 36l8 6v10" />
      <rect x="14" y="28" width="16" height="20" />
      <path d="M18 34h8M18 38h8M18 42h5" />
    </svg>
  );
}

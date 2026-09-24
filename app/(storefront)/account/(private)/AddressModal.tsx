"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { saveCustomerAddress } from "@/app/actions/customerProfile";
import AddressMapPicker from "@/components/AddressMapPicker";

interface AddressFormData {
  id?: number;
  label: string;
  street_address: string;
  city: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
}

const EMPTY: AddressFormData = {
  label: "Home",
  street_address: "",
  city: "",
  postal_code: "",
  latitude: null,
  longitude: null,
  is_default: false,
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initial: AddressFormData | null;
  onSaved: () => void;
}

export default function AddressModal({ isOpen, onClose, initial, onSaved }: Props) {
  const [form, setForm] = useState<AddressFormData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      initial
        ? {
            id: initial.id,
            label: initial.label || "Home",
            street_address: initial.street_address || "",
            city: initial.city || "",
            postal_code: initial.postal_code || "",
            latitude: initial.latitude ?? null,
            longitude: initial.longitude ?? null,
            is_default: initial.is_default ?? false,
          }
        : EMPTY,
    );
    setError("");
  }, [isOpen, initial]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await saveCustomerAddress({
      id: form.id,
      label: form.label,
      street_address: form.street_address,
      city: form.city,
      postal_code: form.postal_code,
      latitude: form.latitude,
      longitude: form.longitude,
      is_default: form.is_default,
    });

    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    onSaved();
    onClose();
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[80]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="bg-store-bg w-full max-w-[760px] my-8 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-6 top-6 text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>

          <h2 className="font-serif text-[26px] sm:text-[30px] text-store-accent text-center pt-10 pb-2 font-normal">
            {initial ? "Edit Address" : "Add New Address"}
          </h2>
          <p className="text-center text-[12.5px] text-store-fg-muted mb-8 max-w-[520px] mx-auto px-4">
            Search for an address or drag the pin on the map to set your delivery coordinates.
          </p>

          <form onSubmit={handleSubmit} className="px-6 sm:px-12 pb-12 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-[12px]">
                {error}
              </div>
            )}

            {/* Map + address search */}
            <AddressMapPicker
              initialData={{
                street_address: form.street_address,
                city: form.city,
                postal_code: form.postal_code,
                latitude: form.latitude,
                longitude: form.longitude,
              }}
              onChange={(loc) =>
                setForm((prev) => ({
                  ...prev,
                  street_address: loc.street_address || prev.street_address,
                  city: loc.city || prev.city,
                  postal_code: loc.postal_code || prev.postal_code,
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                }))
              }
            />

            {/* Label + City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-store-fg-muted mb-2">
                  Address Label
                </label>
                <input
                  value={form.label}
                  placeholder="Home, Office, Studio..."
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-store-fg-muted mb-2">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent"
                />
              </div>
            </div>

            {/* Full street address */}
            <div>
              <label className="block text-[11px] tracking-[0.14em] uppercase text-store-fg-muted mb-2">
                Full Address <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={form.street_address}
                onChange={(e) => setForm({ ...form, street_address: e.target.value })}
                placeholder="Street name, house/building number, RT/RW, landmarks..."
                className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent resize-none"
              />
            </div>

            {/* Postal + Coordinates */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-store-fg-muted mb-2">
                  Postal Code
                </label>
                <input
                  value={form.postal_code}
                  onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                  className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-store-fg-muted mb-2">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.latitude ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      latitude: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-store-fg-muted mb-2">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.longitude ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      longitude: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent font-mono"
                />
              </div>
            </div>

            {/* Default toggle */}
            <label className="flex items-center gap-3 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                className="sr-only"
              />
              <span
                className={`w-4 h-4 border flex-shrink-0 transition-colors ${
                  form.is_default
                    ? "bg-store-accent border-store-accent"
                    : "border-store-border-strong"
                }`}
              />
              <span className="text-[13px] text-store-fg">
                Set as default address
              </span>
            </label>

            {/* Actions */}
            <div className="pt-5 flex justify-end gap-3 border-t border-store-border mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-store-fg text-store-fg text-[11px] tracking-[0.2em] uppercase font-medium hover:bg-store-hover/50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-store-accent text-white text-[11px] tracking-[0.2em] uppercase font-medium hover:bg-store-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Saving…" : "Save Address"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

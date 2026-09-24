"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { changeCustomerPassword } from "@/app/actions/customerAuth";

export default function ChangePasswordModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMsg(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const res = await changeCustomerPassword(form);
    if (res.error) setMsg({ type: "err", text: res.error });
    else {
      setMsg({ type: "ok", text: "Password updated." });
      setTimeout(() => onClose(), 1200);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  const field = (label: string, key: keyof typeof form) => (
    <div>
      <label className="block text-[12.5px] text-store-fg-muted mb-2">{label}</label>
      <input
        type="password"
        required
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent font-mono"
      />
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[80]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="bg-store-bg w-full max-w-[560px] my-8 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-6 top-6 text-store-fg-muted hover:text-store-fg cursor-pointer"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>

          <h2 className="font-serif text-[28px] text-store-accent text-center pt-10 pb-8 font-normal">
            Change Password
          </h2>

          <form onSubmit={handleSubmit} className="px-8 sm:px-12 pb-10 space-y-5">
            {msg && (
              <div
                className={`p-3 rounded-md text-[12px] ${
                  msg.type === "ok"
                    ? "bg-green-50 border border-green-200 text-green-800"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {msg.text}
              </div>
            )}

            {field("Current Password", "currentPassword")}
            {field("New Password", "newPassword")}
            {field("Confirm New Password", "confirmPassword")}

            <div className="pt-4 flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="px-12 py-3.5 bg-store-accent text-white text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Updating…" : "Change Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

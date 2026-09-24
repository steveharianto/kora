"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { registerCustomer } from "@/app/actions/customerAuth";

export default function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.startsWith("08")) val = "62" + val.slice(1);
    setForm((prev) => ({ ...prev, phone: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.phone.length < 9) {
      setError("Please enter a valid WhatsApp number with country code.");
      return;
    }

    setLoading(true);
    const res = await registerCustomer({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      password: form.password,
    });

    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    router.push("/account");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-[12px]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12.5px] text-store-fg-muted mb-2">First Name</label>
          <input
            required
            value={form.firstName}
            onChange={update("firstName")}
            className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent"
          />
        </div>
        <div>
          <label className="block text-[12.5px] text-store-fg-muted mb-2">Last Name</label>
          <input
            value={form.lastName}
            onChange={update("lastName")}
            className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent"
          />
        </div>
      </div>

      <div>
        <label className="block text-[12.5px] text-store-fg-muted mb-2">Email</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={update("email")}
          autoComplete="email"
          className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent"
        />
      </div>

      <div>
        <label className="block text-[12.5px] text-store-fg-muted mb-2">
          WhatsApp Number
        </label>
        <input
          required
          inputMode="numeric"
          value={form.phone}
          onChange={handlePhoneChange}
          placeholder="628123456789"
          className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent font-mono"
        />
        <p className="text-[11px] text-store-fg-muted mt-1.5">
          Start with country code (62 for Indonesia, no +).
        </p>
      </div>

      <div>
        <label className="block text-[12.5px] text-store-fg-muted mb-2">Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            required
            value={form.password}
            onChange={update("password")}
            autoComplete="new-password"
            minLength={8}
            className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 pr-11 focus:outline-none focus:border-store-accent font-mono"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-store-fg-muted hover:text-store-fg cursor-pointer"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" strokeWidth={1.6} />
            ) : (
              <Eye className="w-4 h-4" strokeWidth={1.6} />
            )}
          </button>
        </div>
        <p className="text-[11px] text-store-fg-muted mt-1.5">Minimum 8 characters.</p>
      </div>

      <div>
        <label className="block text-[12.5px] text-store-fg-muted mb-2">
          Confirm Password
        </label>
        <input
          type="password"
          required
          value={form.confirm}
          onChange={update("confirm")}
          autoComplete="new-password"
          className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent font-mono"
        />
      </div>

      <div className="pt-4 flex flex-col items-center gap-5">
        <button
          type="submit"
          disabled={loading}
          className="px-12 py-3.5 bg-store-accent text-white text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Creating Account…" : "Create Account"}
        </button>

        <Link
          href="/account/login"
          className="text-[11px] tracking-[0.16em] uppercase text-store-fg-muted underline underline-offset-4 hover:text-store-fg"
        >
          Already have an account? Sign In
        </Link>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestPasswordReset } from "@/app/actions/customerAuth";

export default function ResetForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await requestPasswordReset(email);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    router.push("/account/reset-password/sent");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-[12px]">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[12.5px] text-store-fg-muted mb-2">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="johndoe@gmail.com"
          autoComplete="email"
          className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent"
        />
      </div>

      <div className="pt-4 flex justify-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-10 py-3.5 bg-store-accent text-white text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Submitting…" : "Submit"}
        </button>
        <Link
          href="/account/login"
          className="px-10 py-3.5 border border-store-fg text-store-fg text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-hover/50 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

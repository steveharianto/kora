"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { loginCustomer } from "@/app/actions/customerAuth";

export default function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await loginCustomer({ email, password });

    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    router.push(redirectTo || "/account");
    router.refresh();
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

      <div>
        <label className="block text-[12.5px] text-store-fg-muted mb-2">Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 pr-11 focus:outline-none focus:border-store-accent font-mono"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-store-fg-muted hover:text-store-fg cursor-pointer"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" strokeWidth={1.6} />
            ) : (
              <Eye className="w-4 h-4" strokeWidth={1.6} />
            )}
          </button>
        </div>
      </div>

      <Link
        href="/account/reset-password"
        className="block text-[11px] tracking-[0.16em] uppercase text-store-fg-muted underline underline-offset-4 hover:text-store-fg"
      >
        Forgot your password?
      </Link>

      <div className="pt-4 flex flex-col items-center gap-5">
        <button
          type="submit"
          disabled={loading}
          className="px-12 py-3.5 bg-store-accent text-white text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Signing In…" : "Sign In"}
        </button>

        <Link
          href="/account/register"
          className="text-[11px] tracking-[0.16em] uppercase text-store-fg-muted underline underline-offset-4 hover:text-store-fg"
        >
          Create Account
        </Link>
      </div>
    </form>
  );
}

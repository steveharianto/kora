"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logoutCustomer } from "@/app/actions/customerAuth";

export default function AccountSidebar({ customerName }: { customerName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await logoutCustomer();
    router.push("/");
    router.refresh();
  };

  const link = (href: string, label: string) => {
    const isActive =
      href === "/account" ? pathname === "/account" : pathname.startsWith(href);

    return (
      <Link
        href={href}
        className={`block text-[13px] transition-colors ${
          isActive ? "text-store-fg" : "text-store-fg-muted hover:text-store-fg"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <aside className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-[22px] text-store-fg mb-6 font-normal">
          My Account
        </h1>
        <nav className="space-y-4">
          {link("/account", "Account")}
          {link("/account/orders", "Orders")}
          {link("/account/fittings", "Fitting Session")}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={loading}
            className="block text-[13px] text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer disabled:opacity-50 text-left"
          >
            {loading ? "Signing out…" : "Sign Out"}
          </button>
        </nav>
      </div>

      <p className="text-[11px] text-store-fg-muted pt-6 border-t border-store-border">
        Signed in as <span className="text-store-fg">{customerName}</span>
      </p>
    </aside>
  );
}

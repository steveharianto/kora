"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, User, ShoppingBag } from "lucide-react";

export default function StorefrontHeader() {
  const [isShopMenuOpen, setIsShopMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#ECEBE4] border-b border-[#DFDDD4] transition-colors">
      <div className="max-w-[1512px] mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          href="/"
          className="font-serif text-[28px] sm:text-[32px] tracking-[0.06em] text-[#485642] hover:opacity-90 transition-opacity font-normal"
        >
          KORA
        </Link>

        {/* Center Editorial Links */}
        <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.14em] text-[#3B4736] font-medium uppercase">
          <div
            className="relative"
            onMouseEnter={() => setIsShopMenuOpen(true)}
            onMouseLeave={() => setIsShopMenuOpen(false)}
          >
            <Link
              href="/shop"
              className="flex items-center gap-1.5 hover:text-[#1F261C] py-2 transition-colors"
            >
              Shop All
              <span className="text-[9px] translate-y-[-1px]">▼</span>
            </Link>

            {isShopMenuOpen && (
              <div className="absolute top-full left-0 w-56 bg-[#ECEBE4] border border-[#DFDDD4] rounded-sm py-2 shadow-lg z-50">
                {[
                  { label: "All", href: "/shop" },
                  { label: "New Arrivals", href: "/shop?filter=new" },
                  {
                    label: "Available This Week",
                    href: "/shop?filter=available-now",
                  },
                  { label: "Dresses", href: "/shop?category=dresses" },
                  { label: "Accessories", href: "/shop?category=accessories" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-4 py-2 text-[11px] tracking-[0.16em] uppercase text-[#3B4736] hover:bg-[#E2E0D6] transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/how-to-rent"
            className="hover:text-[#1F261C] transition-colors py-2"
          >
            How To Rent
          </Link>
          <Link
            href="/about"
            className="hover:text-[#1F261C] transition-colors py-2"
          >
            About Kora
          </Link>
        </nav>

        {/* Action Icons */}
        <div className="flex items-center gap-5 sm:gap-6 text-[#485642]">
          <Link
            href="/search"
            aria-label="Search"
            className="hover:text-[#1F261C] transition-colors"
          >
            <Search className="w-[18px] h-[18px] stroke-[1.8]" />
          </Link>

          <Link
            href="/account"
            aria-label="Account"
            className="hover:text-[#1F261C] transition-colors"
          >
            <User className="w-[19px] h-[19px] stroke-[1.8]" />
          </Link>

          {/* Rental Cart Trigger */}
          <button
            type="button"
            aria-label="Rental Cart"
            className="flex items-center gap-1.5 hover:text-[#1F261C] transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-[18px] h-[18px] stroke-[1.8]" />
            <span className="text-xs font-mono font-medium">0</span>
          </button>

          {/* Fitting Session Cart Trigger */}
          <button
            type="button"
            aria-label="Fitting Sessions Cart"
            className="flex items-center gap-1.5 hover:text-[#1F261C] transition-colors cursor-pointer"
          >
            <svg
              className="w-[20px] h-[20px] stroke-[1.8] fill-none stroke-current"
              viewBox="0 0 24 24"
            >
              <path d="M12 4a2 2 0 0 1 2 2c0 .7-.4 1.3-1 1.7V9l8 5.5v1.5H3V14.5L11 9V7.7A2 2 0 0 1 12 4z" />
              <path d="M7 16v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3" />
            </svg>
            <span className="text-xs font-mono font-medium">0</span>
          </button>
        </div>
      </div>
    </header>
  );
}

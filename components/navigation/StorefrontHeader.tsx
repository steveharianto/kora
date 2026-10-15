"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { RentalCartBadge, FittingCartBadge } from "./CartBadges";
import RentalCartDrawer from "@/components/storefront/RentalCartDrawer";
import FittingCartDrawer from "@/components/storefront/FittingCartDrawer";
import IdVerificationModal from "@/components/storefront/IdVerificationModal";
import SearchPanel from "./SearchPanel";
import {
  SearchIcon,
  AccountIcon,
  RentalBagIcon,
  FittingHangerIcon,
} from "@/components/icons";
import { getCurrentCustomer } from "@/app/actions/customerAuth";
import type { CustomerPreview } from "@/lib/auth/customerPreview";

const MOBILE_NAV: { label: string; href: string }[] = [
  { label: "Shop All", href: "/shop" },
  { label: "New Arrivals", href: "/shop?filter=new" },
  { label: "Available This Week", href: "/shop?filter=available-now" },
  { label: "Dresses", href: "/shop?category=dresses" },
  { label: "Accessories", href: "/shop?category=accessories" },
  { label: "How to Rent", href: "/how-to-rent" },
  { label: "About Kora", href: "/about" },
];

export default function StorefrontHeader({
  customerPreview,
}: {
  customerPreview: CustomerPreview | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isShopMenuOpen, setIsShopMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openCart, setOpenCart] = useState<"rental" | "fitting" | null>(null);
  const [openKtpModal, setOpenKtpModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMenuOpen]);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  };

  const handleCheckout = async () => {
    setOpenCart(null);
    const current = await getCurrentCustomer();
    if (!current) {
      router.push("/account/login?redirect=/checkout");
      return;
    }
    if (current.status === "Not Submitted") {
      setOpenKtpModal(true);
      return;
    }
    router.push("/checkout");
  };

  const handleKtpProceed = () => {
    setOpenKtpModal(false);
    router.push("/checkout");
  };

  const displayName = customerPreview
    ? `${customerPreview.firstName} ${customerPreview.lastName || ""}`.trim()
    : null;

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[#ECEBE4] border-b border-[#DFDDD4] transition-colors">
        <div className="max-w-[1512px] mx-auto px-6 sm:px-10 h-16 flex items-center justify-between relative">
          <div className="flex items-center gap-3 md:gap-0">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-nav-drawer"
              onClick={() => setIsMenuOpen(true)}
              className="md:hidden flex items-center justify-center w-6 h-6 text-[#485642] hover:text-[#1F261C] transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" strokeWidth={1.8} />
            </button>
            <Link
              href="/"
              aria-label="KORA — Home"
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:static md:translate-x-0 md:translate-y-0 hover:opacity-85 transition-opacity inline-flex items-center"
            >
              <Image
                src="/images/logo.png"
                alt="KORA"
                width={160}
                height={48}
                priority
                className="h-6 sm:h-7 w-auto"
              />
            </Link>
          </div>
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
                    {
                      label: "Accessories",
                      href: "/shop?category=accessories",
                    },
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
          <div className="flex items-center gap-3 sm:gap-6 text-[#485642]">
            <button
              type="button"
              aria-label={isSearchOpen ? "Close search" : "Search"}
              aria-expanded={isSearchOpen}
              onClick={() => setIsSearchOpen((v) => !v)}
              className="hover:text-[#1F261C] transition-colors cursor-pointer"
            >
              <SearchIcon className="w-[22px] h-[22px]" />
            </button>
            <Link
              href="/account"
              aria-label={
                displayName ? `My account — ${displayName}` : "Account"
              }
              className="flex items-center gap-2 hover:text-[#1F261C] transition-colors min-w-0"
            >
              <AccountIcon className="w-[22px] h-[22px] flex-shrink-0" />
              {displayName && (
                <span className="hidden lg:inline text-[11.5px] tracking-[0.06em] font-medium text-[#3B4736] max-w-[140px] truncate">
                  {displayName}
                </span>
              )}
            </Link>
            <button
              type="button"
              aria-label="Rental Cart"
              onClick={() => setOpenCart("rental")}
              className="flex items-center gap-1.5 hover:text-[#1F261C] transition-colors cursor-pointer"
            >
              <RentalBagIcon className="w-[22px] h-[22px]" />
              <RentalCartBadge />
            </button>
            <button
              type="button"
              aria-label="Fitting Sessions Cart"
              onClick={() => setOpenCart("fitting")}
              className="hidden md:flex items-center gap-1.5 hover:text-[#1F261C] transition-colors cursor-pointer"
            >
              <FittingHangerIcon className="w-[22px] h-[22px]" />
              <FittingCartBadge />
            </button>
          </div>
        </div>
        <SearchPanel
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
      </header>
      {isMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[100] md:hidden"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden
          />
          <aside
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-y-0 left-0 z-[110] md:hidden w-[85vw] max-w-[360px] bg-[#ECEBE4] flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 h-16 border-b border-[#DFDDD4]">
              <Link
                href="/"
                aria-label="KORA — Home"
                onClick={() => setIsMenuOpen(false)}
                className="inline-flex items-center"
              >
                <Image
                  src="/images/logo.png"
                  alt="KORA"
                  width={160}
                  height={48}
                  className="h-6 w-auto"
                />
              </Link>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close menu"
                className="text-[#485642] hover:text-[#1F261C] transition-colors cursor-pointer p-1"
              >
                <X className="w-5 h-5" strokeWidth={1.8} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-6 py-8">
              <ul className="space-y-1">
                {MOBILE_NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className="block py-3 text-[12px] tracking-[0.16em] uppercase text-[#3B4736] hover:text-[#1F261C] transition-colors border-b border-[#DFDDD4] last:border-none"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="px-6 py-5 border-t border-[#DFDDD4]">
              <Link
                href="/account"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 text-[12px] tracking-[0.16em] uppercase text-[#3B4736] hover:text-[#1F261C] transition-colors"
              >
                <AccountIcon className="w-5 h-5 flex-shrink-0" />
                {displayName ? `Hi, ${displayName}` : "Sign in"}
              </Link>
            </div>
          </aside>
        </>
      )}
      <RentalCartDrawer
        isOpen={openCart === "rental"}
        onClose={() => setOpenCart(null)}
        onCheckout={handleCheckout}
      />
      <FittingCartDrawer
        isOpen={openCart === "fitting"}
        onClose={() => setOpenCart(null)}
      />
      <IdVerificationModal
        isOpen={openKtpModal}
        onClose={() => setOpenKtpModal(false)}
        onProceed={handleKtpProceed}
      />
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] max-w-[92vw] bg-store-fg text-white text-[12px] tracking-wider px-6 py-3 shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}

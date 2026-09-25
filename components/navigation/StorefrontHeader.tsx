"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, User, ShoppingBag } from "lucide-react";
import { RentalCartBadge, FittingCartBadge } from "./CartBadges";
import RentalCartDrawer from "@/components/storefront/RentalCartDrawer";
import FittingCartDrawer from "@/components/storefront/FittingCartDrawer";
import IdVerificationModal from "@/components/storefront/IdVerificationModal";
import { getCurrentCustomer } from "@/app/actions/customerAuth";

export default function StorefrontHeader() {
  const router = useRouter();
  const [isShopMenuOpen, setIsShopMenuOpen] = useState(false);
  const [openCart, setOpenCart] = useState<"rental" | "fitting" | null>(null);
  const [openKtpModal, setOpenKtpModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  };

  const handleCheckout = async () => {
    setOpenCart(null);

    const customer = await getCurrentCustomer();

    if (!customer) {
      router.push("/account/login?redirect=/checkout");
      return;
    }

    if (customer.status === "Not Submitted") {
      setOpenKtpModal(true);
      return;
    }

    router.push("/checkout");
  };

  const handleKtpProceed = () => {
    setOpenKtpModal(false);
    router.push("/checkout");
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[#ECEBE4] border-b border-[#DFDDD4] transition-colors">
        <div className="max-w-[1512px] mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="font-serif text-[28px] sm:text-[32px] tracking-[0.06em] text-[#485642] hover:opacity-90 transition-opacity font-normal"
          >
            KORA
          </Link>

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

            <button
              type="button"
              aria-label="Rental Cart"
              onClick={() => setOpenCart("rental")}
              className="flex items-center gap-1.5 hover:text-[#1F261C] transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-[18px] h-[18px] stroke-[1.8]" />
              <RentalCartBadge />
            </button>

            <button
              type="button"
              aria-label="Fitting Sessions Cart"
              onClick={() => setOpenCart("fitting")}
              className="flex items-center gap-1.5 hover:text-[#1F261C] transition-colors cursor-pointer"
            >
              <svg
                className="w-[20px] h-[20px] stroke-[1.8] fill-none stroke-current"
                viewBox="0 0 24 24"
              >
                <path d="M12 4a2 2 0 0 1 2 2c0 .7-.4 1.3-1 1.7V9l8 5.5v1.5H3V14.5L11 9V7.7A2 2 0 0 1 12 4z" />
                <path d="M7 16v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3" />
              </svg>
              <FittingCartBadge />
            </button>
          </div>
        </div>
      </header>

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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] max-w-[92vw] bg-store-fg text-white text-[12px] tracking-wider px-6 py-3 shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}

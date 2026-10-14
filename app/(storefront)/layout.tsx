import type { Metadata } from "next";
import { cookies } from "next/headers";
import StorefrontHeader from "@/components/navigation/StorefrontHeader";
import StorefrontFooter from "@/components/navigation/StorefrontFooter";
import PageLoader from "@/components/storefront/PageLoader";
import {
  CUSTOMER_PREVIEW_COOKIE,
  parseCustomerPreview,
} from "@/lib/auth/customerPreview";

export const metadata: Metadata = {
  title: "KORA | Luxury Designer Dress Rental",
  description:
    "Rent curated high-end designer dresses and evening gowns in Jakarta.",
};

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the cosmetic display cookie — no DB round-trip. Actual
  // authorization still flows through the httpOnly session cookie and is
  // enforced by the pages/actions that need it.
  const cookieStore = await cookies();
  const customerPreview = parseCustomerPreview(
    cookieStore.get(CUSTOMER_PREVIEW_COOKIE)?.value,
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6F2] text-[#242A20] font-sans antialiased selection:bg-[#64765B] selection:text-white">
      <PageLoader />
      <StorefrontHeader customerPreview={customerPreview} />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
    </div>
  );
}

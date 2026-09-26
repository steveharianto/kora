import type { Metadata } from 'next';
import StorefrontHeader from '@/components/navigation/StorefrontHeader';
import StorefrontFooter from '@/components/navigation/StorefrontFooter';
import { getCurrentCustomer } from '@/app/actions/customerAuth';

export const metadata: Metadata = {
  title: 'KORA | Luxury Designer Dress Rental',
  description: 'Rent curated high-end designer dresses and evening gowns in Jakarta.',
};

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the session server-side so the header renders the correct state
  // on first paint — no client-side flash of "logged out".
  const customer = await getCurrentCustomer();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6F2] text-[#242A20] font-sans antialiased selection:bg-[#64765B] selection:text-white">
      <StorefrontHeader customer={customer} />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
    </div>
  );
}

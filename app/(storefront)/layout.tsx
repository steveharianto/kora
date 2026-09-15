import type { Metadata } from 'next';
import StorefrontHeader from '@/components/navigation/StorefrontHeader';
import StorefrontFooter from '@/components/navigation/StorefrontFooter';

export const metadata: Metadata = {
  title: 'KORA | Luxury Designer Dress Rental',
  description: 'Rent curated high-end designer dresses and evening gowns in Jakarta.',
};

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6F2] text-[#242A20] font-sans antialiased selection:bg-[#64765B] selection:text-white">
      <StorefrontHeader />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
    </div>
  );
}

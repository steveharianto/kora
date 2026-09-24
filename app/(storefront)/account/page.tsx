import Link from "next/link";

export const metadata = {
  title: "Account | KORA",
  description: "Manage your rentals, returns, and account details.",
};

export default function AccountPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-[32px] sm:text-[40px] text-store-fg font-normal tracking-[0.01em] mb-4">
          Your Account
        </h1>
        <p className="text-[13px] text-store-fg-muted leading-relaxed mb-8">
          Sign-in is coming soon. For now, bookings and returns are handled over WhatsApp — reach
          out any time and we&apos;ll take care of you.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a
            href="https://wa.me/62895623440010"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3 bg-store-accent text-white text-[11px] tracking-[0.2em] uppercase font-medium hover:bg-store-accent-hover transition-colors"
          >
            Chat on WhatsApp
          </a>
          <Link
            href="/shop"
            className="px-6 py-3 border border-store-fg text-store-fg text-[11px] tracking-[0.2em] uppercase font-medium hover:bg-store-hover/50 transition-colors"
          >
            Continue Browsing
          </Link>
        </div>
      </div>
    </div>
  );
}

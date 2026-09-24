import Link from "next/link";

export const metadata = {
  title: "Email Sent | KORA",
};

export default function ResetSentPage() {
  return (
    <div className="w-full bg-store-bg">
      <div className="max-w-[440px] mx-auto px-6 py-28 sm:py-36 text-center">
        <h1 className="font-serif text-[34px] sm:text-[42px] text-store-fg font-normal tracking-[0.01em] mb-4">
          Email sent.
        </h1>
        <p className="text-[13px] text-store-fg-muted mb-14">
          Check your email for more information.
        </p>
        <Link
          href="/account/login"
          className="inline-block px-10 py-3.5 bg-store-accent text-white text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}

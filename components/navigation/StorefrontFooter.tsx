import Link from 'next/link';

export default function StorefrontFooter() {
  return (
    <footer className="w-full bg-[#64765B] text-[#ECEBE4] pt-14 pb-10 px-6 sm:px-12 border-t border-[#54644C]">
      <div className="max-w-[1512px] mx-auto">
        {/* Main Grid Columns */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-16">
          {/* Logo & Emblem */}
          <div className="md:col-span-4 flex items-start gap-3">
            <span className="font-serif text-[42px] sm:text-[50px] tracking-[0.04em] leading-none font-normal">
              KORA
            </span>
            {/* Handcrafted Emblem Motif */}
            <svg
              className="w-10 h-10 stroke-current fill-none stroke-[1.2] opacity-90 translate-y-1"
              viewBox="0 0 40 40"
            >
              <circle cx="20" cy="20" r="14" strokeDasharray="1 2" />
              <path d="M20 6 C16 14, 16 26, 20 34 M20 6 C24 14, 24 26, 20 34" />
              <path d="M6 20 C14 16, 26 16, 34 20 M6 20 C14 24, 26 24, 34 20" />
            </svg>
          </div>

          {/* Location & Working Hours */}
          <div className="md:col-span-3 space-y-8 text-xs leading-relaxed text-[#ECEBE4]/85">
            <div>
              <h4 className="font-serif text-[18px] text-[#ECEBE4] mb-2 font-normal">
                Location
              </h4>
              <p>
                Jl. Darmawangsa VI No. 42 Pulo,
                <br />
                Kebayoran Baru, South Jakarta 12160
              </p>
            </div>

            <div>
              <h4 className="font-serif text-[18px] text-[#ECEBE4] mb-2 font-normal">
                Working Hours
              </h4>
              <p>
                Monday–Friday: 10 AM – 5 PM
                <br />
                Saturday: 10 AM – 1 PM
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="md:col-span-2 space-y-3 text-xs tracking-wider uppercase">
            <h4 className="font-serif text-[18px] text-[#ECEBE4] mb-3 normal-case font-normal">
              Navigation
            </h4>
            <ul className="space-y-2 text-[#ECEBE4]/80 text-[11px]">
              <li>
                <Link href="/shop?filter=new" className="hover:text-white transition">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link href="/shop?category=dresses" className="hover:text-white transition">
                  Dresses
                </Link>
              </li>
              <li>
                <Link href="/shop?category=accessories" className="hover:text-white transition">
                  Accessories
                </Link>
              </li>
              <li>
                <Link href="/how-to-rent" className="hover:text-white transition">
                  How to Rent
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition">
                  About Kora
                </Link>
              </li>
            </ul>
          </div>

          {/* Social Channels */}
          <div className="md:col-span-2 space-y-3 text-xs tracking-wider uppercase">
            <h4 className="font-serif text-[18px] text-[#ECEBE4] mb-3 normal-case font-normal">
              Social
            </h4>
            <ul className="space-y-2 text-[#ECEBE4]/80 text-[11px]">
              <li>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://tiktok.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition"
                >
                  TikTok
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/6281234567890"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition"
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href="mailto:contact@kora.com"
                  className="hover:text-white transition"
                >
                  Email
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="md:col-span-1 space-y-3 text-xs tracking-wider uppercase">
            <h4 className="font-serif text-[18px] text-[#ECEBE4] mb-3 normal-case font-normal">
              Legal
            </h4>
            <ul className="space-y-2 text-[#ECEBE4]/80 text-[11px]">
              <li>
                <Link href="/terms" className="hover:text-white transition">
                  Terms & Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-[#76886D] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#ECEBE4]/70">
          <p>Copyright © 2026 KORA</p>
          <p className="mt-2 sm:mt-0 tracking-wider">Website by KLETOS</p>
        </div>
      </div>
    </footer>
  );
}

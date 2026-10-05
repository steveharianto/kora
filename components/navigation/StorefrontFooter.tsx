import Link from "next/link";
import Image from "next/image";

const GOOGLE_MAPS_URL = "https://maps.app.goo.gl/YKkwsJQkRBMXixe26";

export default function StorefrontFooter() {
  return (
    <footer className="w-full bg-[#64765B] text-[#ECEBE4] pt-16 pb-8 px-6 sm:px-12 border-t border-[#54644C]">
      <div className="max-w-[1512px] mx-auto">
        {/* Main columns */}
        <div className="grid grid-cols-2 md:grid-cols-12 gap-x-8 gap-y-10 pb-12">
          {/* Logo */}
          <div className="col-span-2 md:col-span-3">
            <Link
              href="/"
              aria-label="KORA — Home"
              className="inline-block hover:opacity-90 transition-opacity"
            >
              <Image
                src="/images/logo2.png"
                alt="KORA"
                width={160}
                height={48}
                className="h-7 sm:h-8 w-auto"
              />
            </Link>
          </div>

          {/* Location — hyperlinked to Google Maps */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-serif text-[16px] text-[#ECEBE4] font-normal mb-3">
              Location
            </h4>
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noreferrer"
              title="Open KORA showroom in Google Maps"
              className="block text-[11.5px] text-[#ECEBE4]/75 leading-relaxed hover:text-white hover:underline underline-offset-4 transition-colors"
            >
              Jl. Darmawangsa VI No. 42 Pulo,
              <br />
              Kebayoran Baru, South Jakarta 12160
            </a>
          </div>

          {/* Working Hours */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-serif text-[16px] text-[#ECEBE4] font-normal mb-3">
              Working Hours
            </h4>
            <p className="text-[11.5px] text-[#ECEBE4]/75 leading-relaxed">
              Monday–Friday: 10 AM – 5 PM
              <br />
              Saturday: 10 AM – 1 PM
            </p>
          </div>

          {/* Navigation */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-serif text-[16px] text-[#ECEBE4] font-normal mb-3">
              Navigation
            </h4>
            <ul className="space-y-2 text-[11px] tracking-[0.08em] uppercase text-[#ECEBE4]/75">
              <li>
                <Link
                  href="/shop?filter=new"
                  className="hover:text-white transition-colors"
                >
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link
                  href="/shop?category=dresses"
                  className="hover:text-white transition-colors"
                >
                  Dresses
                </Link>
              </li>
              <li>
                <Link
                  href="/shop?category=accessories"
                  className="hover:text-white transition-colors"
                >
                  Accessories
                </Link>
              </li>
              <li>
                <Link
                  href="/how-to-rent"
                  className="hover:text-white transition-colors"
                >
                  How to Rent
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-white transition-colors"
                >
                  About Kora
                </Link>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-serif text-[16px] text-[#ECEBE4] font-normal mb-3">
              Social
            </h4>
            <ul className="space-y-2 text-[11px] tracking-[0.08em] uppercase text-[#ECEBE4]/75">
              <li>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://tiktok.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  TikTok
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/6281234567890"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href="mailto:contact@kora.com"
                  className="hover:text-white transition-colors"
                >
                  Email
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="font-serif text-[16px] text-[#ECEBE4] font-normal mb-3">
              Legal
            </h4>
            <ul className="space-y-2 text-[11px] tracking-[0.08em] uppercase text-[#ECEBE4]/75">
              <li>
                <Link
                  href="/terms"
                  className="hover:text-white transition-colors"
                >
                  Terms &amp; Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-[#76886D] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#ECEBE4]/70">
          <p>Copyright © 2026 KORA</p>
          <p className="tracking-wider">Website by KLETOS</p>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import Image from "next/image";
import { Fragment } from "react";
import { getOperatingHours } from "@/lib/settings/businessInfo.server";
import { formatOperatingHoursLines } from "@/lib/settings/businessInfo";
import {
  SHOWROOM_ADDRESS,
  GOOGLE_MAPS_URL,
  WHATSAPP_ADMINS,
  INSTAGRAM_URL,
  TIKTOK_URL,
  CONTACT_EMAIL,
} from "@/lib/business/contactInfo";

/**
 * Storefront footer.
 *
 * • Location — hardcoded in lib/business/contactInfo.ts, linked to Google Maps.
 * • Working Hours — read live from app_settings.business_info.operating_hours,
 *   grouped into consecutive-day runs.
 * • Social — hardcoded URLs from contactInfo.
 * • Bottom bar — copyright plus the mobile-only "Website by KLETOS" credit
 *   from the Figma mobile design (desktop keeps copyright only).
 */
export default async function StorefrontFooter() {
  const hours = await getOperatingHours();
  const hourLines = formatOperatingHoursLines(hours);
  return (
    <footer className="w-full bg-[#64765B] text-[#ECEBE4] pt-20 pb-10 px-6 sm:px-12 border-t border-[#54644C]">
      <div className="max-w-[1512px] mx-auto">
        {/* Main columns
            ─────────────────────────────────────────────────────────
            Column layout matches the Figma:
              [ Logo ] [ Location + Working Hours ] [ Navigation ] [ Social ] [ Legal ]
            Location and Working Hours live in the SAME column, stacked.
        */}
        <div className="grid grid-cols-2 md:grid-cols-12 gap-x-8 gap-y-14 pb-16">
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
                width={220}
                height={66}
                className="h-8 sm:h-10 w-auto"
                priority={false}
              />
            </Link>
          </div>
          {/* Location + Working Hours — stacked in one column */}
          <div className="col-span-2 md:col-span-4 space-y-10">
            <div>
              <h4 className="font-serif text-[17px] text-[#ECEBE4] font-normal mb-3.5">
                Location
              </h4>
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noreferrer"
                title="Open KORA showroom in Google Maps"
                className="block text-[12px] text-[#ECEBE4]/80 leading-[1.7] whitespace-pre-line hover:text-white hover:underline underline-offset-4 transition-colors"
              >
                {SHOWROOM_ADDRESS}
              </a>
            </div>
            <div>
              <h4 className="font-serif text-[17px] text-[#ECEBE4] font-normal mb-3.5">
                Working Hours
              </h4>
              <p className="text-[12px] text-[#ECEBE4]/80 leading-[1.7]">
                {hourLines.map((line, i) => (
                  <Fragment key={i}>
                    {line}
                    {i < hourLines.length - 1 && <br />}
                  </Fragment>
                ))}
              </p>
            </div>
          </div>
          {/* Navigation */}
          <div className="col-span-1 md:col-span-2">
            <h4 className="font-serif text-[17px] text-[#ECEBE4] font-normal mb-3.5">
              Navigation
            </h4>
            <ul className="space-y-3 text-[11px] tracking-[0.12em] uppercase text-[#ECEBE4]/80">
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
            <h4 className="font-serif text-[17px] text-[#ECEBE4] font-normal mb-3.5">
              Social
            </h4>
            <ul className="space-y-3 text-[11px] tracking-[0.12em] uppercase text-[#ECEBE4]/80">
              <li>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href={TIKTOK_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  TikTok
                </a>
              </li>
              {WHATSAPP_ADMINS.map((admin) => (
                <li key={admin.waUrl}>
                  <a
                    href={admin.waUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={`Chat with ${admin.name} on WhatsApp (${admin.display})`}
                    className="hover:text-white transition-colors"
                  >
                    WhatsApp · {admin.name}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="hover:text-white transition-colors"
                >
                  Email
                </a>
              </li>
            </ul>
          </div>
          {/* Legal */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="font-serif text-[17px] text-[#ECEBE4] font-normal mb-3.5">
              Legal
            </h4>
            <ul className="space-y-3 text-[11px] tracking-[0.12em] uppercase text-[#ECEBE4]/80">
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
        {/* Bottom bar — copyright on desktop; copyright + agency credit
            split left/right on mobile per the Figma mobile design. */}
        <div className="pt-8 border-t border-[#76886D] text-[11px] text-[#ECEBE4]/70 flex items-center justify-between gap-4">
          <p>Copyright © 2026 KORA</p>
          <p className="md:hidden whitespace-nowrap">
            Website by{" "}
            <span className="font-semibold tracking-[0.12em] uppercase text-[#ECEBE4]">
              Kletos
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}

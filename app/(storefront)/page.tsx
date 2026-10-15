import Link from "next/link";
import Image from "next/image";
import { Fragment } from "react";
import HomeHeroCarousel from "@/components/storefront/HomeHeroCarousel";
import HomeFeaturedSection from "@/components/storefront/HomeFeaturedSection";
import {
  BrowseIcon,
  BookDatesIcon,
  WearItIcon,
  ReturnItIcon,
} from "@/components/icons";

const STEPS = [
  {
    n: 1,
    Icon: BrowseIcon,
    title: "Browse",
    body: "Find the one for your occasion",
  },
  {
    n: 2,
    Icon: BookDatesIcon,
    title: "Book Your Dates",
    body: "Pick when you need it. We'll have it ready",
  },
  {
    n: 3,
    Icon: WearItIcon,
    title: "Wear It",
    body: "Show up, turn heads, enjoy the night",
  },
  {
    n: 4,
    Icon: ReturnItIcon,
    title: "Return It",
    body: "Send it back. We handle the cleaning",
  },
];

export default function StorefrontHomePage() {
  return (
    <div className="w-full overflow-x-hidden">
      <HomeHeroCarousel />
      {/* Featured — mobile carousel + arrows + CTA per Figma mobile;
          desktop layout unchanged inside the component. */}
      <HomeFeaturedSection />
      {/* Editorial */}
      <section className="relative w-full min-h-[580px] sm:min-h-[720px] bg-[#2E362A] text-white overflow-hidden flex items-center">
        <Image
          src="/images/home/editorial-bg.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center opacity-35"
        />
        <div className="relative z-10 max-w-[1512px] mx-auto w-full px-6 sm:px-12 py-16 grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,360px)_1fr] gap-8 items-center">
          <div className="w-full text-center lg:text-left space-y-2">
            <h2 className="font-serif text-[36px] sm:text-[48px] font-normal tracking-[0.02em] text-[#F3F1EC]">
              New Arrivals
            </h2>
            <p className="text-xs tracking-wider text-[#DCD8CC] uppercase">
              Fresh in, ready to rent
            </p>
          </div>
          <div className="w-full flex justify-center">
            <div className="relative w-full aspect-[3/4] bg-[#424D3D] shadow-2xl overflow-hidden border border-white/10">
              <Image
                src="/images/home/editorial-center.jpg"
                alt="New arrival editorial"
                fill
                sizes="(max-width: 1024px) 100vw, 360px"
                className="object-cover object-center"
              />
            </div>
          </div>
          <div className="w-full flex justify-center lg:justify-end">
            <Link
              href="/shop"
              className="bg-[#ECEBE4] text-[#1F261C] px-8 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-white transition-colors shadow-lg"
            >
              See What&apos;s New
            </Link>
          </div>
        </div>
      </section>
      {/* Available This Week */}
      <section className="w-full py-24 sm:py-28 px-6 bg-[#F2F0E9]">
        <div className="mx-auto max-w-[600px] flex flex-col items-center text-center">
          <div className="w-full max-w-[420px] mx-auto mb-8">
            <div className="relative aspect-[3/4] w-full overflow-hidden shadow-lg border border-[#DDD9CE]">
              <Image
                src="/images/home/available-week.jpg"
                alt="Available to rent this week"
                fill
                sizes="(max-width: 640px) 100vw, 420px"
                className="object-cover object-center"
              />
            </div>
          </div>
          <h2 className="font-serif text-[32px] sm:text-[40px] font-normal tracking-[0.01em] text-[#2D3828] mb-2">
            Available This Week
          </h2>
          <p className="text-xs text-[#6A7563] max-w-sm mb-6">
            Got an event coming up? These pieces are ready for you.
          </p>
          <Link
            href="/shop?filter=available-now"
            className="bg-[#64765B] text-white px-9 py-2.5 text-[11px] uppercase tracking-[0.18em] font-medium hover:bg-[#52624B] transition-colors"
          >
            Rent Now
          </Link>
        </div>
      </section>
      {/* How It Works */}
      <section className="w-full py-24 sm:py-28 px-6 bg-[#DDDBCF] border-t border-[#CECBC0] flex flex-col items-center">
        <div className="text-center mb-16 sm:mb-20">
          <h2 className="font-serif text-[36px] sm:text-[46px] font-normal tracking-[0.01em] text-[#364230] mb-3">
            How It Works
          </h2>
          <p className="text-[13px] text-[#5D6B56]">
            Designer dresses, four simple steps
          </p>
        </div>
        <div className="hidden md:flex items-start justify-center w-full max-w-[1280px] mb-16">
          {STEPS.map((step, i) => {
            const Icon = step.Icon;
            return (
              <Fragment key={step.n}>
                <div
                  className="flex flex-col items-center"
                  style={{ width: "220px" }}
                >
                  <div className="w-[220px] h-[220px] rounded-full border border-[#7A8B73] flex flex-col items-center justify-center gap-3">
                    <Icon className="w-12 h-12 text-[#64765B]" />
                    <h3 className="font-serif text-[22px] text-[#364230] font-normal tracking-[0.005em]">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-[12px] text-[#5D6B56] text-center mt-6 max-w-[200px] leading-[1.6]">
                    {step.body}
                  </p>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-px bg-[#7A8B73]"
                    style={{ marginTop: "110px" }}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
        {/* Mobile (Figma): single vertical column of full circles — icon,
            title and body all inside — joined by vertical connector lines. */}
        <div className="md:hidden flex flex-col items-center mb-16 w-full max-w-[320px]">
          {STEPS.map((step, i) => {
            const Icon = step.Icon;
            return (
              <Fragment key={step.n}>
                <div className="w-[220px] h-[220px] rounded-full border border-[#7A8B73] flex flex-col items-center justify-center gap-2.5 px-7 text-center">
                  <Icon className="w-10 h-10 text-[#64765B]" />
                  <h3 className="font-serif text-[17px] text-[#364230] font-normal tracking-[0.005em] leading-tight">
                    {step.title}
                  </h3>
                  <p className="text-[11px] text-[#5D6B56] leading-[1.5]">
                    {step.body}
                  </p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-px h-9 bg-[#7A8B73]" />
                )}
              </Fragment>
            );
          })}
        </div>
        <Link
          href="/how-to-rent"
          className="bg-[#64765B] text-white px-8 py-3 text-[11px] uppercase tracking-[0.18em] font-medium hover:bg-[#52624B] transition-colors shadow-sm"
        >
          Learn How To Rent
        </Link>
      </section>
    </div>
  );
}

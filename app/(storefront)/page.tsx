import Link from "next/link";
import Image from "next/image";
import { Fragment } from "react";
import HomeHeroCarousel from "@/components/storefront/HomeHeroCarousel";
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
  const featuredDresses = [
    {
      sku: "ZM19",
      name: "Zimmermann Super Eight Ruffle Maxi",
      price: "Rp1.700.000",
      image: "/images/home/featured-1.jpg",
    },
    {
      sku: "ZM19",
      name: "Zimmermann Super Eight Ruffle Maxi",
      price: "Rp1.700.000",
      image: "/images/home/featured-2.jpg",
    },
    {
      sku: "ZM19",
      name: "Zimmermann Super Eight Ruffle Maxi",
      price: "Rp1.700.000",
      image: "/images/home/featured-3.jpg",
    },
  ];

  return (
    <div className="w-full overflow-x-hidden">
      {/* SECTION 1: HERO CAROUSEL */}
      <HomeHeroCarousel />

      {/* SECTION 2: FEATURED */}
      <section className="max-w-[1512px] mx-auto w-full py-20 sm:py-24 px-6 sm:px-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <h2 className="font-serif text-[28px] sm:text-[36px] font-normal tracking-[0.01em] text-[#2D3828] mb-2">
              Rent me once, Head be turning Twice!
            </h2>
            <p className="text-xs text-[#6A7563] max-w-xl">
              Romanticize your life with high-quality designer pieces — for a
              fraction of the price. Leave the commitment to us.
            </p>
          </div>

          <Link
            href="/shop"
            className="self-start md:self-auto bg-[#64765B] text-white px-5 py-2.5 text-[10.5px] uppercase tracking-[0.16em] font-medium hover:bg-[#52624B] transition-colors"
          >
            See All Collection
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {featuredDresses.map((dress, index) => (
            <Link
              key={index}
              href={`/shop/${dress.sku.toLowerCase()}`}
              className="group flex flex-col"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#E2E0D6] mb-3">
                <Image
                  src={dress.image}
                  alt={dress.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>
              <h3 className="font-serif text-[15px] text-[#242A20] group-hover:text-[#64765B] transition-colors line-clamp-1 font-normal">
                {dress.sku}-{dress.name}
              </h3>
              <p className="text-xs font-mono text-[#54644C] mt-0.5">
                {dress.price}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* SECTION 3: EDITORIAL */}
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

      {/* SECTION 4: AVAILABLE THIS WEEK */}
      <section className="w-full py-24 sm:py-28 px-6 bg-[#F2F0E9]">
        <div className="mx-auto max-w-[600px] flex flex-col items-center text-center">
          <div className="w-full max-w-[420px] mx-auto mb-8">
            <div className="relative aspect-[3/4] w-full overflow-hidden shadow-lg bg-[#E2E0D6] border border-[#DDD9CE]">
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

      {/* SECTION 5: HOW IT WORKS */}
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

        <div className="md:hidden grid grid-cols-2 gap-x-4 gap-y-10 mb-16 w-full max-w-[420px]">
          {STEPS.map((step) => {
            const Icon = step.Icon;
            return (
              <div key={step.n} className="flex flex-col items-center">
                <div className="w-[140px] h-[140px] rounded-full border border-[#7A8B73] flex flex-col items-center justify-center gap-2 px-2">
                  <Icon className="w-9 h-9 text-[#64765B]" />
                  <h3 className="font-serif text-[14px] text-[#364230] font-normal text-center leading-tight">
                    {step.title}
                  </h3>
                </div>
                <p className="text-[11px] text-[#5D6B56] text-center mt-4 max-w-[140px] leading-[1.5]">
                  {step.body}
                </p>
              </div>
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

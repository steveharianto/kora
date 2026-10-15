"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";

/**
 * Home "Featured" section.
 *
 * Mobile (Figma): the three featured pieces sit in a horizontal snap
 * carousel with a peek of the next card, prev/next long-arrow controls
 * below the track, and the "See All Collection" CTA under the arrows.
 * Desktop (≥sm): unchanged — header row with the CTA on the right and a
 * 2/3-column grid of cards.
 */
const FEATURED_DRESSES = [
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

export default function HomeFeaturedSection() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollByCard = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
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
          className="hidden sm:inline-block self-start md:self-auto bg-[#64765B] text-white px-5 py-2.5 text-[10.5px] uppercase tracking-[0.16em] font-medium hover:bg-[#52624B] transition-colors"
        >
          See All Collection
        </Link>
      </div>
      {/* Featured — below fold on every breakpoint, so no data-preload.
          Mobile: horizontal snap carousel with a peek of the next card.
          sm and up: the original grid. */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:snap-none sm:grid sm:grid-cols-2 md:grid-cols-3 sm:gap-6"
      >
        {FEATURED_DRESSES.map((dress, index) => (
          <Link
            key={index}
            href={`/shop/${dress.sku.toLowerCase()}`}
            className="group flex flex-col min-w-[78%] snap-start sm:min-w-0"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden mb-3">
              <Image
                src={dress.image}
                alt={dress.name}
                fill
                sizes="(max-width: 640px) 78vw, (max-width: 768px) 50vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
            </div>
            <h3 className="font-serif text-[15px] text-[#242A20] group-hover:text-[#64765B] transition-colors line-clamp-2 sm:line-clamp-1 font-normal">
              {dress.sku}-{dress.name}
            </h3>
            <p className="text-xs font-mono text-[#54644C] mt-0.5">
              {dress.price}
            </p>
          </Link>
        ))}
      </div>
      {/* Mobile-only carousel arrows (Figma) */}
      <div className="sm:hidden flex items-center gap-8 mt-6">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          aria-label="Previous featured dress"
          className="text-[#5D6B56] hover:text-[#2D3828] transition-colors cursor-pointer p-1"
        >
          <svg
            width="48"
            height="14"
            viewBox="0 0 48 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-10 h-auto"
            aria-hidden
          >
            <line x1="48" y1="7" x2="6" y2="7" />
            <polyline points="11,2 5,7 11,12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          aria-label="Next featured dress"
          className="text-[#5D6B56] hover:text-[#2D3828] transition-colors cursor-pointer p-1"
        >
          <svg
            width="48"
            height="14"
            viewBox="0 0 48 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-10 h-auto"
            aria-hidden
          >
            <line x1="0" y1="7" x2="42" y2="7" />
            <polyline points="37,2 43,7 37,12" />
          </svg>
        </button>
      </div>
      {/* Mobile-only CTA placed under the arrows (Figma) */}
      <Link
        href="/shop"
        className="sm:hidden mt-6 inline-block bg-[#64765B] text-white px-5 py-2.5 text-[10.5px] uppercase tracking-[0.16em] font-medium hover:bg-[#52624B] transition-colors"
      >
        See All Collection
      </Link>
    </section>
  );
}

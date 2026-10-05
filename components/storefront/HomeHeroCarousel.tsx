"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Home hero — 3-slide crossfade carousel.
 *
 * Images live in /public/images/home/:
 *   hero-1.jpg → New Arrivals      (already exists)
 *   hero-2.jpg → Available This Week
 *   hero-3.jpg → See Our Collection
 *
 * Behaviour:
 *   • Autoplay every 10 s, pauses on hover.
 *   • Left / right arrow buttons (thin editorial line arrows).
 *   • Dot indicators — active dot larger + fully opaque.
 *   • ← / → keyboard navigation.
 *   • Crossfade transition (opacity) — all slides stay mounted so the
 *     browser preloads the images and slide changes are flicker-free.
 */

interface Slide {
  title: string;
  href: string;
  image: string;
  alt: string;
}

const SLIDES: Slide[] = [
  {
    title: "New Arrivals",
    href: "/shop?filter=new",
    image: "/images/home/hero-1.jpg",
    alt: "New arrivals — KORA designer dress collection",
  },
  {
    title: "Available This Week",
    href: "/shop?filter=available-now",
    image: "/images/home/hero-2.jpg",
    alt: "Pieces available to rent this week",
  },
  {
    title: "See Our Collection",
    href: "/shop",
    image: "/images/home/hero-3.jpg",
    alt: "Explore the full KORA collection",
  },
];

const AUTOPLAY_MS = 10000;

export default function HomeHeroCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const go = useCallback((next: number) => {
    setActive(((next % SLIDES.length) + SLIDES.length) % SLIDES.length);
  }, []);

  const next = useCallback(() => go(active + 1), [active, go]);
  const prev = useCallback(() => go(active - 1), [active, go]);

  /* ── Autoplay (cleared on hover, dot click, or navigation) ─────────── */
  useEffect(() => {
    if (paused) return;
    timeoutRef.current = window.setTimeout(next, AUTOPLAY_MS);
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [active, paused, next]);

  /* ── Keyboard arrows ──────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  return (
    <section
      className="relative w-full h-[540px] sm:h-[640px] overflow-hidden select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured collections"
    >
      {/* ── Image layers (crossfade stack) ───────────────────────────── */}
      {SLIDES.map((slide, i) => (
        <div
          key={slide.image}
          className={`absolute inset-0 z-0 transition-opacity duration-700 ease-out ${
            i === active ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={i !== active}
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url('${slide.image}')` }}
          />
          {/* Legibility overlay — kept lighter than the old dark wash so the
              dress photography still reads. */}
          <div className="absolute inset-0 bg-black/25" />
        </div>
      ))}

      {/* ── Foreground content ───────────────────────────────────────── */}
      {SLIDES.map((slide, i) => (
        <div
          key={slide.title}
          className={`absolute inset-0 flex flex-col items-center justify-center text-center px-6 transition-opacity duration-700 ${
            i === active
              ? "opacity-100 pointer-events-auto z-20"
              : "opacity-0 pointer-events-none z-10"
          }`}
        >
          <h1 className="font-serif font-normal text-[44px] sm:text-[64px] leading-[1.05] tracking-[0.005em] text-[#FBF9F5] drop-shadow-sm mb-8">
            {slide.title}
          </h1>
          <Link
            href={slide.href}
            className="inline-block bg-[#ECEBE4] text-[#1F261C] px-9 py-3 text-[11px] uppercase tracking-[0.22em] font-medium hover:bg-white transition-colors shadow-md"
          >
            Shop Now
          </Link>
        </div>
      ))}

      {/* ── Left arrow ───────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-4 sm:left-10 top-1/2 -translate-y-1/2 z-30 text-white/85 hover:text-white transition-colors cursor-pointer p-2 group"
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
          className="w-10 sm:w-12 h-auto transition-transform duration-200 group-hover:-translate-x-1"
          aria-hidden
        >
          <line x1="48" y1="7" x2="6" y2="7" />
          <polyline points="11,2 5,7 11,12" />
        </svg>
      </button>

      {/* ── Right arrow ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={next}
        aria-label="Next slide"
        className="absolute right-4 sm:right-10 top-1/2 -translate-y-1/2 z-30 text-white/85 hover:text-white transition-colors cursor-pointer p-2 group"
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
          className="w-10 sm:w-12 h-auto transition-transform duration-200 group-hover:translate-x-1"
          aria-hidden
        >
          <line x1="0" y1="7" x2="42" y2="7" />
          <polyline points="37,2 43,7 37,12" />
        </svg>
      </button>

      {/* ── Dot indicators ───────────────────────────────────────────── */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3">
        {SLIDES.map((slide, i) => {
          const isActive = i === active;
          return (
            <button
              key={slide.image}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}: ${slide.title}`}
              aria-current={isActive}
              className={`rounded-full transition-all duration-200 cursor-pointer ${
                isActive
                  ? "w-2.5 h-2.5 bg-white"
                  : "w-2 h-2 bg-white/40 hover:bg-white/70"
              }`}
            />
          );
        })}
      </div>
    </section>
  );
}

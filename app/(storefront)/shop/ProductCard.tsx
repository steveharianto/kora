"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatRupiah } from "@/lib/utils";

interface Item {
  sku: string;
  name: string;
  rentalPrice: number;
  coverImage: string | null;
}

export default function ProductCard({
  item,
  priority = false,
}: {
  item: Item;
  /** Set true for the first 4 cards above the fold — enables LCP preload. */
  priority?: boolean;
}) {
  const href = `/shop/${item.sku.toLowerCase()}`;
  const [loaded, setLoaded] = useState(false);

  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#E2E0D6] mb-3">
        {item.coverImage ? (
          <>
            {/* Pulse placeholder — shown until the optimized image paints. */}
            {!loaded && (
              <div
                aria-hidden
                className="absolute inset-0 bg-[#E2E0D6] animate-pulse"
              />
            )}
            <Image
              src={item.coverImage}
              alt={item.name}
              fill
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onLoad={() => setLoaded(true)}
              className={`object-cover transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.03] ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-store-fg-subtle text-[11px] tracking-wider uppercase">
            No image
          </div>
        )}
      </div>

      <h3 className="font-serif text-[14px] sm:text-[15px] leading-snug text-store-fg group-hover:text-store-accent transition-colors line-clamp-2">
        {item.sku}-{item.name}
      </h3>
      <p className="text-[12px] tracking-wide text-store-fg-muted mt-1">
        {formatRupiah(item.rentalPrice)}
      </p>
    </Link>
  );
}

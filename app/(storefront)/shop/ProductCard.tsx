"use client";

import Link from "next/link";

interface Item {
  sku: string;
  name: string;
  rentalPrice: number;
  coverImage: string | null;
}

export default function ProductCard({ item }: { item: Item }) {
  const href = `/shop/${item.sku.toLowerCase()}`;

  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#E2E0D6] mb-3">
        {item.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverImage}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
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
        Rp. {item.rentalPrice.toLocaleString("id-ID")}
      </p>
    </Link>
  );
}

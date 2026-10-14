"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
  appearDelay,
}: {
  item: Item;
  priority?: boolean;
  appearDelay?: number;
}) {
  const router = useRouter();
  const href = `/shop/${item.sku.toLowerCase()}`;
  const [imgLoaded, setImgLoaded] = useState(false);

  const isAnimated = appearDelay !== undefined;
  const ready = imgLoaded || !item.coverImage;

  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  const style: React.CSSProperties = isAnimated
    ? {
        opacity: ready ? 1 : 0,
        transform: ready ? "translateY(0)" : "translateY(12px)",
        transition: `opacity 400ms ${ease} ${appearDelay}ms, transform 400ms ${ease} ${appearDelay}ms`,
        willChange: ready ? undefined : "opacity, transform",
      }
    : {};

  return (
    <Link
      href={href}
      onMouseEnter={() => router.prefetch(href)}
      className="group block"
      style={style}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden mb-3">
        {item.coverImage ? (
          <Image
            src={item.coverImage}
            alt={item.name}
            fill
            priority={priority}
            onLoad={() => setImgLoaded(true)}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-store-fg-subtle text-[11px] tracking-wider uppercase border border-store-border">
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

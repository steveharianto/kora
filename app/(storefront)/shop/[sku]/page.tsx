import { notFound } from "next/navigation";
import ProductDetail from "./ProductDetail";
import { getCachedProductDetail } from "@/lib/cache/storefront";

// ISR — the page is fully static per SKU, CDN-cached, and prefetchable.
// Tag invalidation via revalidateTag('items', 'max') in admin actions
// busts both this cache and the underlying fetcher cache immediately.
export const revalidate = 3600;

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;

  // Normalize here so 'zm19' and 'ZM19' share one cache entry.
  const payload = await getCachedProductDetail(sku.toUpperCase());

  if (!payload.item) {
    notFound();
  }

  return (
    <ProductDetail
      item={payload.item}
      relatedItems={payload.relatedItems}
      accessories={payload.accessories}
      deliveryLeadTimes={payload.deliveryLeadTimes}
    />
  );
}

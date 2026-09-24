import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const supabase = await createClient();

  // Case-insensitive lookup — homepage links use .toLowerCase().
  const { data: item } = await supabase
    .from("items")
    .select(`
      sku, name, rental_price, description,
      brands ( name ),
      item_images ( image_url, display_order )
    `)
    .ilike("sku", sku)
    .eq("website_status", "Published")
    .eq("is_archived", false)
    .maybeSingle();

  if (!item) notFound();

  const images = (item.item_images || [])
    .sort((a: any, b: any) => a.display_order - b.display_order)
    .map((im: any) => im.image_url);

  return (
    <div className="max-w-[1512px] mx-auto px-6 sm:px-12 py-12">
      <Link
        href="/shop"
        className="text-[12px] tracking-[0.16em] uppercase text-store-fg-muted hover:text-store-fg inline-block mb-8"
      >
        ← Back to Shop
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="aspect-[3/4] bg-[#E2E0D6] overflow-hidden">
          {images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[0]} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-store-fg-subtle text-xs uppercase tracking-widest">
              No image
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="text-[11px] tracking-[0.22em] uppercase text-store-fg-muted mb-3">
            {(item.brands as any)?.name || "KORA"}
          </div>
          <h1 className="font-serif text-[28px] sm:text-[36px] text-store-fg leading-tight mb-4">
            {item.sku}-{item.name}
          </h1>
          <p className="text-[15px] text-store-fg-muted mb-8">
            Rp. {(Number(item.rental_price) || 0).toLocaleString("id-ID")}
          </p>

          <div className="p-6 border border-store-border bg-store-surface-2 text-[13px] text-store-fg-muted leading-relaxed">
            Full product details, size guide, availability checker, and booking flow will land
            in the next commit. For now this page confirms the SKU exists and renders its first
            image.
          </div>
        </div>
      </div>
    </div>
  );
}

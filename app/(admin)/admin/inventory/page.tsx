import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/utils";
import { getCurrentAdmin } from "@/app/actions/auth";

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Available: "bg-ok-bg text-ok",
    "Under Repair": "bg-warn-bg text-warn",
    "Coming Soon": "bg-wine-soft text-wine-ink",
    Unavailable: "bg-[#EFEBE2] text-muted",
    Published: "bg-ok-bg text-ok",
    Draft: "bg-[#EFEBE2] text-muted",
  };

  const style = styles[status] || "bg-[#EFEBE2] text-muted";

  return (
    <span
      className={`inline-block text-[10.5px] font-semibold tracking-[0.06em] uppercase rounded-full px-2.5 py-1 whitespace-nowrap ${style}`}
    >
      {status}
    </span>
  );
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const currentTab = resolvedSearchParams.tab || "all";

  const supabase = await createClient();
  const currentAdmin = await getCurrentAdmin();
  const isSuperAdmin = currentAdmin?.role === "superadmin";

  const { data: items, error } = await supabase
    .from("items")
    .select(
      `
      sku,
      name,
      size,
      rental_price,
      buffer_override,
      status,
      website_status,
      date_added,
      pending_action,
      brand:brands(name),
      type:types(name),
      images:item_images(id)
    `,
    )
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching inventory:", error);
  }

  // Filter Logic
  const allItems = items || [];

  const pendingItems = allItems.filter((i) => i.pending_action !== null);

  // "Needs Attention" criteria: Missing Brand, Price, Size, or 0 Images
  const needsAttentionItems = allItems.filter(
    (i) =>
      // @ts-ignore
      !i.brand?.name || !i.rental_price || !i.size || i.images.length === 0,
  );

  let displayItems = allItems;
  if (currentTab === "needs-attention") displayItems = needsAttentionItems;
  if (currentTab === "pending" && isSuperAdmin) displayItems = pendingItems;

  return (
    <div className="">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1.5">
            Catalog
          </div>
          <h1 className="font-serif text-[32px] font-normal tracking-[0.01em]">
            Inventory
          </h1>
        </div>
        <Link
          href="/admin/inventory/new"
          className="font-medium border border-wine bg-wine text-white rounded-lg px-3.5 py-2 text-sm hover:bg-[#181E15] transition"
        >
          + Add Item
        </Link>
      </div>

      <div className="flex gap-4 border-b border-line mb-5">
        <Link
          href="?tab=needs-attention"
          className={`pb-2.5 text-sm font-medium transition-colors ${
            currentTab === "needs-attention"
              ? "text-wine-ink border-b-2 border-wine"
              : "text-muted hover:text-ink"
          }`}
        >
          Needs Attention{" "}
          <span className="bg-[#EFEBE2] text-muted text-[10px] px-1.5 py-0.5 rounded-full ml-1">
            {needsAttentionItems.length}
          </span>
        </Link>

        {isSuperAdmin && (
          <Link
            href="?tab=pending"
            className={`pb-2.5 text-sm font-medium transition-colors ${
              currentTab === "pending"
                ? "text-wine-ink border-b-2 border-wine"
                : "text-muted hover:text-ink"
            }`}
          >
            Pending Approval{" "}
            <span className="bg-[#EFEBE2] text-muted text-[10px] px-1.5 py-0.5 rounded-full ml-1">
              {pendingItems.length}
            </span>
          </Link>
        )}

        <Link
          href="?tab=all"
          className={`pb-2.5 text-sm font-medium transition-colors ${
            currentTab === "all"
              ? "text-wine-ink border-b-2 border-wine"
              : "text-muted hover:text-ink"
          }`}
        >
          All Items
        </Link>
      </div>

      <div className="bg-card border border-line rounded-[10px] p-1.5 pb-0 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse font-tabular-nums text-[13px] min-w-[980px]">
            <thead>
              <tr>
                <th className="text-[10.5px] tracking-[0.16em] uppercase text-muted text-left font-medium px-3 py-2.5 border-b border-line whitespace-nowrap">
                  Code
                </th>
                <th className="text-[10.5px] tracking-[0.16em] uppercase text-muted text-left font-medium px-3 py-2.5 border-b border-line whitespace-nowrap">
                  Item
                </th>
                <th className="text-[10.5px] tracking-[0.16em] uppercase text-muted text-left font-medium px-3 py-2.5 border-b border-line whitespace-nowrap">
                  Brand
                </th>
                <th className="text-[10.5px] tracking-[0.16em] uppercase text-muted text-left font-medium px-3 py-2.5 border-b border-line whitespace-nowrap">
                  Type
                </th>
                <th className="text-[10.5px] tracking-[0.16em] uppercase text-muted text-left font-medium px-3 py-2.5 border-b border-line whitespace-nowrap">
                  Size
                </th>
                <th className="text-[10.5px] tracking-[0.16em] uppercase text-muted text-right font-medium px-3 py-2.5 border-b border-line whitespace-nowrap">
                  Price
                </th>
                <th className="text-[10.5px] tracking-[0.16em] uppercase text-muted text-left font-medium px-3 py-2.5 border-b border-line whitespace-nowrap">
                  Buffer
                </th>
                <th className="text-[10.5px] tracking-[0.16em] uppercase text-muted text-left font-medium px-3 py-2.5 border-b border-line whitespace-nowrap">
                  Website
                </th>
                <th className="text-[10.5px] tracking-[0.16em] uppercase text-muted text-left font-medium px-3 py-2.5 border-b border-line whitespace-nowrap">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {displayItems?.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-[11px] text-muted text-center"
                  >
                    No items found.
                  </td>
                </tr>
              ) : (
                displayItems?.map((item) => (
                  <tr key={item.sku} className="hover:bg-[#FBFAF6]">
                    <td className="px-3 py-[11px] border-b border-[#EFEBE2] align-top font-bold">
                      <Link
                        href={`/admin/inventory/${item.sku}`}
                        className="hover:underline text-wine-ink hover:text-black"
                      >
                        {item.sku}
                      </Link>
                      {item.pending_action && (
                        <span className="ml-2 bg-warn-bg text-warn-ink text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded">
                          {item.pending_action} Req
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-[11px] border-b border-[#EFEBE2] align-top">
                      {item.name}
                    </td>
                    <td className="px-3 py-[11px] border-b border-[#EFEBE2] align-top">
                      {/* @ts-ignore - joining relation */}
                      {item.brand?.name || "—"}
                    </td>
                    <td className="px-3 py-[11px] border-b border-[#EFEBE2] align-top">
                      {/* @ts-ignore - joining relation */}
                      {item.type?.name || "—"}
                    </td>
                    <td className="px-3 py-[11px] border-b border-[#EFEBE2] align-top">
                      {item.size || "—"}
                    </td>
                    <td className="px-3 py-[11px] border-b border-[#EFEBE2] align-top text-right">
                      {item.rental_price
                        ? formatRupiah(item.rental_price)
                        : "—"}
                    </td>
                    <td className="px-3 py-[11px] border-b border-[#EFEBE2] align-top">
                      {item.buffer_override !== null ? (
                        <>
                          {item.buffer_override}{" "}
                          <span className="text-wine-ink bg-wine-soft px-1.5 py-0.5 rounded text-[10.5px] font-semibold uppercase tracking-wider ml-1">
                            OVR
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-[11px] border-b border-[#EFEBE2] align-top">
                      <StatusPill status={item.website_status} />
                    </td>
                    <td className="px-3 py-[11px] border-b border-[#EFEBE2] align-top">
                      <StatusPill status={item.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

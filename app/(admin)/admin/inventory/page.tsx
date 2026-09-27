import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatRupiah } from "@/lib/utils";
import { getCurrentAdmin } from "@/app/actions/auth";
import { History, X } from "lucide-react";

const HISTORICAL_PLACEHOLDER_PREFIX = "[Historical Placeholder]";

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Available: "bg-ok-bg text-ok",
    "Under Repair": "bg-warn-bg text-warn",
    "Coming Soon": "bg-wine-soft text-wine-ink",
    Unavailable: "bg-[#EFEBE2] text-muted",
    Published: "bg-ok-bg text-ok",
    Draft: "bg-[#EFEBE2] text-muted",
    Archived: "bg-[#EFEBE2] text-muted line-through",
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
  searchParams: Promise<{ tab?: string; historical?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const currentTab = resolvedSearchParams.tab || "all";
  // Historical mode reveals archived items AND placeholder imports.
  const showHistorical = resolvedSearchParams.historical === "1";

  const supabase = await createClient();
  const currentAdmin = await getCurrentAdmin();
  const isSuperAdmin = currentAdmin?.role === "superadmin";

  let query = supabase
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
      is_archived,
      brand:brands(name),
      type:types(name),
      images:item_images(id)
    `,
    )
    .order("created_at", { ascending: false });

  // Default view: hide archived items *and* historical placeholders.
  // Both are "not part of the active catalog" — the toggle reveals both.
  if (!showHistorical) {
    query = query
      .eq("is_archived", false)
      .not("name", "ilike", `${HISTORICAL_PLACEHOLDER_PREFIX}%`);
  }

  const { data: items, error } = await query;

  if (error) {
    console.error("Error fetching inventory:", error);
  }

  const allItems = items || [];

  const isHistoricalPlaceholder = (i: any) =>
    typeof i.name === "string" &&
    i.name.startsWith(HISTORICAL_PLACEHOLDER_PREFIX);

  const activeItems = allItems.filter(
    (i) => !i.is_archived && !isHistoricalPlaceholder(i),
  );
  const archivedItems = allItems.filter((i) => i.is_archived);
  const placeholderItems = allItems.filter(isHistoricalPlaceholder);

  const pendingItems = activeItems.filter((i) => i.pending_action !== null);

  const needsAttentionItems = activeItems.filter(
    (i) =>
      // @ts-ignore
      !i.brand?.name || !i.rental_price || !i.size || i.images.length === 0,
  );

  let displayItems = showHistorical ? allItems : activeItems;
  if (currentTab === "needs-attention") {
    displayItems = needsAttentionItems;
  }
  if (currentTab === "pending" && isSuperAdmin) {
    displayItems = pendingItems;
  }

  const toggleHref = (() => {
    const params = new URLSearchParams();
    if (currentTab !== "all") params.set("tab", currentTab);
    if (!showHistorical) params.set("historical", "1");
    const qs = params.toString();
    return qs ? `/admin/inventory?${qs}` : "/admin/inventory";
  })();

  const tabHref = (tab: string) => {
    const params = new URLSearchParams();
    if (tab !== "all") params.set("tab", tab);
    if (showHistorical) params.set("historical", "1");
    const qs = params.toString();
    return qs ? `/admin/inventory?${qs}` : "/admin/inventory";
  };

  const hiddenCount = archivedItems.length + placeholderItems.length;

  return (
    <div>
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

      {/* Tabs + Historical toggle row */}
      <div className="flex items-end justify-between gap-4 border-b border-line mb-5">
        <div className="flex gap-4">
          <Link
            href={tabHref("needs-attention")}
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
              href={tabHref("pending")}
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
            href={tabHref("all")}
            className={`pb-2.5 text-sm font-medium transition-colors ${
              currentTab === "all"
                ? "text-wine-ink border-b-2 border-wine"
                : "text-muted hover:text-ink"
            }`}
          >
            All Items
          </Link>
        </div>

        <Link
          href={toggleHref}
          className={`flex items-center gap-1.5 pb-2.5 text-xs font-medium transition-colors ${
            showHistorical ? "text-wine-ink" : "text-muted hover:text-ink"
          }`}
          title={
            showHistorical
              ? "Hide archived and placeholder items from the list"
              : "Show archived items and historical placeholders"
          }
        >
          {showHistorical ? (
            <>
              <X className="w-3.5 h-3.5" strokeWidth={1.8} />
              Hide Historical
              <span className="bg-wine-soft text-wine-ink text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                {hiddenCount}
              </span>
            </>
          ) : (
            <>
              <History className="w-3.5 h-3.5" strokeWidth={1.8} />
              Show Historical
              {hiddenCount > 0 && (
                <span className="bg-[#EFEBE2] text-muted text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                  {hiddenCount}
                </span>
              )}
            </>
          )}
        </Link>
      </div>

      {/* Historical mode banner */}
      {showHistorical && (
        <div className="mb-4 p-3 bg-[#FBF8EF] border border-[#E8DFC2] text-[#84661E] rounded-lg text-xs flex items-start gap-2">
          <History className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Historical view.</strong> Archived items and placeholder
            imports are included — they exist only to preserve past order lines
            and reports. They are not bookable and do not appear on the
            storefront.
            {placeholderItems.length > 0 && (
              <>
                {" "}
                ({placeholderItems.length} placeholder
                {placeholderItems.length === 1 ? "" : "s"} shown)
              </>
            )}
          </span>
        </div>
      )}

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
                displayItems?.map((item) => {
                  const isPlaceholder = isHistoricalPlaceholder(item);
                  const dim = item.is_archived || isPlaceholder;
                  return (
                    <tr
                      key={item.sku}
                      className={`hover:bg-[#FBFAF6] ${dim ? "opacity-60" : ""}`}
                    >
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
                        {item.is_archived && (
                          <span className="ml-2 bg-[#EFEBE2] text-muted text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded">
                            Archived
                          </span>
                        )}
                        {isPlaceholder && !item.is_archived && (
                          <span className="ml-2 bg-[#EFEBE2] text-muted text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded">
                            Placeholder
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
                        <StatusPill
                          status={item.is_archived ? "Archived" : item.status}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

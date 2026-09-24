import { createClient } from "@/lib/supabase/server";
import { getCurrentCustomer } from "@/app/actions/customerAuth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Fitting Sessions | KORA",
};

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Confirmed: "bg-green-100 text-green-800",
  Completed: "bg-store-fg/10 text-store-fg-muted",
  Cancelled: "bg-red-100 text-red-800",
  "Conflict Evicted": "bg-amber-100 text-amber-800",
  "No Show": "bg-red-100 text-red-800",
};

export default async function FittingsPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/account/login");

  const supabase = await createClient();
  const { data: fittings } = await supabase
    .from("fittings")
    .select(`
      id, date, slot, end_time, status, is_after_hours, after_hours_fee, fee_payment_status,
      fitting_items ( item_sku, is_evicted, items ( name, item_images ( image_url, display_order ) ) )
    `)
    .eq("customer_id", customer.id)
    .order("date", { ascending: false })
    .order("slot", { ascending: false });

  const list = fittings || [];

  return (
    <div className="space-y-8">
      <h2 className="font-serif text-[28px] sm:text-[32px] text-store-fg font-normal">
        Fitting Sessions
      </h2>

      {list.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[13px] text-store-fg-muted mb-4">
            No fitting sessions booked yet.
          </p>
          <Link
            href="/shop"
            className="inline-block px-8 py-3 bg-store-accent text-white text-[11px] tracking-[0.2em] uppercase font-medium hover:bg-store-accent-hover transition-colors"
          >
            Browse Collection
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {list.map((f: any) => (
            <div key={f.id} className="border border-store-border p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                <div>
                  <p className="font-serif text-[16px] text-store-fg mb-0.5">
                    {fmtLongWeekday(f.date)}
                  </p>
                  <p className="text-[12px] text-store-fg-muted">{fmtSlot(f.slot)}</p>
                </div>
                <span
                  className={`text-[10px] tracking-[0.14em] uppercase font-medium px-2.5 py-1 ${
                    STATUS_STYLES[f.status] || "bg-store-fg/10 text-store-fg-muted"
                  }`}
                >
                  {f.status}
                </span>
              </div>

              <div className="border-t border-store-border pt-4 space-y-3">
                {(f.fitting_items || []).map((fi: any, i: number) => {
                  const cover = (fi.items?.item_images || [])
                    .sort((a: any, b: any) => a.display_order - b.display_order)[0]?.image_url;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-12 aspect-[3/4] flex-shrink-0 bg-[#E2E0D6] overflow-hidden">
                        {cover && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <p
                        className={`text-[13px] ${
                          fi.is_evicted ? "text-store-fg-subtle line-through" : "text-store-fg"
                        }`}
                      >
                        {fi.item_sku}-{fi.items?.name || ""}
                      </p>
                    </div>
                  );
                })}
              </div>

              {f.is_after_hours && (
                <p className="text-[11.5px] text-store-fg-muted mt-4 pt-4 border-t border-store-border">
                  After-hours fee:{" "}
                  <strong className="text-store-fg">
                    Rp {(Number(f.after_hours_fee) || 0).toLocaleString("id-ID")}
                  </strong>{" "}
                  — {f.fee_payment_status}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtLongWeekday(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtSlot(slot: string) {
  const h = slot.split(":")[0];
  const nh = String(parseInt(h, 10) + 1).padStart(2, "0");
  return `${h}.00 – ${nh}.00`;
}

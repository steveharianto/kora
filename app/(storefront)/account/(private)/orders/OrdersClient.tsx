"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReturnProcessModal from "./ReturnProcessModal";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  Draft: { bg: "bg-store-fg/10", text: "text-store-fg-muted", label: "DRAFT" },
  Ordered: { bg: "bg-amber-100", text: "text-amber-800", label: "UPCOMING" },
  "In Shipping": { bg: "bg-blue-100", text: "text-blue-800", label: "OUT FOR DELIVERY" },
  Active: { bg: "bg-green-100", text: "text-green-800", label: "RETURN DEADLINE" },
  Completed: { bg: "bg-store-fg/10", text: "text-store-fg-muted", label: "COMPLETED" },
  Cancelled: { bg: "bg-red-100", text: "text-red-800", label: "CANCELLED" },
};

export default function OrdersClient({ orders }: { orders: any[] }) {
  const router = useRouter();
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <h2 className="font-serif text-[28px] sm:text-[32px] text-store-fg font-normal">
        Order History
      </h2>

      {orders.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[13px] text-store-fg-muted mb-4">No orders yet.</p>
          <Link
            href="/shop"
            className="inline-block px-8 py-3 bg-store-accent text-white text-[11px] tracking-[0.2em] uppercase font-medium hover:bg-store-accent-hover transition-colors"
          >
            Browse Collection
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onRequestReturn={() => setReturnOrderId(o.id)}
            />
          ))}
        </div>
      )}

      <ReturnProcessModal
        isOpen={returnOrderId !== null}
        onClose={() => setReturnOrderId(null)}
        orderId={returnOrderId}
        onCompleted={() => {
          router.refresh();
        }}
      />
    </div>
  );
}

function OrderCard({
  order,
  onRequestReturn,
}: {
  order: any;
  onRequestReturn: () => void;
}) {
  const meta = STATUS_STYLES[order.status] || STATUS_STYLES.Draft;
  const items = order.order_products || [];
  const subtotal = items.reduce(
    (sum: number, p: any) => sum + (Number(p.price) || 0) * (p.quantity || 1),
    0,
  );

  const existingReturn = order.returns?.[0] || order.returns || null;
  const customerPhone = order.customers?.phone || "—";

  return (
    <div className="border border-store-border p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <span className="text-[11.5px] tracking-[0.14em] uppercase text-store-fg-muted">
          ORDERNO{order.id}
        </span>
        <span
          className={`text-[10px] tracking-[0.14em] uppercase font-medium px-2.5 py-1 ${meta.bg} ${meta.text}`}
        >
          ● {meta.label}
        </span>
      </div>

      <div className="space-y-5 border-t border-store-border pt-5">
        {items.map((p: any, i: number) => {
          const cover = (p.items?.item_images || [])
            .sort((a: any, b: any) => a.display_order - b.display_order)[0]
            ?.image_url;
          return (
            <div key={i} className="flex gap-4">
              <div className="w-16 aspect-[3/4] flex-shrink-0 bg-[#E2E0D6] overflow-hidden">
                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif text-[14px] text-store-fg mb-1">
                  {p.item_sku}-{p.items?.name || ""}
                </p>
                <p className="text-[12.5px] text-store-fg mb-2">
                  Rp. {(Number(p.price) || 0).toLocaleString("id-ID")}
                </p>
                <p className="text-[11.5px] text-store-fg-muted">
                  Rental Date&nbsp;&nbsp;
                  {fmtRange(order.pickup_date, order.return_date)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-store-border mt-5 pt-4">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-[13px] text-store-fg-muted">Subtotal</span>
          <span className="text-[15px] text-store-fg font-semibold">
            Rp {subtotal.toLocaleString("id-ID")}
          </span>
        </div>

        <div className="space-y-1.5 text-[12px] text-store-fg-muted mb-4">
          <p>Phone Number</p>
          <p className="text-store-fg font-mono">{customerPhone}</p>
          <p className="pt-2">Address</p>
          <p className="text-store-fg">
            {order.street_address}, {order.city} {order.postal_code || ""}
          </p>
          {order.packing_slip_id && (
            <>
              <p className="pt-2">Tracking Number</p>
              <p className="text-store-fg font-mono">{order.packing_slip_id}</p>
            </>
          )}
        </div>

        {order.status === "Ordered" && !existingReturn && (
          <button
            type="button"
            disabled
            title="Address changes are coming soon — contact us on WhatsApp to update"
            className="mt-2 px-5 py-2.5 border border-store-border-strong text-[10.5px] tracking-[0.18em] uppercase text-store-fg-muted opacity-60 cursor-not-allowed"
          >
            Change Address
          </button>
        )}

        {order.status === "Active" && !existingReturn && (
          <button
            type="button"
            onClick={onRequestReturn}
            className="mt-2 px-5 py-2.5 bg-store-accent text-white text-[10.5px] tracking-[0.18em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer"
          >
            Return Items
          </button>
        )}

        {existingReturn && (
          <div className="mt-2 inline-flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase text-store-fg-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-store-accent inline-block" />
            Return {existingReturn.status}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtRange(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  return `${new Date(start).getDate()}–${fmt(end)}`;
}

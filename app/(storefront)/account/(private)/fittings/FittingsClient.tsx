"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CancelFittingModal from "./CancelFittingModal";
import RescheduleFittingModal from "./RescheduleFittingModal";

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Confirmed: "bg-green-100 text-green-800",
  Completed: "bg-store-fg/10 text-store-fg-muted",
  Cancelled: "bg-red-100 text-red-800",
  "Conflict Evicted": "bg-amber-100 text-amber-800",
  "No Show": "bg-red-100 text-red-800",
};

const INACTIVE_STATUSES = ["Cancelled", "Completed", "Conflict Evicted", "No Show"];

export default function FittingsClient({ fittings }: { fittings: any[] }) {
  const router = useRouter();
  const [cancelTarget, setCancelTarget] = useState<{
    id: string;
    date: string;
    slot: string;
  } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<{
    id: string;
    date: string;
    slot: string;
  } | null>(null);

  return (
    <div className="space-y-8">
      <h2 className="font-serif text-[28px] sm:text-[32px] text-store-fg font-normal">
        Fitting Sessions
      </h2>

      {fittings.length === 0 ? (
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
          {fittings.map((f) => {
            const inactive = INACTIVE_STATUSES.includes(f.status);
            const target = { id: f.id, date: f.date, slot: f.slot };

            return (
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
                      .sort((a: any, b: any) => a.display_order - b.display_order)[0]
                      ?.image_url;
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
                            fi.is_evicted
                              ? "text-store-fg-subtle line-through"
                              : "text-store-fg"
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

                {!inactive && (
                  <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-store-border">
                    <button
                      type="button"
                      onClick={() => setRescheduleTarget(target)}
                      className="px-5 py-2.5 bg-store-accent text-white text-[10.5px] tracking-[0.18em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer"
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancelTarget(target)}
                      className="px-5 py-2.5 border border-store-fg text-store-fg text-[10.5px] tracking-[0.18em] uppercase font-medium hover:bg-store-hover/50 transition-colors cursor-pointer"
                    >
                      Cancel Session
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CancelFittingModal
        isOpen={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        fitting={cancelTarget}
        onCompleted={() => router.refresh()}
      />

      <RescheduleFittingModal
        isOpen={rescheduleTarget !== null}
        onClose={() => setRescheduleTarget(null)}
        fitting={rescheduleTarget}
        onCompleted={() => router.refresh()}
      />
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

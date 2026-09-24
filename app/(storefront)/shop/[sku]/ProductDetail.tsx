"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AvailabilityModal from "./AvailabilityModal";
import FittingModal from "./FittingModal";
import {
  readRentalCart,
  writeRentalCart,
  readFittingCart,
  writeFittingCart,
  isAfterHoursSlot,
} from "@/lib/storefront/cart";

interface Item {
  sku: string;
  name: string;
  brand: string;
  type: string;
  description: string;
  size: string;
  color: string;
  tags: string[];
  rentalPrice: number;
  measurements: {
    outer?: Record<string, string>;
    inner?: Record<string, string>;
    skirt?: Record<string, string>;
  };
  images: string[];
}
interface RelatedItem {
  sku: string;
  name: string;
  rentalPrice: number;
  coverImage: string | null;
}
interface Accessory {
  sku: string;
  name: string;
  rentalPrice: number;
  image: string | null;
}

const SIZE_LABELS: Array<[string, string]> = [
  ["bust", "Bust"],
  ["waist", "Waist"],
  ["hips", "Hips"],
  ["length_front", "Front Length"],
  ["length_back", "Back Length"],
  ["arm_hole", "Arm Hole"],
  ["arm_length", "Arm Length"],
];

type TabKey = "description" | "size" | "tnc" | "fitting";

export default function ProductDetail({
  item,
  relatedItems,
  accessories,
  fittingPrefill,
}: {
  item: Item;
  relatedItems: RelatedItem[];
  accessories: Accessory[];
  fittingPrefill: { date: string; slot: string } | null;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("description");
  const [activeImg, setActiveImg] = useState(0);
  const [availOpen, setAvailOpen] = useState(false);
  const [fitOpen, setFitOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  const addToRentalCart = (payload: {
    sku: string;
    rentalStart: string;
    rentalEnd: string;
    postalCode: string;
    accessories: string[];
  }) => {
    try {
      const next = readRentalCart();
      next.push({
        sku: payload.sku,
        name: item.name,
        price: item.rentalPrice,
        image: item.images[0] || null,
        rentalStart: payload.rentalStart,
        rentalEnd: payload.rentalEnd,
        postalCode: payload.postalCode,
        accessories: payload.accessories,
      });
      writeRentalCart(next);
      setToast("Added to rental cart");
    } catch {
      setToast("Could not save to cart");
    }
  };

  const addToFittingCart = (payload: {
    date: string;
    slot: string;
    sku: string;
  }) => {
    try {
      const sessions = readFittingCart();
      const existing = sessions.find(
        (s) => s.date === payload.date && s.slot === payload.slot,
      );

      const isAfterHours = isAfterHoursSlot(payload.date, payload.slot);
      const fee = isAfterHours ? 100000 : 0; // TODO: read from app_settings.fittings.session_rules.after_hours_fee

      if (existing) {
        if (!existing.items.find((i) => i.sku === payload.sku)) {
          existing.items.push({
            sku: item.sku,
            name: item.name,
            price: item.rentalPrice,
            image: item.images[0] || null,
          });
        }
      } else {
        sessions.push({
          date: payload.date,
          slot: payload.slot,
          fee,
          isAfterHours,
          items: [
            {
              sku: item.sku,
              name: item.name,
              price: item.rentalPrice,
              image: item.images[0] || null,
            },
          ],
        });
      }

      writeFittingCart(sessions);
      setToast("Added to fitting cart");
    } catch {
      setToast("Could not save to fitting cart");
    }
  };
  const formatRupiah = (n: number) => `Rp. ${n.toLocaleString("id-ID")}`;

  const prefillLabel = fittingPrefill
    ? formatPrefillLine(fittingPrefill.date, fittingPrefill.slot)
    : null;

  return (
    <div className="w-full">
      <div className="max-w-[1512px] mx-auto">
        {/* ── Top: gallery + info ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
          {/* Gallery */}
          <div className="flex gap-3 p-4 sm:p-6">
            {/* Vertical thumbs */}
            {item.images.length > 1 && (
              <div className="hidden md:flex flex-col gap-2 w-[70px] flex-shrink-0 max-h-[720px] overflow-y-auto">
                {item.images.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImg(i)}
                    className={`relative aspect-[3/4] w-full overflow-hidden border transition-all cursor-pointer ${
                      activeImg === i
                        ? "border-store-accent"
                        : "border-transparent hover:border-store-border-strong"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Main */}
            <div className="flex-1 aspect-[3/4] bg-[#E2E0D6] overflow-hidden">
              {item.images[activeImg] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.images[activeImg]}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-store-fg-subtle text-xs uppercase tracking-widest">
                  No image
                </div>
              )}
            </div>
          </div>

          {/* Info panel */}
          <div className="px-6 sm:px-10 lg:pl-4 lg:pr-12 py-8 lg:py-12">
            <h1 className="font-serif text-[24px] sm:text-[28px] leading-snug text-store-fg mb-3">
              {item.sku}-{item.name}
            </h1>
            <p className="text-[15px] text-store-fg-muted mb-6">
              {formatRupiah(item.rentalPrice)}{" "}
              <span className="text-store-fg-subtle">/rental</span>
            </p>

            <div className="flex flex-wrap gap-3 mb-9">
              <button
                type="button"
                onClick={() => setAvailOpen(true)}
                className="px-6 py-3 bg-store-accent text-store-accent-fg text-[11px] tracking-[0.18em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer"
              >
                See Availability
              </button>

              {fittingPrefill ? (
                <button
                  type="button"
                  onClick={() =>
                    addToFittingCart({
                      date: fittingPrefill.date,
                      slot: fittingPrefill.slot,
                      sku: item.sku,
                    })
                  }
                  className="px-6 py-2 border border-store-fg text-[11px] tracking-[0.18em] uppercase font-medium text-store-fg hover:bg-store-hover/50 transition-colors cursor-pointer text-left leading-tight"
                >
                  <span className="block">Book Fitting Session</span>
                  <span className="block text-[9px] tracking-[0.14em] text-store-fg-muted mt-0.5">
                    {prefillLabel}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setFitOpen(true)}
                  className="px-6 py-3 border border-store-fg text-[11px] tracking-[0.18em] uppercase font-medium text-store-fg hover:bg-store-hover/50 transition-colors cursor-pointer"
                >
                  Book Fitting Session
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="border-b border-store-border mb-6">
              <div className="flex gap-8 text-[13px] tracking-[0.02em]">
                {(["description", "size", "tnc", "fitting"] as TabKey[]).map(
                  (k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setActiveTab(k)}
                      className={`pb-3 border-b transition-colors cursor-pointer ${
                        activeTab === k
                          ? "border-store-fg text-store-fg"
                          : "border-transparent text-store-fg-muted hover:text-store-fg"
                      }`}
                    >
                      {k === "description" && "Description"}
                      {k === "size" && "Size"}
                      {k === "tnc" && "TnC"}
                      {k === "fitting" && "Fitting"}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="text-[13.5px] leading-relaxed text-store-fg-muted">
              {activeTab === "description" && (
                <p className="whitespace-pre-line">
                  {item.description ||
                    "No description available for this piece yet."}
                </p>
              )}

              {activeTab === "size" && (
                <div className="space-y-6">
                  <MeasurementBlock
                    label="Outer"
                    data={item.measurements.outer}
                    size={item.size}
                  />
                  <MeasurementBlock
                    label="Inner"
                    data={item.measurements.inner}
                    size={null}
                  />
                  <MeasurementBlock
                    label="Skirt"
                    data={item.measurements.skirt}
                    size={null}
                  />
                  {/* TODO: move to app_settings.website_content */}
                  <p className="pt-2 text-[13px] text-store-fg-muted">
                    Model&apos;s measurements: Height 170 cm.
                  </p>
                </div>
              )}

              {activeTab === "tnc" && (
                <div className="space-y-3.5">
                  {/* TODO: pull from app_settings.website_content */}
                  <ul className="list-disc pl-5 space-y-2 text-[13.5px]">
                    <li>
                      3-day rental window — arrives Day 1, returns by Day 4.
                    </li>
                    <li>
                      Refundable deposit — held per item, returned within 2 × 24
                      hours after your dress passes our quality check.
                    </li>
                    <li>
                      Arrives clean, leave the rest to us — wear it as-is; we
                      handle cleaning after every rental.
                    </li>
                    <li>
                      Late returns are charged per day and deducted from your
                      deposit.
                    </li>
                  </ul>
                  <Link
                    href="/how-to-rent"
                    className="inline-block mt-3 text-[11px] tracking-[0.18em] uppercase text-store-fg-muted underline underline-offset-4 hover:text-store-fg"
                  >
                    See Full Rental Terms
                  </Link>
                </div>
              )}

              {activeTab === "fitting" && (
                <div className="space-y-5 text-[13.5px]">
                  <p>Want to try before you rent? Book in-store fitting.</p>
                  <div>
                    <p className="text-store-fg mb-1">Normal Working Hours</p>
                    <p>— Monday – Friday: 10 AM – 5 PM</p>
                    <p>— Saturday: 10 AM – 1 PM</p>
                  </div>
                  <div>
                    <p className="text-store-fg mb-1">
                      After Working Hours (+100k)
                    </p>
                    <p>— Monday – Friday: 5 PM – 6 PM</p>
                    <p>— Saturday: 1 PM – 3 PM</p>
                  </div>
                  <p className="text-[12.5px] text-store-fg-muted pt-1">
                    *Warning: A fitting lets you try the dress on but it
                    doesn&apos;t reserve it. The dress is only yours once
                    payment is made. If someone books your dates first,
                    it&apos;s theirs.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── You May Also Like ───────────────────────────────────── */}
        {relatedItems.length > 0 && (
          <section className="px-6 sm:px-12 pt-8 pb-20">
            <h2 className="font-serif text-[26px] sm:text-[30px] text-store-fg mb-7">
              You May Also Like
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-10">
              {relatedItems.map((r) => (
                <Link
                  key={r.sku}
                  href={`/shop/${r.sku.toLowerCase()}`}
                  className="group block"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#E2E0D6] mb-3">
                    {r.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.coverImage}
                        alt={r.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    ) : null}
                  </div>
                  <h3 className="font-serif text-[14px] text-store-fg group-hover:text-store-accent transition-colors line-clamp-2">
                    {r.sku}-{r.name}
                  </h3>
                  <p className="text-[12px] text-store-fg-muted mt-1">
                    Rp. {r.rentalPrice.toLocaleString("id-ID")}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <AvailabilityModal
        isOpen={availOpen}
        onClose={() => setAvailOpen(false)}
        sku={item.sku}
        name={item.name}
        rentalPrice={item.rentalPrice}
        accessories={accessories}
        onAdded={(payload) => {
          addToRentalCart(payload);
          setAvailOpen(false);
        }}
      />

      <FittingModal
        isOpen={fitOpen}
        onClose={() => setFitOpen(false)}
        sku={item.sku}
        onAdded={(payload) => {
          addToFittingCart(payload);
          setFitOpen(false);
        }}
      />

      {/* ── Toast ──────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-store-fg text-white text-[12px] tracking-wider px-5 py-3 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function MeasurementBlock({
  label,
  data,
  size,
}: {
  label: string;
  data?: Record<string, string>;
  size: string | null;
}) {
  if (!data || Object.keys(data).length === 0) return null;

  const rows = SIZE_LABELS.filter(
    ([k]) => data[k] !== undefined && data[k] !== "",
  );
  if (rows.length === 0 && !size) return null;

  return (
    <div>
      <p className="text-[11px] tracking-[0.2em] uppercase text-store-fg mb-2.5">
        {label}
      </p>
      <div className="space-y-0.5">
        {rows.map(([k, lbl]) => (
          <p key={k}>
            {lbl}: <span className="text-store-fg">{data[k]} cm</span>
          </p>
        ))}
        {size && (
          <p>
            Size: <span className="text-store-fg">{size}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function formatPrefillLine(dateStr: string, slot: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt
    .toLocaleDateString("en-GB", { weekday: "long" })
    .toUpperCase();
  const dd = String(d).padStart(2, "0");
  const month = dt.toLocaleDateString("en-GB", { month: "long" }).toUpperCase();
  const hh = slot.split(":")[0];
  const nextHH = String(parseInt(hh, 10) + 1).padStart(2, "0");
  return `${weekday}, ${dd} ${month} ${y} ${hh}.00-${nextHH}.00`;
}

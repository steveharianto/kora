"use client";

import { useState, useEffect, useMemo } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { getSkuAvailabilityMap } from "@/app/actions/storefront";

interface Accessory {
  sku: string;
  name: string;
  rentalPrice: number;
  image: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sku: string;
  name: string;
  rentalPrice: number;
  accessories: Accessory[];
  onAdded: (payload: {
    sku: string;
    rentalStart: string;
    rentalEnd: string;
    postalCode: string;
    accessories: string[];
  }) => void;
}

const RENTAL_LEN = 4;

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(s: string, n: number) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export default function AvailabilityModal({
  isOpen,
  onClose,
  sku,
  name,
  rentalPrice,
  accessories,
  onAdded,
}: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [postalCode, setPostalCode] = useState("");
  const [addedAccessories, setAddedAccessories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSelectedStart(null);
      setPostalCode("");
      setAddedAccessories([]);
    }
  }, [isOpen]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Fetch availability for current month
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const map = await getSkuAvailabilityMap(sku, year, month);
      if (!cancelled) {
        setAvailability(map);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, sku, year, month]);

  // Calendar cells (Mon first)
  const cells = useMemo(() => {
    const firstOfMonth = new Date(year, month - 1, 1);
    const firstDow = firstOfMonth.getDay(); // 0=Sun
    const offset = firstDow === 0 ? 6 : firstDow - 1; // Mon=0 index

    const daysInMonth = new Date(year, month, 0).getDate();
    const arr: (string | null)[] = [];
    for (let i = 0; i < offset; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    return arr;
  }, [year, month]);

  const rentalEnd = selectedStart ? addDays(selectedStart, RENTAL_LEN - 1) : null;
  const eventDay = selectedStart ? addDays(selectedStart, 1) : null;

  const dayState = (dateStr: string): "unavailable" | "start" | "event" | "rental" | "neutral" => {
    if (!availability[dateStr]) return "unavailable";
    if (!selectedStart) return "neutral";
    if (dateStr === selectedStart) return "start";
    if (dateStr === eventDay) return "event";
    const inWindow = dateStr > selectedStart && dateStr <= (rentalEnd || "");
    return inWindow ? "rental" : "neutral";
  };

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  // Delivery info
  const delivery = useMemo(() => {
    if (!postalCode || postalCode.length < 5) return null;
    const p2 = parseInt(postalCode.slice(0, 2), 10);
    // TODO: pull from app_settings.shipping.delivery_lead_times
    if (p2 >= 10 && p2 <= 14) {
      return {
        region: "West Jakarta",
        type: "Instant/Sameday",
        arrivesToday: true,
      };
    }
    if (p2 >= 40 && p2 <= 46) {
      return { region: "Jawa Barat", type: "2 days", arrivesToday: false };
    }
    if (p2 >= 50 && p2 <= 54) {
      return { region: "Jawa Tengah", type: "2 days", arrivesToday: false };
    }
    if (p2 >= 60 && p2 <= 69) {
      return { region: "Jawa Timur", type: "2 days", arrivesToday: false };
    }
    return { region: "Indonesia", type: "1–3 days", arrivesToday: false };
  }, [postalCode]);

  if (!isOpen) return null;

  const canAddToCart = Boolean(selectedStart && postalCode.length >= 5);

  const handleAddToCart = () => {
    if (!canAddToCart || !rentalEnd) return;
    onAdded({
      sku,
      rentalStart: selectedStart!,
      rentalEnd,
      postalCode,
      accessories: addedAccessories,
    });
  };

  const toggleAccessory = (sku: string) =>
    setAddedAccessories((a) => (a.includes(sku) ? a.filter((x) => x !== sku) : [...a, sku]));

  const fmtLong = (dateStr: string) =>
    parseISO(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const fmtShort = (dateStr: string) =>
    parseISO(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
        <div className="bg-store-bg w-full max-w-[1080px] my-8 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-6 top-6 text-store-fg-muted hover:text-store-fg cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="font-serif text-[32px] sm:text-[40px] text-store-accent text-center pt-10 pb-6">
            Check Availability
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 px-8 sm:px-12 pb-10">
            {/* ── Calendar ─────────────────────────────────────────── */}
            <div>
              <div className="border border-store-border-strong p-6">
                <div className="flex items-center justify-between mb-5">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="text-store-fg-muted hover:text-store-fg cursor-pointer"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="font-serif text-[19px] text-store-fg">{monthLabel}</span>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="text-store-fg-muted hover:text-store-fg cursor-pointer"
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-7 text-center text-[12px] tracking-widest uppercase text-store-fg-muted mb-2">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                    <div key={i}>{d}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[14px]">
                  {cells.map((dateStr, i) => {
                    if (!dateStr) return <div key={i} />;
                    const state = dayState(dateStr);
                    const dayNum = parseInt(dateStr.slice(8, 10), 10);
                    const clickable = availability[dateStr];
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        disabled={!clickable}
                        onClick={() => clickable && setSelectedStart(dateStr)}
                        className={`aspect-square flex items-center justify-center transition-colors cursor-pointer ${
                          state === "unavailable"
                            ? "text-store-fg-subtle"
                            : state === "start"
                              ? "bg-store-accent text-white"
                              : state === "event"
                                ? "bg-[#C69B32] text-white"
                                : state === "rental"
                                  ? "bg-store-accent text-white"
                                  : clickable
                                    ? "text-store-fg hover:bg-store-hover"
                                    : "text-store-fg-subtle"
                        } ${!clickable ? "cursor-not-allowed" : ""}`}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-4 mt-6 text-[11px] text-store-fg-muted">
                  <LegendSwatch color="#C5C5C5" label="Unavailable Date" />
                  <LegendSwatch color="#C69B32" label="Event Date" />
                  <LegendSwatch color="#64765B" label="Rental Date" />
                </div>
              </div>

              {selectedStart && rentalEnd && (
                <div className="mt-5 p-5 bg-[#F1EFE1] border border-store-border">
                  <DayRow
                    tag="1"
                    tagColor="#64765B"
                    text="Penerima menerima paket baju"
                    date={selectedStart}
                  />
                  <DayRow
                    tag="2"
                    tagColor="#C69B32"
                    text="Hari-H acara"
                    date={addDays(selectedStart, 1)}
                  />
                  <DayRow
                    tag="3"
                    tagColor="#64765B"
                    text="REST & CHILL — kita sarankan penyewa untuk mengembalikan baju di hari ini untuk menghindari keterlambatan"
                    date={addDays(selectedStart, 2)}
                  />
                  <DayRow
                    tag="4"
                    tagColor="#64765B"
                    text="Deadline baju harus sudah dikembalikan — kirimkan resi ke admin sebelum jam 6 sore"
                    date={addDays(selectedStart, 3)}
                    last
                  />
                </div>
              )}
            </div>

            {/* ── Right panel ───────────────────────────────────────── */}
            <div className="space-y-5">
              <div>
                <label className="block text-[13px] text-store-fg mb-2">Rental Date</label>
                <div className="border border-store-border-strong px-4 py-3 text-[13.5px] text-store-fg">
                  {selectedStart && rentalEnd
                    ? `${fmtShort(selectedStart)} - ${fmtShort(rentalEnd)}`
                    : "MM/DD/YYYY - MM/DD/YYYY"}
                </div>
              </div>

              <div>
                <label className="block text-[13px] text-store-fg mb-2">Postal Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full border border-store-border-strong px-4 py-3 text-[13.5px] text-store-fg bg-transparent focus:outline-none focus:border-store-accent"
                />
              </div>

              {selectedStart && rentalEnd && delivery && (
                <div className="p-4 bg-[#F1EFE1] border border-store-border space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border border-store-border-strong px-3 py-2 text-[11.5px] text-store-fg-muted">
                      Rental Date: {parseInt(selectedStart.slice(8, 10), 10)}–{parseInt(rentalEnd.slice(8, 10), 10)}{" "}
                      {new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                    </div>
                    <div className="border border-store-border-strong px-3 py-2 text-[11.5px] text-store-fg-muted">
                      Returning Date: {fmtLong(rentalEnd)}
                    </div>
                  </div>
                  <p className="text-[12px] text-store-fg">
                    Postal Code: <strong>{delivery.region} ({delivery.type})</strong>
                  </p>
                  <p className="text-[12px] text-store-fg-muted">
                    {delivery.arrivesToday
                      ? "Your delivery will arrive today, so you can wear your dress immediately!"
                      : `Your delivery will take approximately ${delivery.type}.`}
                  </p>
                </div>
              )}

              {accessories.length > 0 && (
                <div>
                  <h3 className="font-serif text-[17px] text-store-fg mb-2">Complete Your Look</h3>
                  <p className="text-[12px] text-store-fg-muted mb-4 leading-relaxed">
                    The accessories listed below are confirmed available for the selected date, and the price reflects the same duration as the dress rental.
                  </p>
                  <div className="space-y-3">
                    {accessories.map((a) => {
                      const added = addedAccessories.includes(a.sku);
                      return (
                        <div key={a.sku} className="flex items-center gap-3">
                          <div className="w-12 h-12 flex-shrink-0 bg-[#E2E0D6] overflow-hidden">
                            {a.image && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.image} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-store-fg truncate">
                              {a.sku}-{a.name}
                            </p>
                            <p className="text-[11.5px] text-store-fg-muted">
                              Rp. {a.rentalPrice.toLocaleString("id-ID")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleAccessory(a.sku)}
                            className={`flex-shrink-0 px-4 py-1.5 text-[10px] tracking-[0.18em] uppercase border transition-colors cursor-pointer ${
                              added
                                ? "border-store-accent bg-store-accent text-white"
                                : "border-store-border-strong text-store-fg-muted hover:border-store-fg hover:text-store-fg"
                            }`}
                          >
                            {added ? "Added" : "Add Item"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center pb-12 pt-2">
            <button
              type="button"
              disabled={!canAddToCart}
              onClick={handleAddToCart}
              className={`px-10 py-3 text-[11px] tracking-[0.2em] uppercase font-medium transition-colors cursor-pointer ${
                canAddToCart
                  ? "bg-store-accent text-white hover:bg-store-accent-hover"
                  : "bg-[#C5C5C5] text-white cursor-not-allowed"
              }`}
            >
              Add to Cart
            </button>
          </div>

          {loading && (
            <div className="absolute inset-0 bg-store-bg/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none" />
          )}
        </div>
      </div>
    </>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="w-3.5 h-3.5 inline-block" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function DayRow({
  tag,
  tagColor,
  text,
  date,
  last,
}: {
  tag: string;
  tagColor: string;
  text: string;
  date: string;
  last?: boolean;
}) {
  return (
    <div className={`flex gap-3 py-2.5 ${last ? "" : "border-b border-[#DBD7C6]"}`}>
      <span
        className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-white text-[12px] font-medium"
        style={{ backgroundColor: tagColor }}
      >
        {tag}
      </span>
      <p className="text-[12.5px] text-store-fg leading-snug">{text}</p>
    </div>
  );
}

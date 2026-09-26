"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, MapPin, Truck, Lock, Check } from "lucide-react";
import {
  readRentalCart,
  writeRentalCart,
  rentalLineTotal,
  rentalCartSubtotal,
  type RentalCartItem,
} from "@/lib/storefront/cart";
import {
  getCheckoutShippingRates,
  createWebsiteOrder,
  createXenditInvoiceForOrder,
} from "@/app/actions/checkout";
import type { CustomerSession } from "@/app/actions/customerAuth";

interface Address {
  id: number;
  label: string;
  street_address: string;
  city: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
}

interface LeadTime {
  prefix: string;
  region: string;
  days: number;
}

interface Props {
  customer: CustomerSession;
  addresses: Address[];
  deliveryLeadTimes: LeadTime[];
}

interface RateOption {
  label: string;
  price: number;
  etd: string;
  courierCompany: string;
  courierType: string;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}
function addDays(s: string, n: number) {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().split("T")[0];
}
function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const A = new Date(ay, am - 1, ad).getTime();
  const B = new Date(by, bm - 1, bd).getTime();
  return Math.round((B - A) / 86400000);
}

export default function CheckoutClient({
  customer,
  addresses,
  deliveryLeadTimes,
}: Props) {
  const router = useRouter();

  const [cart, setCart] = useState<RentalCartItem[]>([]);
  const [addressId, setAddressId] = useState<number | "">(
    addresses[0]?.id ?? "",
  );
  const [eventStartDate, setEventStartDate] = useState<string>("");
  const [eventDays, setEventDays] = useState(1);
  const [rates, setRates] = useState<RateOption[]>([]);
  const [selectedRate, setSelectedRate] = useState<RateOption | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [ratesError, setRatesError] = useState("");

  const [storeCreditUsed, setStoreCreditUsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    const c = readRentalCart();
    setCart(c);
    if (c.length === 0) return;

    const starts = c
      .map((i) => i.eventStart)
      .filter((s): s is string => Boolean(s))
      .sort();
    const ends = c
      .map((i) => i.eventEnd)
      .filter((s): s is string => Boolean(s))
      .sort();

    if (starts.length > 0 && ends.length > 0) {
      const lo = starts[0];
      const hi = ends[ends.length - 1];
      setEventStartDate(lo);
      setEventDays(Math.max(1, diffDays(lo, hi) + 1));
    } else {
      const tomorrow = addDays(todayISO(), 1);
      setEventStartDate(tomorrow);
      setEventDays(1);
    }
  }, []);

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === addressId) || null,
    [addresses, addressId],
  );

  const pickupDate = useMemo(
    () => (eventStartDate ? addDays(eventStartDate, -1) : ""),
    [eventStartDate],
  );
  const returnDate = useMemo(() => {
    if (!eventStartDate || eventDays < 1) return "";
    const eventEnd = addDays(eventStartDate, eventDays - 1);
    return addDays(eventEnd, 2);
  }, [eventStartDate, eventDays]);

  const minEventStart = useMemo(() => {
    const p2 = (selectedAddress?.postal_code || "").slice(0, 2);
    let leadDays = 0;
    if (p2) {
      const match = deliveryLeadTimes.find((lt) => {
        if (lt.prefix.includes("-")) {
          const [s, e] = lt.prefix.replace("xxx", "").split("-");
          return p2 >= s && p2 <= e;
        }
        return lt.prefix.startsWith(p2);
      });
      if (match) leadDays = Number(match.days);
      else {
        const other = deliveryLeadTimes.find((l) => l.prefix === "other");
        if (other) leadDays = Number(other.days);
      }
    }
    return addDays(todayISO(), 3 + leadDays + 1);
  }, [selectedAddress, deliveryLeadTimes]);

  // Subtotal = Σ(unit price × event days) per line.
  const subtotal = useMemo(() => rentalCartSubtotal(cart), [cart]);

  // Deposit stays per-unit — it tracks the item's value, not the duration.
  const totalDeposit = useMemo(
    () =>
      cart.reduce(
        (s, i) => s + (i.price > 1000000 ? 250000 : 150000),
        0,
      ),
    [cart],
  );

  const shippingFee = selectedRate?.price || 0;
  const maxCredit = customer.currentCredit;
  const grandTotal = Math.max(
    0,
    subtotal + totalDeposit + shippingFee - storeCreditUsed,
  );

  const fetchRates = useCallback(async () => {
    if (!selectedAddress?.postal_code || cart.length === 0) {
      setRates([]);
      setSelectedRate(null);
      return;
    }
    setLoadingRates(true);
    setRatesError("");

    const res = await getCheckoutShippingRates({
      destinationPostalCode: selectedAddress.postal_code,
      destinationLatitude: selectedAddress.latitude,
      destinationLongitude: selectedAddress.longitude,
      itemSkus: cart.map((c) => c.sku),
    });

    setLoadingRates(false);
    if (res.error || !res.options) {
      setRatesError(res.error || "Could not fetch shipping rates.");
      setRates([]);
      setSelectedRate(null);
      return;
    }
    setRates(res.options);
    setSelectedRate(res.options[0] || null);
  }, [selectedAddress, cart]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const handlePay = async () => {
    if (!selectedAddress || !selectedRate) {
      setCheckoutError("Please select an address and courier.");
      return;
    }
    if (!eventStartDate || !pickupDate || !returnDate) {
      setCheckoutError("Please select your event date.");
      return;
    }

    setSubmitting(true);
    setCheckoutError("");

    // Server-side recomputes totals from items.rental_price × eventDays —
    // see createWebsiteOrder.
    const orderRes = await createWebsiteOrder({
      items: cart.map((c) => ({
        sku: c.sku,
        quantity: 1,
        price: c.price, // per-day unit price; server multiplies by eventDays
        deposit: c.price > 1000000 ? 250000 : 150000,
        eventDays: c.eventDays,
      })),
      eventStartDate,
      eventDays,
      pickupDate,
      returnDate,
      streetAddress: selectedAddress.street_address,
      city: selectedAddress.city,
      postalCode: selectedAddress.postal_code || "",
      latitude: selectedAddress.latitude,
      longitude: selectedAddress.longitude,
      courierLabel: selectedRate.label,
      shippingFee: selectedRate.price,
      storeCreditApplied: storeCreditUsed,
    });

    if (orderRes.error || !orderRes.orderId) {
      setCheckoutError(orderRes.error || "Could not create order.");
      setSubmitting(false);
      return;
    }

    const invoiceRes = await createXenditInvoiceForOrder(orderRes.orderId);
    if (invoiceRes.error || !invoiceRes.invoiceUrl) {
      setCheckoutError(invoiceRes.error || "Could not create payment session.");
      setSubmitting(false);
      return;
    }

    writeRentalCart([]);
    window.location.href = invoiceRes.invoiceUrl;
  };

  if (cart.length === 0) {
    return (
      <div className="w-full bg-store-bg">
        <div className="max-w-[600px] mx-auto px-6 py-24 text-center">
          <h1 className="font-serif text-[32px] sm:text-[40px] text-store-fg mb-4">
            Your cart is empty
          </h1>
          <p className="text-[13px] text-store-fg-muted mb-10">
            Add pieces to your rental cart to begin checkout.
          </p>
          <Link
            href="/shop"
            className="inline-block px-10 py-3.5 bg-store-accent text-white text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors"
          >
            Browse Collection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-store-bg">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-12 py-12">
        <h1 className="font-serif text-[32px] sm:text-[42px] text-store-fg text-center font-normal tracking-[0.01em] mb-12">
          Checkout
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-12">
          {/* LEFT — form */}
          <div className="space-y-10">
            <section>
              <div className="flex items-center gap-2 mb-5">
                <MapPin className="w-4 h-4 text-store-accent" strokeWidth={1.6} />
                <h2 className="font-serif text-[20px] text-store-fg font-normal">
                  Delivery Address
                </h2>
              </div>

              {addresses.length === 0 ? (
                <div className="border border-dashed border-store-border-strong p-6 text-center">
                  <p className="text-[13px] text-store-fg-muted mb-3">
                    You have no saved addresses yet.
                  </p>
                  <Link
                    href="/account"
                    className="text-[11px] tracking-[0.18em] uppercase underline underline-offset-4 hover:text-store-fg"
                  >
                    Add an address
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((a) => (
                    <label
                      key={a.id}
                      className={`block border px-5 py-4 cursor-pointer transition-colors ${
                        a.id === addressId
                          ? "border-store-accent bg-store-hover/30"
                          : "border-store-border-strong hover:border-store-fg"
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        className="sr-only"
                        checked={a.id === addressId}
                        onChange={() => setAddressId(a.id)}
                      />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[13.5px] text-store-fg font-medium">
                              {a.label}
                            </span>
                            {a.is_default && (
                              <span className="text-[9px] tracking-wider uppercase bg-store-accent text-white px-1.5 py-0.5">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-[12.5px] text-store-fg-muted leading-snug">
                            {a.street_address}, {a.city}
                            {a.postal_code ? `, ${a.postal_code}` : ""}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))}
                  <Link
                    href="/account"
                    className="inline-block mt-2 text-[11px] tracking-[0.18em] uppercase text-store-fg-muted underline underline-offset-4 hover:text-store-fg"
                  >
                    + Add another address
                  </Link>
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-5">
                <Lock className="w-4 h-4 text-store-accent" strokeWidth={1.6} />
                <h2 className="font-serif text-[20px] text-store-fg font-normal">
                  Rental Schedule
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-store-fg-muted mb-2">
                    Event Date
                  </label>
                  <input
                    type="date"
                    min={minEventStart}
                    value={eventStartDate}
                    onChange={(e) => setEventStartDate(e.target.value)}
                    className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-store-fg-muted mb-2">
                    Event Days
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={eventDays}
                    onChange={(e) =>
                      setEventDays(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent"
                  />
                </div>
              </div>

              <div className="mt-5 p-4 bg-[#F1EFE1] border border-store-border">
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <p className="text-store-fg-muted">Pickup / Send</p>
                    <p className="text-store-fg font-medium">
                      {pickupDate ? fmtShortDate(pickupDate) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-store-fg-muted">Return Deadline</p>
                    <p className="text-store-fg font-medium">
                      {returnDate ? fmtShortDate(returnDate) : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-5">
                <Truck className="w-4 h-4 text-store-accent" strokeWidth={1.6} />
                <h2 className="font-serif text-[20px] text-store-fg font-normal">
                  Shipping Method
                </h2>
              </div>

              {!selectedAddress?.postal_code ? (
                <p className="text-[12.5px] text-store-fg-muted">
                  Select an address with a postal code to see shipping rates.
                </p>
              ) : loadingRates ? (
                <div className="flex items-center gap-2 text-[12.5px] text-store-fg-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fetching courier rates…
                </div>
              ) : ratesError ? (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-[12px]">
                  {ratesError}
                </div>
              ) : rates.length === 0 ? (
                <p className="text-[12.5px] text-store-fg-muted">
                  No courier options available for this route.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rates.map((r) => {
                    const active = selectedRate?.label === r.label;
                    return (
                      <label
                        key={r.label}
                        className={`flex items-center gap-2.5 border px-3 py-2.5 cursor-pointer transition-colors ${
                          active
                            ? "border-store-accent bg-store-hover/30"
                            : "border-store-border-strong hover:border-store-fg"
                        }`}
                      >
                        <input
                          type="radio"
                          name="rate"
                          className="sr-only"
                          checked={active}
                          onChange={() => setSelectedRate(r)}
                        />
                        <span
                          className={`w-4 h-4 flex-shrink-0 border flex items-center justify-center transition-colors ${
                            active
                              ? "bg-store-accent border-store-accent"
                              : "border-store-border-strong bg-transparent"
                          }`}
                        >
                          {active && (
                            <Check
                              className="w-3 h-3 text-white"
                              strokeWidth={3}
                            />
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[12.5px] text-store-fg font-medium leading-snug truncate">
                            {r.label}
                          </span>
                          {r.etd && (
                            <span className="block text-[10.5px] text-store-fg-muted leading-snug">
                              Est. {r.etd}
                            </span>
                          )}
                        </span>
                        <span className="text-[12px] text-store-fg font-semibold whitespace-nowrap">
                          Rp {r.price.toLocaleString("id-ID")}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>

            {maxCredit > 0 && (
              <section>
                <h2 className="font-serif text-[20px] text-store-fg font-normal mb-4">
                  Store Credit
                </h2>
                <div className="flex items-center gap-3 max-w-[320px]">
                  <span className="text-[12.5px] text-store-fg-muted">
                    Available: Rp {maxCredit.toLocaleString("id-ID")}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={maxCredit}
                  value={storeCreditUsed}
                  onChange={(e) => {
                    const v = Math.max(
                      0,
                      Math.min(maxCredit, parseInt(e.target.value) || 0),
                    );
                    setStoreCreditUsed(v);
                  }}
                  className="w-full max-w-[240px] mt-2 text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent font-mono"
                />
              </section>
            )}
          </div>

          {/* RIGHT — summary */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="border border-store-border p-6">
              <h2 className="font-serif text-[22px] text-store-fg mb-5 font-normal">
                Order Summary
              </h2>

              <div className="space-y-4 pb-5 border-b border-store-border">
                {cart.map((c, i) => {
                  const lineTotal = rentalLineTotal(c);
                  const days = c.eventDays || 1;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="w-14 aspect-[3/4] flex-shrink-0 bg-[#E2E0D6] overflow-hidden">
                        {c.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.image}
                            alt={c.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] text-store-fg leading-snug">
                          {c.sku}-{c.name}
                        </p>
                        {days > 1 && (
                          <p className="text-[11.5px] text-store-fg-muted mt-0.5">
                            Rp {c.price.toLocaleString("id-ID")} × {days} days
                          </p>
                        )}
                        <p className="text-[12px] text-store-fg font-medium mt-0.5">
                          Rp {lineTotal.toLocaleString("id-ID")}
                        </p>
                        {c.eventStart && c.eventEnd && (
                          <p className="text-[11px] text-store-fg-subtle mt-0.5">
                            {fmtShortDate(c.eventStart)}
                            {c.eventStart !== c.eventEnd
                              ? ` – ${fmtShortDate(c.eventEnd)}`
                              : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="py-5 space-y-2.5 text-[13px]">
                <Row
                  label="Subtotal"
                  value={`Rp ${subtotal.toLocaleString("id-ID")}`}
                />
                <Row
                  label="Refundable Deposit"
                  value={`Rp ${totalDeposit.toLocaleString("id-ID")}`}
                />
                <Row
                  label="Shipping"
                  value={
                    selectedRate
                      ? `Rp ${selectedRate.price.toLocaleString("id-ID")}`
                      : "—"
                  }
                />
                {storeCreditUsed > 0 && (
                  <Row
                    label="Store Credit"
                    value={`− Rp ${storeCreditUsed.toLocaleString("id-ID")}`}
                  />
                )}
              </div>

              <div className="pt-5 border-t border-store-border flex items-baseline justify-between mb-6">
                <span className="font-serif text-[18px] text-store-fg">
                  Total
                </span>
                <span className="text-[20px] text-store-fg font-semibold">
                  Rp {grandTotal.toLocaleString("id-ID")}
                </span>
              </div>

              {checkoutError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-[12px]">
                  {checkoutError}
                </div>
              )}

              <button
                type="button"
                onClick={handlePay}
                disabled={
                  submitting ||
                  cart.length === 0 ||
                  !selectedAddress ||
                  !selectedRate
                }
                className="w-full py-4 bg-store-accent text-white text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? "Preparing payment…" : "Pay with Xendit"}
              </button>

              <p className="text-[11px] text-store-fg-muted text-center mt-4 leading-relaxed">
                You&apos;ll be redirected to Xendit to complete your payment
                securely. Your order will be confirmed once payment is
                received.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-store-fg-muted">{label}</span>
      <span className="text-store-fg font-medium">{value}</span>
    </div>
  );
}

function fmtShortDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

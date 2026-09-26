"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  dispatchReturnViaBiteship,
  saveReturnResi,
  markReturnReceived,
  startReturnQc,
  releaseDepositAndCompleteReturn,
  addReturnNote,
  getReturnShippingRates,
  type ReturnRateOption,
} from "@/app/actions/returns";
import { formatRupiah } from "@/lib/utils";
import {
  Copy,
  Check,
  ExternalLink,
  Truck,
  Lock,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Calendar,
} from "lucide-react";
import RupiahInput from "@/components/RupiahInput";
import NotificationPicker from "@/components/admin/NotificationPicker";

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

type BookingStep = "closed" | "preview" | "booking" | "success" | "error";

export default function ReturnDetailForm({
  initialReturn,
  shippingSettings,
  rentalRules,
  notificationTemplates,
  auditLogs,
}: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedSlip, setCopiedSlip] = useState(false);
  const [noteText, setNoteText] = useState("");

  const order = initialReturn.orders || {};
  const customer = initialReturn.customers || {};
  const customerName =
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Customer";

  const [resi, setResi] = useState(initialReturn.waybill_id || "");

  // QC State
  const [hasStains, setHasStains] = useState(initialReturn.has_stains || false);
  const [hasDamage, setHasDamage] = useState(initialReturn.has_damage || false);
  const [isIncomplete, setIsIncomplete] = useState(initialReturn.is_incomplete || false);
  const [hasOdor, setHasOdor] = useState(initialReturn.has_odor || false);

  const orderProducts: any[] = order.order_products || [];

  const [perItemQc, setPerItemQc] = useState<Array<{
    sku: string; stains: boolean; damage: boolean; odor: boolean; missing: boolean;
  }>>(
    orderProducts.map((p: any) => ({
      sku: p.item_sku,
      stains: false,
      damage: false,
      odor: false,
      missing: false,
    })),
  );

  const [qcDeduction, setQcDeduction] = useState(Number(initialReturn.qc_deduction) || 0);
  const [returnShippingCost, setReturnShippingCost] = useState(Number(initialReturn.return_shipping_cost) || 0);
  const [deductionReason, setDeductionReason] = useState(initialReturn.deduction_reason || "");
  const [refundDestination, setRefundDestination] = useState(
    initialReturn.refund_destination ||
      "Primary — Bank transfer · 1021009982 (BCA a.n Dea Kirana)",
  );

  const depositHeld =
    Number(initialReturn.deposit_held) || Number(order.total_deposit) || 150000;

  const status = initialReturn.status as string;
  const isShipping = status === "Shipping";
  const isReceived = status === "Received";
  const isInReview = status === "In Review";
  const isCompleted = status === "Completed";
  const qcUnlocked = isInReview || isCompleted;

  // Aging
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = order.return_date ? new Date(order.return_date) : null;
  if (deadlineDate) deadlineDate.setHours(0, 0, 0, 0);

  const lateDays = useMemo(() => {
    if (!deadlineDate) return 0;
    const refDate = initialReturn.received_at ? new Date(initialReturn.received_at) : today;
    refDate.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((refDate.getTime() - deadlineDate.getTime()) / 86400000));
  }, [deadlineDate, initialReturn.received_at, today]);

  const agingBadge = useMemo(() => {
    if (lateDays > 0) return { text: `${lateDays} D LATE`, color: "bad" };
    if (lateDays === 0 && deadlineDate && deadlineDate.getTime() === today.getTime()) {
      return { text: "DUE TODAY", color: "amber" };
    }
    return null;
  }, [lateDays, deadlineDate, today]);

  const lateFeeDailyRate =
    Number(rentalRules?.late_fee_per_day) || (depositHeld > 200000 ? 200000 : 140000);
  const referenceLateFeeTotal = lateDays * lateFeeDailyRate;

  const calculatedRefund = useMemo(
    () => Math.max(0, depositHeld - qcDeduction - returnShippingCost),
    [depositHeld, qcDeduction, returnShippingCost],
  );

  const showroom = shippingSettings?.dispatch_addresses?.primary || {
    name: "St. Moritz Ambassador Suites Tower, Unit 3808",
    street_address: "Jl. Kembangan Kerep No. 10G, Jakarta Barat",
    postal_code: "11610",
  };

  const manifestText = useMemo(() => {
    return (
      `PICKUP   : ${initialReturn.pickup_street_address}, ${initialReturn.pickup_city}\n` +
      `CONTACT  : ${initialReturn.pickup_phone} (${customerName})\n` +
      `DROP-OFF : ${showroom.name}, ${showroom.street_address} ${showroom.postal_code || ""}\n` +
      `ITEM     : ${orderProducts[0]?.item_sku || "Garment"} — 1 pc · garment · ~1 kg\n` +
      `REF      : return leg of order ${order.id}`
    );
  }, [initialReturn, customerName, showroom, order, orderProducts]);

  /* ── Booking modal state ────────────────────────────────────────── */

  const [bookingStep, setBookingStep] = useState<BookingStep>("closed");
  const [rates, setRates] = useState<ReturnRateOption[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [ratesError, setRatesError] = useState("");
  const [selectedRate, setSelectedRate] = useState<ReturnRateOption | null>(null);
  const [bookingNote, setBookingNote] = useState(
    `KORA Return ${order.id || ""} - Studio Receiving`,
  );
  const [bookingResult, setBookingResult] = useState<{
    waybill: string;
    trackingUrl: string | null;
    courierLabel: string;
    price: number | null;
  } | null>(null);
  const [bookingError, setBookingError] = useState("");
  const [canRetryAsInstant, setCanRetryAsInstant] = useState(false);
  const [copiedWaybill, setCopiedWaybill] = useState(false);

  const handleCopySlip = () => {
    navigator.clipboard.writeText(manifestText);
    setCopiedSlip(true);
    setTimeout(() => setCopiedSlip(false), 2000);
  };

  const handleOpenBookingModal = async () => {
    setBookingStep("preview");
    setBookingError("");
    setBookingResult(null);
    setSelectedRate(null);
    setRates([]);
    setRatesError("");
    setCanRetryAsInstant(false);
    setLoadingRates(true);

    const res = await getReturnShippingRates(initialReturn.id);

    setLoadingRates(false);

    if (res.error || !res.options) {
      setRatesError(res.error || "Could not fetch courier rates.");
      return;
    }
    setRates(res.options);
    setSelectedRate(res.options[0] || null);
  };

  const handleCloseBookingModal = () => {
    if (bookingStep === "booking") return;
    setBookingStep("closed");
  };

  const handleConfirmBooking = async (forceInstant = false) => {
    if (!selectedRate) return;
    setBookingStep("booking");
    setBookingError("");
    setCanRetryAsInstant(false);

    const res = await dispatchReturnViaBiteship(
      initialReturn.id,
      {
        company: selectedRate.courierCompany,
        type: selectedRate.courierType,
      },
      { forceInstant },
    );

    if ("error" in res && res.error) {
      setBookingError(res.error);
      setCanRetryAsInstant(Boolean(res.retryAsInstant));
      setBookingStep("error");
      return;
    }

    if ("success" in res && res.success) {
      setBookingResult({
        waybill: res.waybill,
        trackingUrl: res.trackingUrl,
        courierLabel: selectedRate.label,
        price: res.price,
      });
      setBookingStep("success");
      router.refresh();
    }
  };

  const handleCopyWaybill = () => {
    if (!bookingResult?.waybill) return;
    navigator.clipboard.writeText(bookingResult.waybill);
    setCopiedWaybill(true);
    setTimeout(() => setCopiedWaybill(false), 2000);
  };

  /* ── Other handlers ─────────────────────────────────────────────── */

  const handleSaveResi = async () => {
    if (!resi.trim()) return;
    setLoading(true);
    setErrorMsg("");
    const res = await saveReturnResi(
      initialReturn.id,
      initialReturn.courier_company || "paxel - regular",
      resi,
    );
    if (res.error) setErrorMsg(res.error);
    else router.refresh();
    setLoading(false);
  };

  const handleMarkReceived = async () => {
    setLoading(true);
    setErrorMsg("");
    const res = await markReturnReceived(initialReturn.id);
    if (res.error) setErrorMsg(res.error);
    else router.refresh();
    setLoading(false);
  };

  const handleStartQc = async () => {
    setLoading(true);
    setErrorMsg("");
    const res = await startReturnQc(initialReturn.id);
    if (res.error) setErrorMsg(res.error);
    else router.refresh();
    setLoading(false);
  };

  const handleReleaseDeposit = async () => {
    if (!confirm(`Release deposit of ${formatRupiah(calculatedRefund)} to ${refundDestination}?`)) return;
    setLoading(true);
    setErrorMsg("");
    const res = await releaseDepositAndCompleteReturn(initialReturn.id, {
      has_stains: hasStains,
      has_damage: hasDamage,
      is_incomplete: isIncomplete,
      has_odor: hasOdor,
      qc_deduction: qcDeduction,
      return_shipping_cost: returnShippingCost,
      refund_destination: refundDestination,
      deduction_reason: deductionReason,
      per_item_qc: perItemQc,
    });
    if (res.error) setErrorMsg(res.error);
    else router.refresh();
    setLoading(false);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    await addReturnNote(initialReturn.id, noteText);
    setNoteText("");
    router.refresh();
  };

  const canBookCourier =
    !qcUnlocked &&
    status === "Requested" &&
    initialReturn.return_method.includes("Biteship");

  return (
    <div>
      <Link href="/admin/returns" className="text-[12.5px] text-muted hover:text-wine-ink inline-block mb-2">
        ← Back to Returns
      </Link>
      <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">Operations · Returns</div>

      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink">
            Return — {order.id}
          </h1>
          <p className="text-xs text-muted mt-0.5">
            {customerName} · {orderProducts[0]?.item_sku || "—"} · deposit held {formatRupiah(depositHeld)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {agingBadge && (
            <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${
              agingBadge.color === "bad"
                ? "bg-[#FBEBE8] text-[#A63222] border-[#E8C0B9]"
                : "bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]"
            }`}>
              {agingBadge.text}
            </span>
          )}

          <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded border ${
            isCompleted || isReceived
              ? "bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]"
              : isInReview
                ? "bg-[#F4EDF7] text-[#6B3A8C] border-[#D9C2E8]"
                : isShipping
                  ? "bg-[#EEF4FB] text-[#2B6CB0] border-[#C3D9F2]"
                  : "bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]"
          }`}>
            {status}
          </span>

          <NotificationPicker
            entity="return"
            entityId={initialReturn.id}
            onSent={() => router.refresh()}
          />
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-bad-bg border border-bad/30 text-bad text-xs rounded-lg">{errorMsg}</div>
      )}

      <div className={`mb-5 p-3.5 rounded-xl border text-[12.5px] ${
        initialReturn.waybill_id
          ? "bg-[#F2F6EF] border-[#CAD3C5] text-wine-ink"
          : "bg-warn-bg border-warn/30 text-warn-ink"
      }`}>
        {initialReturn.waybill_id ? (
          <div><strong>All required fields complete.</strong> Nothing on this return is holding it in Work queue.</div>
        ) : (
          <div><strong>Incomplete — 1 required field still empty.</strong> Stays in Work queue until every field marked * is filled: <span className="underline">Return resi</span>.</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* LEFT: Order information */}
        <div className="bg-card border border-line rounded-[10px] p-5 space-y-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <h3 className="font-serif text-[18px] font-normal mb-1">
            Order information <span className="text-[11.5px] text-muted font-sans">— from the anchor order, read-only</span>
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">Order ID</label>
              <input disabled value={order.id} className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink font-bold" />
            </div>
            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">Customer</label>
              <input disabled value={customerName} className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink font-medium" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">Phone</label>
              <input disabled value={customer.phone || ""} className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted font-mono" />
            </div>
            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">City</label>
              <input disabled value={order.city || "—"} className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">Order Date</label>
              <input disabled value={formatDate(order.order_date)} className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted" />
            </div>
            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">Event Date</label>
              <input disabled value={formatDate(order.event_start_date)} className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">Pick Up/Send Date</label>
              <input disabled value={formatDate(order.pickup_date)} className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted" />
            </div>
            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">Return Deadline</label>
              <input disabled value={formatDate(order.return_date)} className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink font-bold" />
            </div>
          </div>

          <div className="pt-2 border-t border-line">
            <table className="w-full text-left text-xs border-collapse font-tabular-nums">
              <thead>
                <tr className="text-[10px] uppercase text-muted tracking-wider border-b border-line pb-1">
                  <th className="py-1">SKU</th>
                  <th className="py-1">Product</th>
                  <th className="py-1 text-center">Qty</th>
                  <th className="py-1 text-right">Price</th>
                  <th className="py-1 text-right">Deposit</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orderProducts.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-[#EFEBE2] last:border-none">
                    <td className="py-2 font-mono font-bold">{p.item_sku}</td>
                    <td className="py-2">{p.items?.name || "Garment"}</td>
                    <td className="py-2 text-center">{p.quantity}</td>
                    <td className="py-2 text-right">{formatRupiah(Number(p.price))}</td>
                    <td className="py-2 text-right">{formatRupiah(Number(p.deposit))}</td>
                    <td className="py-2 text-right font-medium">{formatRupiah(Number(p.subtotal || p.price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Return request + shipment */}
        <div className="space-y-4">
          <div className="bg-card border border-line rounded-[10px] p-5 space-y-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <h3 className="font-serif text-[18px] font-normal mb-1">Return request</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">Requested On</label>
                <input disabled value={formatDate(initialReturn.requested_at)} className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted" />
              </div>
              <div>
                <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">Return Method</label>
                <input disabled value={initialReturn.return_method} className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink font-medium" />
              </div>
            </div>

            {initialReturn.return_method.includes("Biteship") && (
              <div>
                <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  Customer&apos;s Pickup Date
                </label>
                <input
                  disabled
                  value={
                    initialReturn.pickup_date
                      ? formatDate(initialReturn.pickup_date)
                      : "Not specified"
                  }
                  className={`w-full text-[13px] border rounded-lg px-3 py-2 font-medium ${
                    initialReturn.pickup_date
                      ? "border-[#CAD3C5] bg-[#F2F6EF] text-wine-ink"
                      : "border-line bg-[#F6F4EF] text-muted"
                  }`}
                />
                <p className="text-[10.5px] text-muted mt-1">
                  Chosen by the customer at request time. Biteship will be
                  booked as{" "}
                  {initialReturn.pickup_date
                    ? "scheduled"
                    : "immediate (now)"}{" "}
                  for this return.
                </p>
              </div>
            )}

            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">
                Pickup Address <span className="text-muted font-normal lowercase">— can differ from the order's delivery address</span>
              </label>
              <input
                disabled
                value={`${initialReturn.pickup_label || "Home"} — ${initialReturn.pickup_street_address}, ${initialReturn.pickup_city} (${initialReturn.pickup_postal_code || ""})`}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink"
              />
            </div>
          </div>

          <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3.5">
            <h3 className="font-serif text-[18px] font-normal mb-1">Return shipment</h3>

            <div className="p-3 bg-[#F6F4EF] rounded-lg border border-[#E5E0D6] font-mono text-[11px] text-ink whitespace-pre-wrap leading-relaxed">
              {manifestText}
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={handleCopySlip}
                className="px-3 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] flex items-center gap-1.5">
                {copiedSlip ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSlip ? "Copied!" : "Copy slip"}
              </button>
              <a href="https://dashboard.biteship.com" target="_blank" rel="noreferrer"
                className="px-3 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] flex items-center gap-1">
                Open Biteship
                <ExternalLink className="w-3 h-3 text-muted" />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">Courier</label>
                <input
                  disabled
                  value={initialReturn.courier_company || "— not booked —"}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink font-medium"
                />
              </div>
              <div>
                <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">
                  Return Resi (Paste After Booking) <span className="text-bad">*</span>
                </label>
                <input disabled={qcUnlocked} value={resi} onChange={(e) => setResi(e.target.value)}
                  placeholder="e.g. PX-99231 or WYB-..."
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] font-mono" />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-2.5">
              {canBookCourier && (
                <button
                  type="button"
                  onClick={handleOpenBookingModal}
                  disabled={loading}
                  className="px-4 py-2 bg-[#1A1F16] text-white rounded-lg text-xs font-semibold hover:bg-black transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Book Biteship Return
                </button>
              )}
              {isReceived || status === "Requested" ? (
                <button type="button" onClick={handleSaveResi} disabled={loading || !resi.trim()}
                  className="px-4 py-2 bg-[#1A1F16] text-white rounded-lg text-xs font-semibold hover:bg-black transition disabled:opacity-40">
                  Save resi — mark Shipping
                </button>
              ) : null}
              {isShipping && (
                <button type="button" onClick={handleMarkReceived} disabled={loading}
                  className="px-4 py-2 border border-line bg-card rounded-lg text-xs font-semibold hover:bg-[#F6F4EF] transition">
                  Mark received
                </button>
              )}
              {isReceived && (
                <button type="button" onClick={handleStartQc} disabled={loading}
                  className="px-4 py-2 bg-[#6B3A8C] text-white rounded-lg text-xs font-semibold hover:bg-[#5a2f77] transition">
                  Start QC review
                </button>
              )}
            </div>

            <p className="text-[11px] text-muted">
              {isCompleted ? "Shipment complete and deposit released."
                : isInReview ? "QC in progress — release deposit below when ready."
                : isReceived ? "Package received — press Start QC review to unlock inspection."
                : "Shipment in motion — press Mark received when the package arrives."}
            </p>
          </div>
        </div>
      </div>

      {/* QUALITY CHECK & DEPOSIT RELEASE */}
      <div className="bg-card border border-line rounded-[10px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] mb-4 space-y-4">
        <h3 className="font-serif text-[20px] font-normal">Quality check & deposit release</h3>

        {!qcUnlocked ? (
          <div className="p-4 bg-[#FBF8EF] border border-[#E8DFC2] rounded-xl text-xs text-[#84661E] flex items-center gap-2">
            <Lock className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>Locked.</strong> Finish the return shipment first — QC unlocks after pressing <strong>Start QC review</strong>.
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {orderProducts.length > 0 && (
              <div className="border border-line rounded-lg overflow-hidden">
                <div className="bg-[#F6F4EF] px-3 py-2 text-[10px] uppercase tracking-wider text-muted font-bold grid grid-cols-6 gap-2">
                  <div className="col-span-2">Item</div>
                  <div className="text-center">Stains</div>
                  <div className="text-center">Damage</div>
                  <div className="text-center">Odor</div>
                  <div className="text-center">Missing</div>
                </div>
                {perItemQc.map((row, i) => (
                  <div key={row.sku} className="px-3 py-2 grid grid-cols-6 gap-2 items-center border-t border-[#EFEBE2] text-xs">
                    <div className="col-span-2 font-mono font-bold text-ink">{row.sku}</div>
                    {(["stains", "damage", "odor", "missing"] as const).map((field) => (
                      <div key={field} className="flex justify-center">
                        <input
                          type="checkbox"
                          disabled={isCompleted}
                          checked={row[field]}
                          onChange={(e) => {
                            const next = [...perItemQc];
                            next[i] = { ...next[i], [field]: e.target.checked };
                            setPerItemQc(next);
                          }}
                          className="rounded text-wine focus:ring-wine"
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-5 text-xs text-ink pt-1">
              {[
                { label: "Stains", value: hasStains, set: setHasStains },
                { label: "Damage / tears", value: hasDamage, set: setHasDamage },
                { label: "Completeness", value: isIncomplete, set: setIsIncomplete },
                { label: "Odor / perfume", value: hasOdor, set: setHasOdor },
              ].map(({ label, value, set }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" disabled={isCompleted} checked={value}
                    onChange={(e) => set(e.target.checked)} className="rounded text-wine focus:ring-wine" />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">Deposit Held (RP)</label>
                <input disabled value={depositHeld} className="w-full text-xs border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink font-bold" />
              </div>
              <div>
                <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">QC Deduction (RP)</label>
                <RupiahInput value={qcDeduction} onChange={setQcDeduction} disabled={isCompleted} className="text-xs rounded-lg" />
                {lateDays > 0 && (
                  <div className="text-[10px] text-[#A63222] font-medium mt-1 leading-tight">
                    {lateDays} day(s) late — reference late fee {formatRupiah(lateFeeDailyRate)}/day × {lateDays} = {formatRupiah(referenceLateFeeTotal)}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">Return Shipping Cost (RP)</label>
                <RupiahInput value={returnShippingCost} onChange={setReturnShippingCost} disabled={isCompleted} className="text-xs rounded-lg" />
              </div>
              <div>
                <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">Refund Amount (RP)</label>
                <input disabled value={calculatedRefund} className="w-full text-xs border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-wine-ink font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">
                  Refund To <span className="text-bad">*</span>
                </label>
                <select disabled={isCompleted} value={refundDestination} onChange={(e) => setRefundDestination(e.target.value)}
                  className="w-full text-xs border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]">
                  <option value={`Primary — Bank transfer · 1021009982 (BCA a.n ${customerName})`}>
                    Primary — Bank transfer · 1021009982 (BCA a.n {customerName})
                  </option>
                  <option value={`Mandiri · 1420019284729 (a.n ${customerName})`}>
                    Mandiri · 1420019284729 (a.n {customerName})
                  </option>
                  <option value="Manual Cash / Other Bank">Manual Cash / Other Bank</option>
                </select>
              </div>
              <div>
                <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">
                  Deduction Reason <span className="text-bad">*</span>
                </label>
                <input disabled={isCompleted} placeholder="e.g., light stain on hem, 2 days late"
                  value={deductionReason} onChange={(e) => setDeductionReason(e.target.value)}
                  className="w-full text-xs border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]" />
              </div>
            </div>

            {!isCompleted ? (
              <div className="pt-2">
                <button type="button" onClick={handleReleaseDeposit} disabled={loading}
                  className="px-5 py-2.5 bg-[#1A1F16] text-white rounded-lg text-xs font-semibold hover:bg-black transition shadow-sm cursor-pointer">
                  {loading ? "Processing..." : "Release deposit"}
                </button>
              </div>
            ) : (
              <div className="p-3 bg-[#EAF3E7] border border-[#CAD3C5] rounded-lg text-xs text-[#2E7D47] font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Deposit released and order finalized on {formatDate(initialReturn.refunded_at)}.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-line rounded-[10px] p-5 flex flex-col">
          <h3 className="font-serif text-[18px] font-normal mb-1">
            Log Note <span className="text-[12px] text-muted font-sans">— internal team only</span>
          </h3>
          <form onSubmit={handleAddNote} className="mt-2 flex-1 flex flex-col">
            <textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)}
              placeholder="Note for the team..."
              className="w-full text-xs border border-line rounded-lg p-2.5 bg-[#FDFCFA] focus:ring-1 focus:ring-wine focus:outline-none" />
            <div className="flex justify-end mt-2">
              <button type="submit" className="px-3.5 py-1 bg-card border border-line text-xs rounded-lg hover:bg-[#F6F4EF] cursor-pointer">Post</button>
            </div>
          </form>
        </div>

        <div className="bg-card border border-line rounded-[10px] p-5 h-56 overflow-y-auto">
          <h3 className="font-serif text-[18px] font-normal mb-3">Activity log</h3>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-muted">No activity logged for this return yet.</p>
          ) : (
            <ul className="space-y-2.5 text-xs">
              {auditLogs.map((log: any) => (
                <li key={log.id} className="border-b border-line pb-1.5 last:border-none">
                  <span className="font-semibold">{log.admin_name}</span>: {log.action_type}{" "}
                  {log.new_value && <span className="text-wine-ink font-medium">({log.new_value})</span>}
                  <span className="text-muted ml-1">· {formatDate(log.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* BOOKING MODAL — same flow as the orders page */}
      {bookingStep !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseBookingModal();
          }}
        >
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl border border-line max-h-[90vh] overflow-y-auto">
            {bookingStep === "preview" && (
              <>
                <div className="flex justify-between items-center p-5 border-b border-line">
                  <div>
                    <h3 className="font-serif text-[20px]">
                      Confirm Return Courier
                    </h3>
                    <p className="text-[12px] text-muted mt-0.5">
                      Courier picks up from the customer and delivers to the showroom.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseBookingModal}
                    className="text-muted hover:text-ink p-1 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-5 space-y-4 text-xs">
                  {/* From: customer */}
                  <div>
                    <div className="text-[10px] tracking-wider uppercase text-muted font-bold mb-1">
                      Pickup From
                    </div>
                    <div className="text-[13px] font-medium text-ink">
                      {customerName}
                    </div>
                    <div className="text-muted mt-0.5">
                      {initialReturn.pickup_street_address}, {initialReturn.pickup_city}{" "}
                      {initialReturn.pickup_postal_code || ""}
                    </div>
                    <div className="text-muted font-mono mt-0.5">
                      {initialReturn.pickup_phone}
                    </div>
                  </div>

                  {/* To: showroom */}
                  <div>
                    <div className="text-[10px] tracking-wider uppercase text-muted font-bold mb-1">
                      Deliver To
                    </div>
                    <div className="text-[13px] font-medium text-ink">
                      {showroom.name || "KORA Showroom"}
                    </div>
                    <div className="text-muted mt-0.5">
                      {showroom.street_address}, {showroom.city}{" "}
                      {showroom.postal_code}
                    </div>
                  </div>

                  {/* Pickup date (read-only) */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <div className="text-[10px] tracking-wider uppercase text-muted font-bold mb-1">
                        Customer Pickup Date
                      </div>
                      <div className="text-[13px] font-medium text-ink">
                        {initialReturn.pickup_date
                          ? formatDate(initialReturn.pickup_date)
                          : "Immediate"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] tracking-wider uppercase text-muted font-bold mb-1">
                        Return Method
                      </div>
                      <div className="text-[13px] font-medium text-ink">
                        {initialReturn.return_method.includes("Biteship")
                          ? "KORA pickup"
                          : "Self-return"}
                      </div>
                    </div>
                  </div>

                  {/* Courier rates */}
                  <div className="pt-1">
                    <div className="text-[10px] tracking-wider uppercase text-muted font-bold mb-1.5">
                      Courier
                    </div>
                    {loadingRates ? (
                      <div className="flex items-center gap-2 text-[12px] text-muted py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Fetching courier rates…
                      </div>
                    ) : ratesError ? (
                      <div className="p-3 bg-bad-bg border border-[#D9A79C] text-bad rounded-lg text-[11.5px] leading-relaxed">
                        {ratesError}
                      </div>
                    ) : rates.length === 0 ? (
                      <p className="text-[12px] text-muted py-2">
                        No courier options available for this route.
                      </p>
                    ) : (
                      <div className="border border-line rounded-lg divide-y divide-line max-h-56 overflow-y-auto">
                        {rates.map((r) => {
                          const active = selectedRate?.label === r.label;
                          return (
                            <label
                              key={r.label}
                              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition ${
                                active ? "bg-[#F6F4EF]" : "hover:bg-[#FBFAF6]"
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
                                className={`w-4 h-4 flex-shrink-0 border flex items-center justify-center transition ${
                                  active
                                    ? "bg-wine border-wine"
                                    : "border-line bg-white"
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
                                <span className="block text-[12.5px] font-medium text-ink leading-snug truncate">
                                  {r.label}
                                </span>
                                {r.etd && (
                                  <span className="block text-[10.5px] text-muted leading-snug">
                                    Est. {r.etd}
                                  </span>
                                )}
                              </span>
                              <span className="text-[12px] font-semibold text-wine-ink whitespace-nowrap">
                                {formatRupiah(r.price)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div className="pt-1">
                    <div className="text-[10px] tracking-wider uppercase text-muted font-bold mb-1.5">
                      Items ({orderProducts.length})
                    </div>
                    <div className="border border-line rounded-lg divide-y divide-line">
                      {orderProducts.map((p, i) => (
                        <div
                          key={i}
                          className="px-3 py-2 flex justify-between text-[12px]"
                        >
                          <span className="font-mono font-bold text-ink">
                            {p.item_sku}
                          </span>
                          <span className="text-muted truncate ml-3 flex-1">
                            {p.items?.name || "Garment"}
                          </span>
                          <span className="text-muted font-mono ml-3">
                            ×{p.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Note */}
                  <div className="pt-1">
                    <label className="block text-[10px] tracking-wider uppercase text-muted font-bold mb-1">
                      Note to Courier
                    </label>
                    <textarea
                      rows={2}
                      value={bookingNote}
                      onChange={(e) => setBookingNote(e.target.value)}
                      className="w-full text-xs border border-line rounded-lg p-2.5 bg-[#FDFCFA] focus:ring-1 focus:ring-wine focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 p-5 border-t border-line bg-[#FDFCFA] rounded-b-xl">
                  <button
                    type="button"
                    onClick={handleCloseBookingModal}
                    className="px-4 py-2 border border-line rounded-lg text-xs font-medium hover:bg-white transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmBooking(false)}
                    disabled={!selectedRate || loadingRates || Boolean(ratesError)}
                    className="px-4 py-2 bg-wine text-white rounded-lg text-xs font-semibold hover:bg-[#181E15] transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Confirm Booking
                  </button>
                </div>
              </>
            )}

            {bookingStep === "booking" && (
              <div className="p-8 text-center space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#EBEFE6] mx-auto">
                  <Truck className="w-6 h-6 text-wine animate-pulse" />
                </div>
                <h3 className="font-serif text-[20px]">Booking courier…</h3>
                <p className="text-xs text-muted">
                  Contacting Biteship. Do not close this window.
                </p>
              </div>
            )}

            {bookingStep === "success" && bookingResult && (
              <>
                <div className="p-5 border-b border-line">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-[#EAF3E7] flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-[#2E7D47]" />
                    </div>
                    <div>
                      <h3 className="font-serif text-[20px]">
                        Return booked successfully
                      </h3>
                      <p className="text-[12px] text-muted mt-0.5">
                        {bookingResult.courierLabel}
                        {bookingResult.price
                          ? ` · ${formatRupiah(bookingResult.price)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-4 text-xs">
                  <div>
                    <div className="text-[10px] tracking-wider uppercase text-muted font-bold mb-1">
                      Waybill / Resi
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[15px] font-bold text-ink flex-1 truncate">
                        {bookingResult.waybill}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyWaybill}
                        className="flex-shrink-0 p-2 border border-line bg-white rounded-md hover:bg-[#F6F4EF] transition cursor-pointer"
                        title="Copy waybill"
                      >
                        {copiedWaybill ? (
                          <Check className="w-4 h-4 text-ok" />
                        ) : (
                          <Copy className="w-4 h-4 text-muted" />
                        )}
                      </button>
                    </div>
                  </div>
                  {bookingResult.trackingUrl && (
                    <a
                      href={bookingResult.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-line bg-white rounded-lg text-xs font-medium hover:bg-[#F6F4EF] transition w-full"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Track Package
                    </a>
                  )}
                </div>
                <div className="flex justify-end p-5 border-t border-line bg-[#FDFCFA] rounded-b-xl">
                  <button
                    type="button"
                    onClick={handleCloseBookingModal}
                    className="px-4 py-2 bg-wine text-white rounded-lg text-xs font-semibold hover:bg-[#181E15] transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </>
            )}

            {bookingStep === "error" && (
              <>
                <div className="p-5 border-b border-line">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-bad-bg flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 text-bad" />
                    </div>
                    <div>
                      <h3 className="font-serif text-[20px]">Booking failed</h3>
                      <p className="text-[12px] text-muted mt-0.5">
                        The return courier could not be booked automatically.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3 text-xs">
                  <div className="p-3 bg-bad-bg border border-[#D9A79C] text-bad rounded-lg text-[12px] leading-relaxed">
                    {bookingError}
                  </div>
                  <p className="text-muted text-[11.5px] leading-relaxed">
                    You can retry with the same courier, try a different
                    courier, or book manually from the Biteship dashboard and
                    paste the resi below.
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2 p-5 border-t border-line bg-[#FDFCFA] rounded-b-xl">
                  <button
                    type="button"
                    onClick={handleCloseBookingModal}
                    className="px-4 py-2 border border-line rounded-lg text-xs font-medium hover:bg-white transition cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingStep("preview")}
                    className="px-4 py-2 border border-line bg-white rounded-lg text-xs font-medium hover:bg-[#F6F4EF] transition cursor-pointer"
                  >
                    Pick Different Courier
                  </button>
                  {canRetryAsInstant && (
                    <button
                      type="button"
                      onClick={() => handleConfirmBooking(true)}
                      className="px-4 py-2 border border-wine bg-wine-soft text-wine-ink rounded-lg text-xs font-semibold hover:bg-wine hover:text-white transition cursor-pointer"
                      title="Re-book with delivery_type: now — the courier will pick up today"
                    >
                      Try as Instant
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleConfirmBooking(false)}
                    className="px-4 py-2 bg-wine text-white rounded-lg text-xs font-semibold hover:bg-[#181E15] transition cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

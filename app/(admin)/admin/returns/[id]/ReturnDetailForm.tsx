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
  remindReturnCustomer,
} from "@/app/actions/returns";
import { formatRupiah } from "@/lib/utils";
import {
  Copy, Check, ExternalLink, MessageCircle, Truck, Lock, AlertTriangle, Send,
} from "lucide-react";
import RupiahInput from "@/components/RupiahInput";

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

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

  const [courier, setCourier] = useState(initialReturn.courier_company || "paxel - regular");
  const [resi, setResi] = useState(initialReturn.waybill_id || "");

  // QC State
  const [hasStains, setHasStains] = useState(initialReturn.has_stains || false);
  const [hasDamage, setHasDamage] = useState(initialReturn.has_damage || false);
  const [isIncomplete, setIsIncomplete] = useState(initialReturn.is_incomplete || false);
  const [hasOdor, setHasOdor] = useState(initialReturn.has_odor || false);

  const orderProducts: any[] = order.order_products || [];

  // Per-item QC state — initialized from order line items
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

  const whatsAppUrl = useMemo(() => {
    if (!customer.phone) return "";
    const rawPhone = String(customer.phone).replace(/\D/g, "");
    const phone = rawPhone.startsWith("0") ? `62${rawPhone.slice(1)}` : rawPhone;
    const msg = `Hi ${customerName}, here are your return instructions for order ${order.id}. Please pack the garment securely with original hangers and garment bag.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }, [customer.phone, customerName, order.id]);

  const handleCopySlip = () => {
    navigator.clipboard.writeText(manifestText);
    setCopiedSlip(true);
    setTimeout(() => setCopiedSlip(false), 2000);
  };

  const handleBookBiteship = async () => {
    if (!confirm("Book reverse courier via Biteship now?")) return;
    setLoading(true);
    setErrorMsg("");
    const res = await dispatchReturnViaBiteship(initialReturn.id, courier);
    if (res.error) setErrorMsg(res.error);
    else router.refresh();
    setLoading(false);
  };

  const handleSaveResi = async () => {
    if (!resi.trim()) return;
    setLoading(true);
    setErrorMsg("");
    const res = await saveReturnResi(initialReturn.id, courier, resi);
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

  const handleRemind = async () => {
    setLoading(true);
    setErrorMsg("");
    const res = await remindReturnCustomer(initialReturn.id);
    if (res?.error) setErrorMsg(res.error);
    else if (res?.waUrl) window.open(res.waUrl, "_blank");
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

          {!isCompleted && customer.phone && (
            <button
              type="button"
              onClick={handleRemind}
              disabled={loading}
              className="px-3.5 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-wine-ink" />
              Remind customer
            </button>
          )}

          {whatsAppUrl && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
              WhatsApp customer
            </a>
          )}
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
                <select disabled={qcUnlocked} value={courier} onChange={(e) => setCourier(e.target.value)}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]">
                  <option value="paxel - regular">Paxel — Regular</option>
                  <option value="jne - reg">JNE — REG</option>
                  <option value="gosend - instant">GoSend — Instant</option>
                  <option value="sicepat - reg">SiCepat — REG</option>
                </select>
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
              {!qcUnlocked && initialReturn.return_method.includes("Biteship") && (
                <button type="button" onClick={handleBookBiteship} disabled={loading}
                  className="px-4 py-2 bg-[#1A1F16] text-white rounded-lg text-xs font-semibold hover:bg-black transition flex items-center gap-1.5 shadow-sm">
                  <Truck className="w-3.5 h-3.5" />
                  {loading ? "Booking..." : "Book Biteship Return"}
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
            {/* Per-item QC */}
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

            {/* Aggregate QC flags */}
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
    </div>
  );
}

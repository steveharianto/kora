'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  updateFittingStatus,
  recordAfterHoursFeePayment,
  markFittingReminderSent,
  convertFittingToOrder,
  addFittingNote,
  markFittingRefunded,
} from '@/app/actions/fittings';
import { formatRupiah } from '@/lib/utils';
import { MessageCircle, AlertTriangle, BadgeDollarSign, Send } from 'lucide-react';

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  if (!year || !month || !day) return '—';
  return `${day}/${month}/${year}`;
}

const COURIER_OPTIONS = [
  'Self pickup',
  'JNE - REG',
  'JNE - YES',
  'SiCepat - REG',
  'Gosend - Instant',
  'Paxel - Medium',
];

export default function FittingDetailForm({
  initialFitting,
  allItems,
  notificationTemplates,
  auditLogs,
}: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [noteText, setNoteText] = useState('');
  const [feeMethod, setFeeMethod] = useState(
    initialFitting.fee_payment_method || 'Cash',
  );
  const [convertMethod, setConvertMethod] = useState('Self pickup');

  // Reminder send state (automated via Fonnte)
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderFlash, setReminderFlash] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const customerName =
    `${initialFitting.customers?.first_name || ''} ${initialFitting.customers?.last_name || ''}`.trim() ||
    'Customer';
  const customerCity = initialFitting.customers?.addresses?.[0]?.city || 'Surabaya';
  const customerPhone = initialFitting.customers?.phone || '';

  const fittingItems: any[] = initialFitting.fitting_items || [];
  const dress1 = fittingItems.find((fi) => fi.slot_number === 1);
  const dress2 = fittingItems.find((fi) => fi.slot_number === 2);
  const dress3 = fittingItems.find((fi) => fi.slot_number === 3);

  // Manual fallback: pre-filled wa.me link so the admin can open the customer's
  // WhatsApp thread and send the reminder by hand (e.g. to attach a photo, or
  // if Fonnte delivery fails). Does NOT touch reminder_sent_at — that's owned
  // by the automated send below.
  const whatsAppUrl = useMemo(() => {
    if (!customerPhone) return '';
    const rawPhone = String(customerPhone).replace(/\D/g, '');
    const phone = rawPhone.startsWith('0') ? `62${rawPhone.slice(1)}` : rawPhone;
    const defaultTpl =
      'Hi [CUSTOMER_NAME], just a reminder about your fitting session on [FITTING_DATE] at [FITTING_TIME]. See you soon!';
    const rawTpl =
      notificationTemplates?.fitting_reminder?.template || defaultTpl;
    const timeFormatted = initialFitting.slot
      ? String(initialFitting.slot).slice(0, 5)
      : '10:00';
    const message = rawTpl
      .replace(/\[CUSTOMER_NAME\]/g, customerName)
      .replace(/\[FITTING_DATE\]/g, formatDate(initialFitting.date))
      .replace(/\[FITTING_TIME\]/g, timeFormatted);
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }, [
    customerPhone,
    customerName,
    initialFitting.date,
    initialFitting.slot,
    notificationTemplates,
  ]);

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    const res = await updateFittingStatus(initialFitting.id, newStatus);
    if (res?.error) setErrorMsg(res.error);
    else router.refresh();
    setLoading(false);
  };

  const handleRecordFee = async () => {
    setLoading(true);
    const res = await recordAfterHoursFeePayment(initialFitting.id, feeMethod);
    if (res?.error) setErrorMsg(res.error);
    else router.refresh();
    setLoading(false);
  };

  // Automated reminder via Fonnte
  const handleSendReminder = async () => {
    if (!customerPhone) {
      setReminderFlash({
        type: 'err',
        text: 'Customer has no phone number on file.',
      });
      return;
    }

    setReminderBusy(true);
    setReminderFlash(null);

    const res = await markFittingReminderSent(initialFitting.id);

    setReminderBusy(false);

    if (res?.error || res?.sent === false) {
      setReminderFlash({
        type: 'err',
        text: res?.error || 'Could not send the WhatsApp reminder.',
      });
      return;
    }

    setReminderFlash({ type: 'ok', text: 'Reminder sent via WhatsApp.' });
    router.refresh();
  };

  const handleConvertToOrder = async () => {
    if (
      !confirm(
        `Convert to a new Manual Order draft with "${convertMethod}" as the fulfilment method?`,
      )
    )
      return;
    setConverting(true);
    const res = await convertFittingToOrder(initialFitting.id, {
      pick_up_method: convertMethod,
    });
    if (res?.error) {
      setErrorMsg(res.error);
      setConverting(false);
    } else if (res?.orderId) {
      router.push(`/admin/orders/${res.orderId}`);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    await addFittingNote(initialFitting.id, noteText);
    setNoteText('');
    router.refresh();
  };

  return (
    <div>
      <Link
        href="/admin/fittings"
        className="text-[12.5px] text-muted hover:text-wine-ink inline-block mb-2"
      >
        ← Back to Fittings
      </Link>
      <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">
        Operations · Fittings
      </div>

      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink">
            {initialFitting.id}
          </h1>
          <p className="text-xs text-muted mt-0.5">
            {customerName} · {formatDate(initialFitting.date)}{' '}
            {initialFitting.slot ? String(initialFitting.slot).slice(0, 5) : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded border mr-1 ${
              initialFitting.status === 'Confirmed'
                ? 'bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5]'
                : initialFitting.status === 'Pending'
                  ? 'bg-[#FDF3DE] text-[#977028] border-[#F1DFB7]'
                  : initialFitting.status === 'Conflict Evicted'
                    ? 'bg-[#F8EED9] text-[#A65B20] border-[#E8DFC2]'
                    : 'bg-[#EFEBE2] text-muted border-transparent'
            }`}
          >
            {initialFitting.status}
          </span>

          {initialFitting.status === 'Pending' && (
            <button
              type="button"
              onClick={() => handleStatusChange('Confirmed')}
              disabled={loading}
              className="px-3.5 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] cursor-pointer"
            >
              Confirm
            </button>
          )}
          {initialFitting.status !== 'Completed' && (
            <button
              type="button"
              onClick={() => handleStatusChange('Completed')}
              disabled={loading}
              className="px-3.5 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] cursor-pointer"
            >
              Mark done
            </button>
          )}
          {initialFitting.status !== 'Cancelled' && (
            <button
              type="button"
              onClick={() => handleStatusChange('Cancelled')}
              disabled={loading}
              className="px-3.5 py-1.5 border border-line text-bad rounded-lg text-xs font-medium hover:bg-bad-bg cursor-pointer"
            >
              Cancel session
            </button>
          )}

          {/* Automated send via Fonnte */}
          <button
            type="button"
            onClick={handleSendReminder}
            disabled={reminderBusy || !customerPhone}
            title={
              !customerPhone
                ? 'Customer has no phone number'
                : 'Send WhatsApp reminder via Fonnte'
            }
            className="px-3.5 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5 text-wine-ink" />
            {reminderBusy ? 'Sending…' : 'Send WA reminder'}
          </button>

          {/* Quick manual open — wa.me deep link, pre-filled from template */}
          {whatsAppUrl && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noreferrer"
              title="Open WhatsApp thread and send manually"
              className="px-3.5 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
              Open WhatsApp
            </a>
          )}
        </div>
      </div>

      {reminderFlash && (
        <div
          className={`mb-3 p-2.5 text-xs rounded-lg border ${
            reminderFlash.type === 'ok'
              ? 'bg-ok-bg border-[#CAD3C5] text-ok'
              : 'bg-bad-bg border-[#D9A79C] text-bad'
          }`}
        >
          {reminderFlash.text}
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-bad-bg border border-bad/30 text-bad text-xs rounded-lg">
          {errorMsg}
        </div>
      )}

      {initialFitting.status === 'Conflict Evicted' && (
        <div className="mb-4 p-4 rounded-xl border border-[#E8DFC2] bg-[#FBF8EF] text-xs text-[#84661E] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Session Cancelled by Inventory Eviction:</strong>{' '}
            {initialFitting.conflict_notes}
          </span>
        </div>
      )}
      <RefundBanner fitting={initialFitting} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-card border border-line rounded-[10px] p-5 space-y-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <h3 className="font-serif text-[18px] font-normal mb-1">
            Customer & schedule
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">
                Booking ID
              </label>
              <input
                disabled
                value={initialFitting.id}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted font-bold"
              />
            </div>
            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">
                Customer *
              </label>
              <input
                disabled
                value={customerName}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink font-medium"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">
                Phone
              </label>
              <input
                disabled
                value={customerPhone}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted font-mono"
              />
            </div>
            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">
                City
              </label>
              <input
                disabled
                value={customerCity}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">
                Date *
              </label>
              <input
                type="date"
                disabled
                value={initialFitting.date}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink"
              />
            </div>
            <div>
              <label className="block text-[10.5px] tracking-[0.14em] uppercase text-muted mb-1">
                Time Slot *
              </label>
              <input
                disabled
                value={
                  initialFitting.slot
                    ? String(initialFitting.slot).slice(0, 5)
                    : '—'
                }
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink font-bold"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted pt-1">
            Date and slot changes re-lock the calendar and notify the customer
            via WA.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
            <h3 className="font-serif text-[18px] font-normal mb-1">
              Dresses — up to 3 *
            </h3>
            {[dress1, dress2, dress3].map((d, index) => (
              <div key={index}>
                <div className="flex justify-between items-center mb-0.5">
                  <label className="block text-[10px] tracking-[0.14em] uppercase text-muted">
                    Dress {index + 1}
                  </label>
                  {d?.is_evicted && (
                    <span className="text-[9px] font-bold tracking-wider uppercase bg-bad-bg text-bad px-1.5 py-0.5 rounded border border-[#D9A79C]">
                      Evicted by {d.evicted_by_order_id || 'Order'}
                    </span>
                  )}
                </div>
                <input
                  disabled
                  value={
                    d
                      ? `${d.item_sku} — ${d.items?.name || 'Garment'} (${d.items?.size || 'S'})`
                      : '—'
                  }
                  className={`w-full text-[13px] border border-line rounded-lg px-3 py-2 ${
                    d?.is_evicted
                      ? 'bg-bad-bg/40 text-bad font-medium line-through'
                      : 'bg-[#F6F4EF] text-ink'
                  }`}
                />
              </div>
            ))}
            <p className="text-[11px] text-muted pt-1">
              Fitting does not reserve the dress — availability is only locked
              by a paid order.
            </p>
          </div>

          <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <h3 className="font-serif text-[18px] font-normal mb-3">
              After-hours fee
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] tracking-[0.14em] uppercase text-muted mb-1">
                  Fee
                </label>
                <input
                  disabled
                  value={
                    initialFitting.is_after_hours
                      ? formatRupiah(Number(initialFitting.after_hours_fee))
                      : '— (regular hours)'
                  }
                  className="w-full text-xs border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.14em] uppercase text-muted mb-1">
                  Payment Status
                </label>
                <input
                  disabled
                  value={initialFitting.fee_payment_status || 'n/a'}
                  className={`w-full text-xs border border-line rounded-lg px-3 py-2 ${
                    initialFitting.fee_payment_status === 'Paid'
                      ? 'bg-[#EAF3E7] text-[#2E7D47] font-bold'
                      : initialFitting.fee_payment_status === 'Unpaid'
                        ? 'bg-[#FDF3DE] text-[#977028] font-bold'
                        : 'bg-[#F6F4EF] text-muted'
                  }`}
                />
              </div>
            </div>
            {initialFitting.is_after_hours &&
              initialFitting.fee_payment_status !== 'Paid' && (
                <div className="pt-2 border-t border-line flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] tracking-[0.14em] uppercase text-muted mb-1">
                      Method
                    </label>
                    <select
                      value={feeMethod}
                      onChange={(e) => setFeeMethod(e.target.value)}
                      className="w-full text-xs border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA]"
                    >
                      <option value="Cash">Cash</option>
                      <option value="QRIS (EDC)">QRIS (EDC)</option>
                      <option value="Bank Transfer - BCA">
                        Bank Transfer - BCA
                      </option>
                    </select>
                  </div>
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={handleRecordFee}
                      disabled={loading}
                      className="px-4 py-2 bg-[#1A1F16] text-white rounded-lg text-xs font-semibold hover:bg-black transition cursor-pointer"
                    >
                      Record payment
                    </button>
                  </div>
                </div>
              )}
            <p className="text-[11px] text-muted mt-3">
              Recorded fees post to the transactions ledger and appear in
              Reports as fitting revenue — separate from rental sales.
            </p>
          </div>
        </div>
      </div>

      {/* Team notes + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-16">
        <div className="bg-card border border-line rounded-[10px] p-5 flex flex-col">
          <h3 className="font-serif text-[18px] font-normal mb-1">
            Log Note{' '}
            <span className="text-[12px] text-muted font-sans">
              — internal team only
            </span>
          </h3>
          <form onSubmit={handleAddNote} className="mt-2 flex-1 flex flex-col">
            <textarea
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Note for the team..."
              className="w-full text-xs border border-line rounded-lg p-2.5 bg-[#FDFCFA] focus:ring-1 focus:ring-wine focus:outline-none"
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                className="px-3.5 py-1 bg-card border border-line text-xs rounded-lg hover:bg-[#F6F4EF] cursor-pointer"
              >
                Post
              </button>
            </div>
          </form>
        </div>
        <div className="bg-card border border-line rounded-[10px] p-5 h-56 overflow-y-auto">
          <h3 className="font-serif text-[18px] font-normal mb-3">
            Activity log
          </h3>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-muted">
              No activity logged for this session yet.
            </p>
          ) : (
            <ul className="space-y-2.5 text-xs">
              {auditLogs.map((log: any) => (
                <li
                  key={log.id}
                  className="border-b border-line pb-1.5 last:border-none"
                >
                  <span className="font-semibold">{log.admin_name}</span>:{' '}
                  {log.action_type}{' '}
                  {log.new_value && (
                    <span className="text-wine-ink font-medium">
                      ({log.new_value})
                    </span>
                  )}
                  <span className="text-muted ml-1">
                    · {formatDate(log.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* FLOATING CONVERT PILL — courier select */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-[#1A1F16] text-white rounded-full pl-3 pr-2 py-1.5 shadow-xl flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-wider text-white/70 font-medium">
            Fulfilment
          </label>
          <select
            value={convertMethod}
            onChange={(e) => setConvertMethod(e.target.value)}
            className="bg-transparent text-white text-xs font-semibold border-none focus:outline-none cursor-pointer pr-1"
          >
            {COURIER_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="text-ink bg-white">
                {opt}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleConvertToOrder}
            disabled={converting || initialFitting.status === 'Cancelled'}
            className="bg-white text-[#1A1F16] px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-[#ECEBE4] transition flex items-center gap-2 disabled:opacity-40 cursor-pointer"
          >
            {converting ? 'Creating Order Draft...' : 'Post the order first'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RefundBanner({ fitting }: { fitting: any }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (fitting.refund_status !== 'Pending') return null;

  const amount = Number(fitting.refund_amount) || 0;

  const handleMark = async () => {
    if (
      !confirm(
        `Mark Rp ${amount.toLocaleString('id-ID')} as refunded? Confirm you've already processed this in Xendit.`,
      )
    )
      return;
    setLoading(true);
    setError('');
    const res = await markFittingRefunded(fitting.id, amount);
    setLoading(false);
    if (res.error) setError(res.error);
    else window.location.reload();
  };

  return (
    <div className="mb-5 p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900">
      <div className="flex items-start gap-3">
        <BadgeDollarSign
          className="w-5 h-5 flex-shrink-0 mt-0.5"
          strokeWidth={1.8}
        />
        <div className="flex-1">
          <p className="font-semibold text-[13px]">
            Refund owed to customer: Rp {amount.toLocaleString('id-ID')}
          </p>
          <p className="text-[12px] mt-1 leading-relaxed">
            This fitting was paid and has been{' '}
            {fitting.status === 'Conflict Evicted'
              ? 'evicted by a paid rental'
              : 'cancelled'}
            . Process the refund manually in the Xendit dashboard, then mark it
            here.
          </p>
          {error && <p className="text-[11.5px] text-red-700 mt-2">{error}</p>}
        </div>
        <button
          type="button"
          onClick={handleMark}
          disabled={loading}
          className="flex-shrink-0 px-4 py-2 bg-amber-700 text-white text-[11px] font-semibold rounded-lg hover:bg-amber-800 transition cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Mark Refunded'}
        </button>
      </div>
    </div>
  );
}

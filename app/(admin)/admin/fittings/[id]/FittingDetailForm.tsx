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
} from '@/app/actions/fittings';
import { formatRupiah } from '@/lib/utils';
import { MessageCircle, AlertTriangle } from 'lucide-react';

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  if (!year || !month || !day) return '—';
  return `${day}/${month}/${year}`;
}

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
  const [feeMethod, setFeeMethod] = useState(initialFitting.fee_payment_method || 'Cash');

  const customerName = `${initialFitting.customers?.first_name || ''} ${initialFitting.customers?.last_name || ''}`.trim() || 'Customer';
  const customerCity = initialFitting.customers?.addresses?.[0]?.city || 'Surabaya';
  const customerPhone = initialFitting.customers?.phone || '';

  const fittingItems: any[] = initialFitting.fitting_items || [];
  const dress1 = fittingItems.find((fi) => fi.slot_number === 1);
  const dress2 = fittingItems.find((fi) => fi.slot_number === 2);
  const dress3 = fittingItems.find((fi) => fi.slot_number === 3);

  // WhatsApp reminder generator
  const whatsAppUrl = useMemo(() => {
    if (!customerPhone) return '';
    const rawPhone = String(customerPhone).replace(/\D/g, '');
    const phone = rawPhone.startsWith('0') ? `62${rawPhone.slice(1)}` : rawPhone;

    const defaultTpl = 'Hi [CUSTOMER_NAME], just a reminder about your fitting session on [FITTING_DATE] at [FITTING_TIME]. See you soon!';
    const rawTpl = notificationTemplates?.fitting_reminder?.template || defaultTpl;

    const timeFormatted = initialFitting.slot ? initialFitting.slot.slice(0, 5) : '10:00';
    const message = rawTpl
      .replace(/\[CUSTOMER_NAME\]/g, customerName)
      .replace(/\[FITTING_DATE\]/g, formatDate(initialFitting.date))
      .replace(/\[FITTING_TIME\]/g, timeFormatted);

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }, [customerPhone, customerName, initialFitting.date, initialFitting.slot, notificationTemplates]);

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

  const handleConvertToOrder = async () => {
    if (!confirm('Convert this fitting session to a new Manual Order draft?')) return;
    setConverting(true);
    const res = await convertFittingToOrder(initialFitting.id);
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
      <Link href="/admin/fittings" className="text-[12.5px] text-muted hover:text-wine-ink inline-block mb-2">
        ← Back to Fittings
      </Link>

      <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">
        Operations · Fittings
      </div>

      {/* Header & Ribbon */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink">
            {initialFitting.id}
          </h1>
          <p className="text-xs text-muted mt-0.5">
            {customerName} · {formatDate(initialFitting.date)} {initialFitting.slot ? initialFitting.slot.slice(0, 5) : ''}
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

          {whatsAppUrl && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => markFittingReminderSent(initialFitting.id)}
              className="px-3.5 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
              WhatsApp customer
            </a>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-bad-bg border border-bad/30 text-bad text-xs rounded-lg">
          {errorMsg}
        </div>
      )}

      {/* Conflict Eviction Banner */}
      {initialFitting.status === 'Conflict Evicted' && (
        <div className="mb-4 p-4 rounded-xl border border-[#E8DFC2] bg-[#FBF8EF] text-xs text-[#84661E] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Session Cancelled by Inventory Eviction:</strong> {initialFitting.conflict_notes}
          </span>
        </div>
      )}

      {/* 2-Column Main View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* LEFT COLUMN: Customer & Schedule */}
        <div className="bg-card border border-line rounded-[10px] p-5 space-y-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <h3 className="font-serif text-[18px] font-normal mb-1">Customer & schedule</h3>

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
                value={initialFitting.slot ? initialFitting.slot.slice(0, 5) : '—'}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink font-bold"
              />
            </div>
          </div>

          <p className="text-[11px] text-muted pt-1">
            Date and slot changes re-lock the calendar and notify the customer via WA.
          </p>
        </div>

        {/* RIGHT COLUMN: Dresses & After-Hours Fee */}
        <div className="space-y-4">
          <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
            <h3 className="font-serif text-[18px] font-normal mb-1">Dresses — up to 3 *</h3>

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
                    d?.is_evicted ? 'bg-bad-bg/40 text-bad font-medium line-through' : 'bg-[#F6F4EF] text-ink'
                  }`}
                />
              </div>
            ))}

            <p className="text-[11px] text-muted pt-1">
              Fitting does not reserve the dress — availability is only locked by a paid order.
            </p>
          </div>

          {/* After-Hours Fee Module */}
          <div className="bg-card border border-line rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <h3 className="font-serif text-[18px] font-normal mb-3">After-hours fee</h3>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] tracking-[0.14em] uppercase text-muted mb-1">Fee</label>
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

            {initialFitting.is_after_hours && initialFitting.fee_payment_status !== 'Paid' && (
              <div className="pt-2 border-t border-line flex items-center justify-between gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] tracking-[0.14em] uppercase text-muted mb-1">Method</label>
                  <select
                    value={feeMethod}
                    onChange={(e) => setFeeMethod(e.target.value)}
                    className="w-full text-xs border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA]"
                  >
                    <option value="Cash">Cash</option>
                    <option value="QRIS (EDC)">QRIS (EDC)</option>
                    <option value="Bank Transfer - BCA">Bank Transfer - BCA</option>
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
              Recorded fees post to the transactions ledger and appear in Reports as fitting revenue — separate from rental sales.
            </p>
          </div>
        </div>
      </div>

      {/* Team Notes & Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-16">
        <div className="bg-card border border-line rounded-[10px] p-5 flex flex-col">
          <h3 className="font-serif text-[18px] font-normal mb-1">
            Log Note <span className="text-[12px] text-muted font-sans">— internal team only</span>
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
          <h3 className="font-serif text-[18px] font-normal mb-3">Activity log</h3>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-muted">No activity logged for this session yet.</p>
          ) : (
            <ul className="space-y-2.5 text-xs">
              {auditLogs.map((log: any) => (
                <li key={log.id} className="border-b border-line pb-1.5 last:border-none">
                  <span className="font-semibold">{log.admin_name}</span>: {log.action_type}{' '}
                  {log.new_value && <span className="text-wine-ink font-medium">({log.new_value})</span>}
                  <span className="text-muted ml-1">· {formatDate(log.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Floating Action Pill */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <button
          type="button"
          onClick={handleConvertToOrder}
          disabled={converting || initialFitting.status === 'Cancelled'}
          className="bg-[#1A1F16] text-white px-6 py-2.5 rounded-full text-xs font-semibold shadow-xl hover:bg-black transition flex items-center gap-2 disabled:opacity-40 cursor-pointer"
        >
          {converting ? 'Creating Order Draft...' : 'Post the order first'}
        </button>
      </div>
    </div>
  );
}

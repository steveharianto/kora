'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getAvailableSlotsForDate,
  getDressesAvailabilityForDate,
  createFittingSession,
} from '@/app/actions/fittings';
import { createClient } from '@/lib/supabase/client';

export default function CreateFittingSessionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Initial lookup lists
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Form State
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [date, setDate] = useState(tomorrowStr);
  const [slot, setSlot] = useState('10:00');
  const [dress1, setDress1] = useState('');
  const [dress2, setDress2] = useState('');
  const [dress3, setDress3] = useState('');

  // Dynamic slot & dress availability states
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [isDayClosed, setIsDayClosed] = useState(false);
  const [closedReason, setClosedReason] = useState('');
  const [dressOptions, setDressOptions] = useState<any[]>([]);

  // 1. Fetch Customers on Mount
  useEffect(() => {
    const fetchCustomers = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('customers')
        .select('id, first_name, last_name, phone, status')
        .order('first_name');
      setCustomers(data || []);
    };
    fetchCustomers();
  }, []);

  // 2. Fetch Slots & Dress Availability whenever date changes
  useEffect(() => {
    if (!date) return;

    const loadSlotsAndDresses = async () => {
      const [slotRes, dressRes] = await Promise.all([
        getAvailableSlotsForDate(date),
        getDressesAvailabilityForDate(date),
      ]);

      if (slotRes.isClosed) {
        setIsDayClosed(true);
        setClosedReason(slotRes.reason || 'Showroom is closed on this day.');
        setAvailableSlots([]);
      } else {
        setIsDayClosed(false);
        setClosedReason('');
        setAvailableSlots(slotRes.slots || []);

        // Default to first open slot if current selection is booked
        const openSlots = (slotRes.slots || []).filter((s) => !s.isBooked);
        if (openSlots.length > 0 && !openSlots.some((s) => s.slot === slot)) {
          setSlot(openSlots[0].slot);
        }
      }

      setDressOptions(dressRes || []);
    };

    loadSlotsAndDresses();
  }, [date]);

  const activeCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const selectedDresses = useMemo(() => {
    return [dress1, dress2, dress3].filter(Boolean);
  }, [dress1, dress2, dress3]);

  // Validation
  const missingFields = useMemo(() => {
    const list: string[] = [];
    if (!selectedCustomerId) list.push('Customer account');
    if (selectedDresses.length === 0) list.push('At least one dress');
    if (!slot || isDayClosed) list.push('Valid time slot');
    return list;
  }, [selectedCustomerId, selectedDresses, slot, isDayClosed]);

  const isComplete = missingFields.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isComplete) return;

    setLoading(true);
    setErrorMsg('');

    const res = await createFittingSession({
      customer_id: selectedCustomerId,
      date,
      slot,
      dresses: selectedDresses,
    });

    if (res.error) {
      setErrorMsg(res.error);
      setLoading(false);
    } else {
      router.push(`/admin/fittings/${res.fittingId}`);
    }
  };

  return (
    <div className="pb-24 font-sans text-ink">
      <Link
        href="/admin/fittings"
        className="text-[12.5px] text-muted hover:text-wine-ink inline-block mb-2"
      >
        ← Back to Fittings
      </Link>

      <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">
        Operations · Fittings
      </div>

      <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink mb-1">
        Create Fitting Session
      </h1>
      <p className="text-[13px] text-muted mb-5">
        Customer account is the anchor — no account, no fitting. Up to three dresses per session.
      </p>

      {/* Incomplete / Validation Ribbon */}
      {!isComplete && (
        <div className="mb-6 p-4 rounded-xl border border-bad/30 bg-bad-bg/60 text-[13px] text-ink flex items-center justify-between flex-wrap gap-3">
          <div>
            <strong>Incomplete — {missingFields.length} required fields still empty.</strong> This fitting session stays in Schedule until every field marked * is filled.
          </div>
          <div className="flex gap-2">
            {missingFields.map((field) => (
              <span
                key={field}
                className="bg-white border border-[#D9A79C] text-bad font-medium text-xs px-2.5 py-1 rounded-full"
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-bad-bg border border-bad/30 text-bad text-xs rounded-lg">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* LEFT CARD: CUSTOMER & SCHEDULE */}
          <div className="bg-card border border-line rounded-[10px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
            <h3 className="font-serif text-[20px] font-normal mb-1">Customer</h3>

            <div>
              <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                Customer Account <span className="text-bad">*</span>
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-1 focus:ring-wine focus:outline-none"
              >
                <option value="">Search customer name...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name || ''} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                Phone
              </label>
              <input
                disabled
                value={activeCustomer?.phone || ''}
                placeholder="Auto-fills from account"
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Date <span className="text-bad">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                />
              </div>

              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Time Slot <span className="text-bad">*</span>
                </label>
                {isDayClosed ? (
                  <input
                    disabled
                    value="Closed on Sundays"
                    className="w-full text-xs border border-bad/30 bg-bad-bg text-bad rounded-lg px-3 py-2"
                  />
                ) : (
                  <select
                    value={slot}
                    onChange={(e) => setSlot(e.target.value)}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                  >
                    {availableSlots.map((s) => (
                      <option
                        key={s.slot}
                        value={s.slot}
                        disabled={s.isBooked}
                      >
                        {s.slot} {s.isAfterHours ? '(+Rp 100.000)' : ''} {s.isBooked ? '— Booked' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {isDayClosed && (
              <p className="text-xs text-bad mt-1 font-medium">{closedReason}</p>
            )}
          </div>

          {/* RIGHT CARD: DRESS SELECTION (UP TO 3) */}
          <div className="bg-card border border-line rounded-[10px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="font-serif text-[20px] font-normal mb-1">
                Dresses — up to 3 <span className="text-bad">*</span>
              </h3>

              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Dress 1
                </label>
                <select
                  value={dress1}
                  onChange={(e) => setDress1(e.target.value)}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                >
                  <option value="">— Select Garment —</option>
                  {dressOptions.map((item) => (
                    <option
                      key={item.sku}
                      value={item.sku}
                      disabled={!item.isAvailable}
                    >
                      {item.sku} — {item.name} ({item.size}) {!item.isAvailable ? `[${item.reason}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Dress 2
                </label>
                <select
                  value={dress2}
                  onChange={(e) => setDress2(e.target.value)}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                >
                  <option value="">— Optional —</option>
                  {dressOptions
                    .filter((i) => i.sku !== dress1)
                    .map((item) => (
                      <option
                        key={item.sku}
                        value={item.sku}
                        disabled={!item.isAvailable}
                      >
                        {item.sku} — {item.name} ({item.size}) {!item.isAvailable ? `[${item.reason}]` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Dress 3
                </label>
                <select
                  value={dress3}
                  onChange={(e) => setDress3(e.target.value)}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                >
                  <option value="">— Optional —</option>
                  {dressOptions
                    .filter((i) => i.sku !== dress1 && i.sku !== dress2)
                    .map((item) => (
                      <option
                        key={item.sku}
                        value={item.sku}
                        disabled={!item.isAvailable}
                      >
                        {item.sku} — {item.name} ({item.size}) {!item.isAvailable ? `[${item.reason}]` : ''}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-line">
              <button
                type="submit"
                disabled={loading || !isComplete}
                className="w-full py-2.5 bg-[#1A1F16] text-white rounded-lg text-sm font-semibold hover:bg-black transition disabled:opacity-40 cursor-pointer mb-2"
              >
                {loading ? 'Creating Session...' : '+ Create Fitting Session'}
              </button>
              <p className="text-[11px] text-muted leading-tight">
                The slot locks on creation to prevent double bookings. Confirm via WhatsApp from the session page.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

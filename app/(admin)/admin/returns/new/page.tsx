'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createReturnRequest } from '@/app/actions/returns';
import { formatRupiah } from '@/lib/utils';

export default function CreateReturnRequestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [returnMethod, setReturnMethod] = useState<'KORA arranges pickup (Biteship)' | 'Customer self-return'>(
    'KORA arranges pickup (Biteship)'
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');

  useEffect(() => {
    const fetchOrders = async () => {
      const supabase = createClient();

      // Fetch existing returns to filter out orders that already have a return
      const [ordersRes, returnsRes] = await Promise.all([
        supabase
          .from('orders')
          .select(`
            id,
            order_date,
            event_start_date,
            return_date,
            total_deposit,
            street_address,
            city,
            postal_code,
            latitude,
            longitude,
            customers (
              id,
              first_name,
              last_name,
              phone,
              addresses (*)
            ),
            order_products (
              item_sku,
              items (
                name
              )
            )
          `)
          .in('status', ['Active', 'In Shipping', 'Ordered'])
          .order('order_date', { ascending: false }),
        supabase.from('returns').select('order_id'),
      ]);

      const existingOrderIds = new Set((returnsRes.data || []).map((r) => r.order_id));
      const filtered = (ordersRes.data || []).filter((o) => !existingOrderIds.has(o.id));

      setActiveOrders(filtered);
    };

    fetchOrders();
  }, []);

  const activeOrder = useMemo(() => {
    return activeOrders.find((o) => o.id === selectedOrderId);
  }, [activeOrders, selectedOrderId]);

  const customerName = activeOrder?.customers
    ? `${activeOrder.customers.first_name || ''} ${activeOrder.customers.last_name || ''}`.trim()
    : '—';

  const firstItem = activeOrder?.order_products?.[0]
    ? `${activeOrder.order_products[0].item_sku} — ${activeOrder.order_products[0].items?.name || 'Garment'}`
    : '—';

  const customerAddresses: any[] = activeOrder?.customers?.addresses || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      setErrorMsg('Please select an active order first.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const res = await createReturnRequest({
      order_id: selectedOrderId,
      return_method: returnMethod,
      pickup_address_id: selectedAddressId ? Number(selectedAddressId) : null,
    });

    if (res.error) {
      setErrorMsg(res.error);
      setLoading(false);
    } else {
      router.push(`/admin/returns/${res.returnId}`);
    }
  };

  return (
    <div className="pb-24 font-sans text-ink">
      <Link
        href="/admin/returns"
        className="text-[12.5px] text-muted hover:text-wine-ink inline-block mb-2"
      >
        ← Back to Returns
      </Link>

      <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">
        Operations · Returns
      </div>

      <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink mb-1">
        Create Return Request
      </h1>
      <p className="text-[13px] text-muted mb-6">
        Exceptional use only — the daily path is the customer&apos;s &quot;Issue a return&quot; button. Pick the anchor order and the form fills itself; fields stay put either way.
      </p>

      {errorMsg && (
        <div className="mb-4 p-3 bg-bad-bg border border-bad/30 text-bad text-xs rounded-lg">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* LEFT CARD: ANCHOR ORDER & PICKUP ADDRESS */}
          <div className="bg-card border border-line rounded-[10px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
            <h3 className="font-serif text-[20px] font-normal mb-1">Anchor order</h3>

            <div>
              <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                Order ID (Active / In Return Only) <span className="text-bad">*</span>
              </label>
              <select
                value={selectedOrderId}
                onChange={(e) => {
                  setSelectedOrderId(e.target.value);
                  setSelectedAddressId('');
                }}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
              >
                <option value="">Select an order...</option>
                {activeOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} — {o.customers?.first_name} {o.customers?.last_name || ''} ({o.order_products?.[0]?.item_sku})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted mt-1">
                Completed, cancelled, and orders that already have an open return request never appear here.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Customer</label>
                <input
                  disabled
                  value={customerName}
                  placeholder="— select order first"
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Phone</label>
                <input
                  disabled
                  value={activeOrder?.customers?.phone || ''}
                  placeholder="— select order first"
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Item</label>
                <input
                  disabled
                  value={firstItem}
                  placeholder="— select order first"
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Deposit Held</label>
                <input
                  disabled
                  value={activeOrder ? formatRupiah(Number(activeOrder.total_deposit)) : '—'}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-ink font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                Return Deadline (From Order)
              </label>
              <input
                disabled
                value={activeOrder?.return_date || '—'}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted"
              />
            </div>

            <div>
              <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                Return Pickup Address — defaults to delivery address, changeable
              </label>
              {customerAddresses.length > 0 ? (
                <select
                  value={selectedAddressId}
                  onChange={(e) => setSelectedAddressId(e.target.value)}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                >
                  <option value="">Default: Order delivery address ({activeOrder?.street_address})</option>
                  {customerAddresses.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {a.street_address}, {a.city}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  disabled
                  value={activeOrder?.street_address ? `${activeOrder.street_address}, ${activeOrder.city}` : '— select order first'}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted"
                />
              )}
              <p className="text-[11px] text-muted mt-1">
                Confirm with the customer via WhatsApp before booking.
              </p>
            </div>
          </div>

          {/* RIGHT CARD: RETURN METHOD */}
          <div className="bg-card border border-line rounded-[10px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <h3 className="font-serif text-[20px] font-normal mb-3">Return method</h3>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer bg-[#FDFCFA] hover:bg-[#F6F4EF] transition">
                  <input
                    type="radio"
                    name="return_method"
                    checked={returnMethod === 'KORA arranges pickup (Biteship)'}
                    onChange={() => setReturnMethod('KORA arranges pickup (Biteship)')}
                    className="mt-0.5 text-wine focus:ring-wine"
                  />
                  <div>
                    <div className="font-medium text-[13px] text-ink">
                      KORA arranges pickup (Biteship, booked manually by admin)
                    </div>
                    <div className="text-[11.5px] text-muted mt-0.5">
                      Showroom orders courier pickup from customer address to KORA studio.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer bg-[#FDFCFA] hover:bg-[#F6F4EF] transition">
                  <input
                    type="radio"
                    name="return_method"
                    checked={returnMethod === 'Customer self-return'}
                    onChange={() => setReturnMethod('Customer self-return')}
                    className="mt-0.5 text-wine focus:ring-wine"
                  />
                  <div>
                    <div className="font-medium text-[13px] text-ink">
                      Customer returns by themselves (ships to the studio, submits resi)
                    </div>
                    <div className="text-[11.5px] text-muted mt-0.5">
                      Customer delivers or books own courier directly to the showroom.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-line">
              <button
                type="submit"
                disabled={loading || !selectedOrderId}
                className="w-full py-2.5 bg-[#1A1F16] text-white rounded-lg text-sm font-semibold hover:bg-black transition disabled:opacity-40 cursor-pointer mb-2"
              >
                {loading ? 'Creating Request...' : '+ Create Return Request'}
              </button>
              <p className="text-[11px] text-muted leading-tight">
                Self-return: the customer must hand the package to a courier within 2 × 24 h of the request; the team validates the submitted resi against live tracking.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

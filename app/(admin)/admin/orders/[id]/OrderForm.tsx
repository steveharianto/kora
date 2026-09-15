'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Printer,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Truck,
  Clock,
  MapPin,
  Plus,
  Lock,
  Search,
  X
} from 'lucide-react';
import { saveOrder, updateOrderStatus, addOrderNote, createCustomerAddress } from '@/app/actions/orders';
import { dispatchOrderViaBiteship } from '@/app/actions/biteship';
import { formatRupiah } from '@/lib/utils';

export default function OrderForm({
  initialOrder,
  allCustomers: initialCustomers,
  allItems,
  deliveryLeadTimes,
  notificationTemplates,
  auditLogs,
  currentAdmin,
}: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [noteText, setNoteText] = useState('');
  const [copiedResi, setCopiedResi] = useState(false);

  const [allCustomers, setAllCustomers] = useState<any[]>(initialCustomers);

  const isSuperAdmin = currentAdmin?.role?.toLowerCase().replace(/[\s_-]+/g, '') === 'superadmin';
  const isDraft = initialOrder.status === 'Draft';
  const isWebsite = initialOrder.order_method === 'Website';

  const [selectedCustomerId, setSelectedCustomerId] = useState(initialOrder.customer_id || '');

  const activeCustomer = useMemo(() => {
    return allCustomers.find((c: any) => c.id === selectedCustomerId) || initialOrder.customers;
  }, [allCustomers, selectedCustomerId, initialOrder.customers]);

  const customerAddresses: any[] = useMemo(() => {
    return activeCustomer?.addresses || [];
  }, [activeCustomer]);

  const [formData, setFormData] = useState({
    id: initialOrder.id,
    order_date: initialOrder.order_date || new Date().toISOString().split('T')[0],
    event_start_date: initialOrder.event_start_date || '',
    event_days: initialOrder.event_days || 1,
    pickup_date: initialOrder.pickup_date || '',
    return_date: initialOrder.return_date || '',
    city: initialOrder.city || '',
    postal_code: initialOrder.postal_code || '',
    street_address: initialOrder.street_address || '',
    longitude: initialOrder.longitude ?? null,
    latitude: initialOrder.latitude ?? null,
    order_method: initialOrder.order_method || 'Manual',
    status: initialOrder.status || 'Draft',
    pick_up_method: initialOrder.pick_up_method || 'JNE - REG',
    packing_slip_id: initialOrder.packing_slip_id || '',
    payment_method: initialOrder.payment_method || 'QRIS (EDC)',
    shipping_fee: Number(initialOrder.shipping_fee) || 0,
    store_credit_applied: Number(initialOrder.store_credit_applied) || 0,
  });

  // Synchronize state when router.refresh() updates initialOrder prop
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      id: initialOrder.id,
      order_date: initialOrder.order_date || prev.order_date,
      event_start_date: initialOrder.event_start_date || '',
      event_days: initialOrder.event_days || 1,
      pickup_date: initialOrder.pickup_date || '',
      return_date: initialOrder.return_date || '',
      city: initialOrder.city || '',
      postal_code: initialOrder.postal_code || '',
      street_address: initialOrder.street_address || '',
      longitude: initialOrder.longitude ?? null,
      latitude: initialOrder.latitude ?? null,
      order_method: initialOrder.order_method || 'Manual',
      status: initialOrder.status || 'Draft',
      pick_up_method: initialOrder.pick_up_method || 'JNE - REG',
      packing_slip_id: initialOrder.packing_slip_id || '',
      payment_method: initialOrder.payment_method || 'QRIS (EDC)',
      shipping_fee: Number(initialOrder.shipping_fee) || 0,
      store_credit_applied: Number(initialOrder.store_credit_applied) || 0,
    }));
    setSelectedCustomerId(initialOrder.customer_id || '');
    setProducts(
      (initialOrder.order_products || []).map((op: any) => ({
        item_sku: op.item_sku,
        label: op.items?.name || '',
        quantity: op.quantity || 1,
        price: Number(op.price) || 0,
        deposit: Number(op.deposit) || 0,
      }))
    );
  }, [initialOrder]);

  const isAddressLocked = useMemo(() => {
    return (
      ['In Shipping', 'Active', 'Completed'].includes(formData.status) ||
      Boolean(formData.packing_slip_id)
    );
  }, [formData.status, formData.packing_slip_id]);

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [geocodingError, setGeocodingError] = useState('');
  const [newAddress, setNewAddress] = useState({
    label: 'Home',
    street_address: '',
    city: '',
    postal_code: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const [products, setProducts] = useState<any[]>(
    (initialOrder.order_products || []).map((op: any) => ({
      item_sku: op.item_sku,
      label: op.items?.name || '',
      quantity: op.quantity || 1,
      price: Number(op.price) || 0,
      deposit: Number(op.deposit) || 0,
    }))
  );

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const isPickupTodayOrPast = Boolean(formData.pickup_date && formData.pickup_date <= todayStr);
  const isPickupFuture = Boolean(formData.pickup_date && formData.pickup_date > todayStr);

  const leadTimeDays = useMemo(() => {
    if (!formData.postal_code) return 1;
    const prefix2 = formData.postal_code.slice(0, 2);
    const match = deliveryLeadTimes.find((lead: any) => {
      if (lead.prefix.includes('-')) {
        const [start, end] = lead.prefix.replace('xxx', '').split('-');
        return prefix2 >= start && prefix2 <= end;
      }
      return lead.prefix.startsWith(prefix2);
    });
    return match ? Number(match.days) : 1;
  }, [formData.postal_code, deliveryLeadTimes]);

  const handleEventDateChange = (val: string) => {
    if (!val) {
      setFormData((prev) => ({ ...prev, event_start_date: '', pickup_date: '', return_date: '' }));
      return;
    }

    const [y, m, d] = val.split('-').map(Number);
    const eventDate = new Date(y, m - 1, d);
    if (isNaN(eventDate.getTime())) return;

    const pickupD = new Date(eventDate);
    pickupD.setDate(pickupD.getDate() - leadTimeDays);

    const returnD = new Date(eventDate);
    returnD.setDate(returnD.getDate() + (Number(formData.event_days) || 1) + 1);

    setFormData((prev) => ({
      ...prev,
      event_start_date: val,
      pickup_date: pickupD.toISOString().split('T')[0],
      return_date: returnD.toISOString().split('T')[0],
    }));
  };

  const handleAddLine = () => {
    setProducts([...products, { item_sku: '', label: '', quantity: 1, price: 0, deposit: 150000 }]);
  };

  const handleProductSelect = (index: number, sku: string) => {
    const item = allItems.find((i: any) => i.sku === sku);
    const next = [...products];
    if (item) {
      next[index] = {
        item_sku: item.sku,
        label: item.name,
        quantity: 1,
        price: Number(item.rental_price) || 0,
        deposit: Number(item.rental_price) > 1000000 ? 250000 : 150000,
      };
    } else {
      next[index].item_sku = sku;
    }
    setProducts(next);
  };

  const handleRemoveLine = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const productsSubtotal = useMemo(() => {
    return products.reduce((sum, p) => sum + (Number(p.price) || 0) * (Number(p.quantity) || 1), 0);
  }, [products]);

  const totalDeposit = useMemo(() => {
    return products.reduce((sum, p) => sum + (Number(p.deposit) || 0) * (Number(p.quantity) || 1), 0);
  }, [products]);

  const grandTotal = useMemo(() => {
    return Math.max(
      0,
      productsSubtotal + totalDeposit + Number(formData.shipping_fee) - Number(formData.store_credit_applied)
    );
  }, [productsSubtotal, totalDeposit, formData.shipping_fee, formData.store_credit_applied]);

  const missingFields = useMemo(() => {
    const m = [];
    if (!selectedCustomerId) m.push('Customer');
    if (!formData.event_start_date) m.push('Event Start Date');
    if (!formData.pickup_date) m.push('Pick Up/Send Date');
    if (!formData.return_date) m.push('Return Date');
    if (products.length === 0 || !products[0]?.item_sku) m.push('At least one product line');
    return m;
  }, [selectedCustomerId, formData.event_start_date, formData.pickup_date, formData.return_date, products]);

  const isComplete = missingFields.length === 0;

  const handleSave = async () => {
    setLoading(true);
    setErrorMsg('');
    const res = await saveOrder({
      ...formData,
      customer_id: selectedCustomerId,
      products,
    });

    if (res?.error) {
      setErrorMsg(res.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  const handleStatusTransition = async (newStatus: string) => {
    setLoading(true);
    setErrorMsg('');
    const res = await updateOrderStatus(formData.id, newStatus);
    if (res?.error) {
      setErrorMsg(res.error);
    } else {
      setFormData((prev) => ({ ...prev, status: newStatus }));
      router.refresh();
    }
    setLoading(false);
  };

  const handleBiteshipBooking = async () => {
    if (isPickupFuture) {
      const confirmEarly = confirm(
        `ATTENTION: PREMATURE BOOKING WARNING\n\n` +
        `This order has a scheduled send date of ${formData.pickup_date} (in the future).\n\n` +
        `Booking Biteship now will dispatch an immediate pickup request to the courier today.\n\n` +
        `Are you sure you want to summon the courier today anyway?`
      );
      if (!confirmEarly) return;
    } else {
      if (!confirm('Book courier pickup via Biteship now? Ensure parcel is packed and sealed.')) return;
    }

    setDispatching(true);
    setErrorMsg('');
    const res = await dispatchOrderViaBiteship(formData.id);
    if (res?.error) {
      setErrorMsg(res.error);
    } else {
      setFormData((prev) => ({
        ...prev,
        status: 'In Shipping',
        packing_slip_id: res.waybill || prev.packing_slip_id,
      }));
      router.refresh();
    }
    setDispatching(false);
  };

  const handleCopyResi = () => {
    if (!formData.packing_slip_id) return;
    navigator.clipboard.writeText(formData.packing_slip_id);
    setCopiedResi(true);
    setTimeout(() => setCopiedResi(false), 2000);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    await addOrderNote(formData.id, noteText);
    setNoteText('');
    router.refresh();
  };

  const handleGeocodeSearch = async () => {
    const query = `${newAddress.street_address}, ${newAddress.city}, Indonesia`.trim();
    if (!query || query.length < 5) {
      setGeocodingError('Please enter street address and city first.');
      return;
    }

    setGeocodingLoading(true);
    setGeocodingError('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const first = data[0];
        setNewAddress((prev) => ({
          ...prev,
          latitude: parseFloat(first.lat),
          longitude: parseFloat(first.lon),
        }));
      } else {
        setGeocodingError('Location pin not found. Check address spelling or enter coordinates manually.');
      }
    } catch {
      setGeocodingError('Network error connecting to geocoder. Enter coordinates manually.');
    } finally {
      setGeocodingLoading(false);
    }
  };

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('Please select a customer first before adding an address.');
      return;
    }

    setModalLoading(true);
    const res = await createCustomerAddress({
      customer_id: selectedCustomerId,
      ...newAddress,
    });

    if (res.error) {
      alert(res.error);
      setModalLoading(false);
      return;
    }

    if (res.address) {
      const added = res.address;
      setAllCustomers((prev) =>
        prev.map((c) => {
          if (c.id === selectedCustomerId) {
            return {
              ...c,
              addresses: [added, ...(c.addresses || [])],
            };
          }
          return c;
        })
      );

      setFormData((prev) => ({
        ...prev,
        street_address: added.street_address,
        city: added.city,
        postal_code: added.postal_code || '',
        latitude: added.latitude ?? null,
        longitude: added.longitude ?? null,
      }));

      setIsAddressModalOpen(false);
      setNewAddress({
        label: 'Home',
        street_address: '',
        city: '',
        postal_code: '',
        latitude: null,
        longitude: null,
      });
    }

    setModalLoading(false);
  };

  const trackingUrl = useMemo(() => {
    if (!formData.packing_slip_id) return '';
    return `https://biteship.com/id/tracking/${formData.packing_slip_id}`;
  }, [formData.packing_slip_id]);

  const whatsAppTrackingUrl = useMemo(() => {
    if (!activeCustomer?.phone) return '';
    const rawPhone = String(activeCustomer.phone).replace(/\D/g, '');
    const phone = rawPhone.startsWith('0') ? `62${rawPhone.slice(1)}` : rawPhone;
    const custName = `${activeCustomer.first_name || ''} ${activeCustomer.last_name || ''}`.trim() || 'Customer';

    const defaultTpl = 'Hi [CUSTOMER_NAME], your order [ORDER_ID] is on its way! Track it here: [TRACKING_LINK].';
    const rawTemplate = notificationTemplates?.package_shipped?.template || defaultTpl;

    const message = rawTemplate
      .replace(/\[CUSTOMER_NAME\]/g, custName)
      .replace(/\[ORDER_ID\]/g, formData.id)
      .replace(/\[TRACKING_LINK\]/g, trackingUrl || formData.packing_slip_id);

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }, [activeCustomer, formData.id, formData.packing_slip_id, notificationTemplates, trackingUrl]);

  return (
    <div>
      <Link href="/admin/orders" className="text-[12.5px] text-muted hover:text-wine-ink inline-block mb-2">
        ← Back to Orders
      </Link>

      <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">
        Operations · Orders
      </div>

      {/* Header & Lifecycle Ribbon */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h1 className="font-serif text-[30px] font-normal tracking-[0.01em]">
          {formData.id} {isDraft && '- new'}
        </h1>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded bg-[#EFEBE2] text-muted mr-1">
            {formData.status}
          </span>

          {isDraft && (
            <button
              type="button"
              onClick={() => handleStatusTransition('Ordered')}
              disabled={loading || !isComplete}
              className="px-3.5 py-1.5 bg-ink text-white rounded-lg text-xs font-semibold hover:bg-[#181E15] transition disabled:opacity-50 cursor-pointer"
            >
              Post Order
            </button>
          )}

          {!isDraft && !isWebsite && isSuperAdmin && (
            <button
              type="button"
              onClick={() => handleStatusTransition('Draft')}
              disabled={loading}
              className="px-3 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] cursor-pointer"
            >
              Reset to Draft
            </button>
          )}

          {formData.status === 'Ordered' && (
            <button
              type="button"
              onClick={handleBiteshipBooking}
              disabled={dispatching || loading || !isComplete}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm cursor-pointer ${
                isPickupTodayOrPast
                  ? 'bg-wine text-white hover:bg-[#181E15]'
                  : 'bg-[#F4EBE6] text-[#8C2C1D] border border-[#E5CAC3] hover:bg-[#EEDFD8]'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              {dispatching ? 'Booking Biteship...' : isPickupTodayOrPast ? 'Book Biteship Now' : 'Book Biteship (Early)'}
            </button>
          )}

          {formData.status === 'In Shipping' && (
            <button
              type="button"
              onClick={() => handleStatusTransition('Active')}
              disabled={loading}
              className="px-3.5 py-1.5 bg-ok-bg text-ok border border-ok/30 rounded-lg text-xs font-semibold hover:bg-ok-bg/80 cursor-pointer"
            >
              Mark Active
            </button>
          )}

          {formData.status !== 'Cancelled' && (
            <button
              type="button"
              onClick={() => handleStatusTransition('Cancelled')}
              disabled={loading}
              className="px-3 py-1.5 border border-line text-bad rounded-lg text-xs font-medium hover:bg-bad-bg cursor-pointer"
            >
              Cancel Order
            </button>
          )}

          <Link
            href={`/admin/orders/${formData.id}/invoice`}
            target="_blank"
            className="px-3.5 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF]"
          >
            Invoice
          </Link>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-1.5 bg-wine text-white rounded-lg text-xs font-medium hover:bg-[#181E15] transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 text-xs bg-bad-bg border border-[#D9A79C] text-bad rounded-lg">
          {errorMsg}
        </div>
      )}

      {/* DISPATCH TIMING BANNER */}
      {formData.status === 'Ordered' && (
        <div
          className={`mb-4 p-3.5 rounded-xl border flex items-center gap-3 text-xs ${
            isPickupTodayOrPast
              ? 'bg-[#F2F6EF] border-[#CAD3C5] text-wine-ink'
              : 'bg-[#FBF8EF] border-[#E8DFC2] text-[#84661E]'
          }`}
        >
          {isPickupTodayOrPast ? (
            <Truck className="w-4 h-4 flex-shrink-0 text-wine" />
          ) : (
            <Clock className="w-4 h-4 flex-shrink-0 text-[#84661E]" />
          )}

          <div className="flex-1">
            {isPickupTodayOrPast ? (
              <span>
                <strong>Send Date is today ({formData.pickup_date || 'Today'}).</strong> Steam, inspect, and box the garment, then press <strong>Book Biteship Now</strong> to summon the courier.
              </span>
            ) : (
              <span>
                <strong>Scheduled dispatch on {formData.pickup_date || 'Future Date'}.</strong> Keep garment in preparation. Couriers pick up on-demand — only click Book Biteship when the send day arrives.
              </span>
            )}
          </div>
        </div>
      )}

      {/* DISPATCH & LOGISTICS CARD */}
      {formData.packing_slip_id && (
        <div className="mb-5 p-4 rounded-xl border border-[#CAD3C5] bg-[#F2F6EF] shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold tracking-widest uppercase bg-[#2E7D47] text-white px-2 py-0.5 rounded">
                  DISPATCHED
                </span>
                <span className="text-xs font-medium text-muted">
                  {formData.pick_up_method || 'Courier Service'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Waybill / Resi:</span>
                <span className="font-mono text-[17px] font-bold text-ink">
                  {formData.packing_slip_id}
                </span>
                <button
                  type="button"
                  onClick={handleCopyResi}
                  className="p-1 hover:bg-[#E2EBDE] rounded transition text-muted hover:text-ink cursor-pointer"
                  title="Copy Waybill"
                >
                  {copiedResi ? <Check className="w-4 h-4 text-ok" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/orders/${formData.id}/label`}
                target="_blank"
                className="px-3.5 py-2 bg-ink text-white rounded-lg text-xs font-semibold hover:bg-[#141811] transition flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Shipping Label (A6 Sticker)
              </Link>

              {whatsAppTrackingUrl && (
                <a
                  href={whatsAppTrackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 bg-[#25D366] text-white rounded-lg text-xs font-semibold hover:bg-[#20BA5A] transition flex items-center gap-1.5 shadow-sm"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp Tracking
                </a>
              )}

              {trackingUrl && (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 border border-[#CAD3C5] bg-white text-ink rounded-lg text-xs font-medium hover:bg-[#FBFAF6] transition flex items-center gap-1"
                >
                  Track Courier
                  <ExternalLink className="w-3 h-3 text-muted" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Validation Banner */}
      <div
        className={`mb-5 p-3.5 rounded-xl border text-[12.5px] ${
          isComplete
            ? 'bg-[#F2F6EF] border-[#CAD3C5] text-wine-ink'
            : 'bg-warn-bg border-warn/30 text-warn-ink'
        }`}
      >
        {isComplete ? (
          <div>
            <strong>All required fields complete.</strong> Nothing on this order is holding it in Work Queue.
          </div>
        ) : (
          <div>
            <strong>Incomplete - {missingFields.length} required fields still empty.</strong> This order stays in Work Queue until resolved: {missingFields.join(', ')}.
          </div>
        )}
      </div>

      {/* 2-Column Main Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* LEFT COLUMN: Customer & Schedule */}
        <div className="bg-card border border-line rounded-[10px] p-5">
          <h3 className="font-serif text-[18px] font-normal mb-3">Customer & schedule</h3>

          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                Customer <span className="text-bad">*</span>
              </label>
              <select
                disabled={(!isDraft && !isSuperAdmin) || isAddressLocked}
                value={selectedCustomerId}
                onChange={(e) => {
                  const newCustId = e.target.value;
                  setSelectedCustomerId(newCustId);
                  const cust = allCustomers.find((c: any) => c.id === newCustId);

                  if (cust?.addresses && cust.addresses.length > 0) {
                    const defaultAddr = cust.addresses.find((a: any) => a.is_default) || cust.addresses[0];
                    setFormData((prev) => ({
                      ...prev,
                      street_address: defaultAddr.street_address || '',
                      city: defaultAddr.city || '',
                      postal_code: defaultAddr.postal_code || '',
                      latitude: defaultAddr.latitude ?? null,
                      longitude: defaultAddr.longitude ?? null,
                    }));
                  } else {
                    setFormData((prev) => ({
                      ...prev,
                      street_address: '',
                      city: '',
                      postal_code: '',
                      latitude: null,
                      longitude: null,
                    }));
                  }
                }}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-1 focus:ring-wine disabled:bg-[#F6F4EF]"
              >
                <option value="">— Select Customer —</option>
                {allCustomers.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name || ''} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Phone</label>
                <input
                  disabled
                  value={activeCustomer?.phone || ''}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted"
                />
              </div>
              <div className="flex items-end">
                <a
                  href={`https://wa.me/${(activeCustomer?.phone || '').replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full text-center py-2 px-3 border border-line rounded-lg text-xs font-medium hover:bg-[#F6F4EF] transition"
                >
                  WhatsApp customer
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Order Date <span className="text-bad">*</span>
                </label>
                <input
                  type="date"
                  disabled={!isDraft && !isSuperAdmin}
                  value={formData.order_date}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Event Start Date <span className="text-bad">*</span>
                </label>
                <input
                  type="date"
                  disabled={isAddressLocked}
                  value={formData.event_start_date}
                  onChange={(e) => handleEventDateChange(e.target.value)}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Event Days</label>
                <input
                  type="number"
                  min={1}
                  disabled={isAddressLocked}
                  value={formData.event_days}
                  onChange={(e) => setFormData({ ...formData, event_days: parseInt(e.target.value) || 1 })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Pick Up / Send Date <span className="text-bad">*</span>
                </label>
                <input
                  type="date"
                  disabled={isAddressLocked}
                  value={formData.pickup_date}
                  onChange={(e) => setFormData({ ...formData, pickup_date: e.target.value })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                Return Date <span className="text-bad">*</span>
              </label>
              <input
                type="date"
                disabled={isAddressLocked}
                value={formData.return_date}
                onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
              />
            </div>

            {/* DELIVERY ADDRESS SECTION */}
            <div className="pt-2 border-t border-line">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] tracking-[0.14em] uppercase text-muted font-medium flex items-center gap-1">
                  Delivery Address <span className="text-bad">*</span>
                  {isAddressLocked && <Lock className="w-3 h-3 text-muted ml-0.5" />}
                </label>

                {!isAddressLocked && selectedCustomerId && (
                  <button
                    type="button"
                    onClick={() => setIsAddressModalOpen(true)}
                    className="text-[11px] font-semibold text-wine-ink hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Add New Address
                  </button>
                )}
              </div>

              {isAddressLocked && (
                <div className="mb-2 p-2 bg-[#FBF8EF] border border-[#E8DFC2] rounded text-[11px] text-[#84661E] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Address locked — order is currently in shipping or completed.</span>
                </div>
              )}

              {customerAddresses.length > 0 ? (
                <div className="mb-2">
                  <select
                    disabled={isAddressLocked}
                    value={
                      customerAddresses.find((a) => a.street_address === formData.street_address)?.id || ''
                    }
                    onChange={(e) => {
                      const addr = customerAddresses.find((a: any) => String(a.id) === e.target.value);
                      if (addr) {
                        setFormData((prev) => ({
                          ...prev,
                          street_address: addr.street_address || '',
                          city: addr.city || '',
                          postal_code: addr.postal_code || '',
                          latitude: addr.latitude ?? null,
                          longitude: addr.longitude ?? null,
                        }));
                      }
                    }}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                  >
                    <option value="">— Select Saved Address ({customerAddresses.length}) —</option>
                    {customerAddresses.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.label} — {a.street_address}, {a.city} {a.postal_code ? `(${a.postal_code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : selectedCustomerId ? (
                <div className="mb-2 text-[11px] text-muted italic flex items-center justify-between">
                  <span>No saved addresses found for this customer.</span>
                  {!isAddressLocked && (
                    <button
                      type="button"
                      onClick={() => setIsAddressModalOpen(true)}
                      className="text-wine-ink font-semibold not-italic hover:underline cursor-pointer"
                    >
                      + Add first address
                    </button>
                  )}
                </div>
              ) : null}

              <textarea
                rows={2}
                disabled={isAddressLocked}
                placeholder="Street name, house/building number, unit..."
                value={formData.street_address}
                onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
              />

              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  placeholder="City"
                  disabled={isAddressLocked}
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="text-xs border border-line rounded px-2.5 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                />
                <input
                  placeholder="Postal Code"
                  disabled={isAddressLocked}
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="text-xs border border-line rounded px-2.5 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px]">
                {formData.latitude !== null && formData.longitude !== null ? (
                  <span className="text-[#2E7D47] font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    GPS Coordinates pinned ({Number(formData.latitude).toFixed(4)}, {Number(formData.longitude).toFixed(4)})
                  </span>
                ) : (
                  <span className="text-[#84661E] flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    No GPS coordinates (instant/same-day couriers require coordinates)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Fulfilment & Payment */}
        <div className="bg-card border border-line rounded-[10px] p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-serif text-[18px] font-normal mb-3">Fulfilment & payment</h3>

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Order Method
                  </label>
                  <select
                    disabled={!isDraft && !isSuperAdmin}
                    value={formData.order_method}
                    onChange={(e) => setFormData({ ...formData, order_method: e.target.value })}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                  >
                    <option value="Manual">Manual</option>
                    <option value="Website">Website</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Status</label>
                  <input
                    disabled
                    value={formData.status}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted uppercase font-semibold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Pick Up Method
                </label>
                <select
                  disabled={isAddressLocked}
                  value={formData.pick_up_method}
                  onChange={(e) => setFormData({ ...formData, pick_up_method: e.target.value })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                >
                  <option value="JNE - REG">JNE - REG</option>
                  <option value="JNE - YES">JNE - YES</option>
                  <option value="SiCepat - REG">SiCepat - REG</option>
                  <option value="Gosend - Instant">Gosend - Instant</option>
                  <option value="Paxel - Medium">Paxel - Medium</option>
                  <option value="Self pickup">Self pickup (Diambil)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Packing Slip ID / Waybill
                </label>
                <input
                  placeholder="— fills on dispatch or Biteship booking"
                  value={formData.packing_slip_id}
                  onChange={(e) => setFormData({ ...formData, packing_slip_id: e.target.value })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                />
              </div>

              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Payment Method
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                >
                  <option value="QRIS (EDC)">QRIS (EDC)</option>
                  <option value="Bank Transfer - BCA">Bank Transfer - BCA</option>
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Line Items */}
      <div className="bg-card border border-line rounded-[10px] p-5 mb-4">
        <h3 className="font-serif text-[18px] font-normal mb-3">
          Product <span className="text-bad">*</span>
        </h3>

        <div className="space-y-2 mb-3">
          <div className="grid grid-cols-12 gap-2 text-[10.5px] uppercase tracking-wider text-muted font-medium pb-1 border-b border-line">
            <div className="col-span-3">Product SKU</div>
            <div className="col-span-4">Product Label</div>
            <div className="col-span-1 text-center">Qty</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-1 text-right">Deposit</div>
            <div className="col-span-1"></div>
          </div>

          {products.map((p, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-3">
                <select
                  disabled={isAddressLocked}
                  value={p.item_sku}
                  onChange={(e) => handleProductSelect(idx, e.target.value)}
                  className="w-full text-xs border border-line rounded px-2 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                >
                  <option value="">— Select SKU —</option>
                  {allItems.map((i: any) => (
                    <option key={i.sku} value={i.sku}>
                      {i.sku} - {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-4">
                <input
                  value={p.label}
                  readOnly
                  placeholder="Select a product SKU"
                  className="w-full text-xs border border-line rounded px-2 py-1.5 bg-[#F6F4EF] text-muted"
                />
              </div>
              <div className="col-span-1">
                <input
                  type="number"
                  min={1}
                  disabled={isAddressLocked}
                  value={p.quantity}
                  onChange={(e) => {
                    const next = [...products];
                    next[idx].quantity = parseInt(e.target.value) || 1;
                    setProducts(next);
                  }}
                  className="w-full text-center text-xs border border-line rounded py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  disabled={isAddressLocked}
                  value={p.price}
                  onChange={(e) => {
                    const next = [...products];
                    next[idx].price = parseFloat(e.target.value) || 0;
                    setProducts(next);
                  }}
                  className="w-full text-right text-xs border border-line rounded px-2 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                />
              </div>
              <div className="col-span-1">
                <input
                  type="number"
                  disabled={isAddressLocked}
                  value={p.deposit}
                  onChange={(e) => {
                    const next = [...products];
                    next[idx].deposit = parseFloat(e.target.value) || 0;
                    setProducts(next);
                  }}
                  className="w-full text-right text-xs border border-line rounded px-2 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                />
              </div>
              <div className="col-span-1 text-right">
                {!isAddressLocked && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    className="text-muted hover:text-bad px-1 text-base leading-none cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {!isAddressLocked && (
          <button
            type="button"
            onClick={handleAddLine}
            className="text-xs font-semibold text-wine-ink hover:underline cursor-pointer"
          >
            + add a line
          </button>
        )}
      </div>

      {/* Financial Summary */}
      <div className="bg-card border border-line rounded-[10px] p-5 mb-4">
        <h3 className="font-serif text-[18px] font-normal mb-3">Financial summary</h3>

        <div className="divide-y divide-line max-w-xl text-[13px]">
          <div className="flex justify-between py-2">
            <span className="text-muted">Products subtotal (price × qty)</span>
            <span className="font-medium">{formatRupiah(productsSubtotal)}</span>
          </div>

          <div className="flex justify-between items-center py-2">
            <span className="text-muted">Shipping fee (ongkir)</span>
            <input
              type="number"
              disabled={isAddressLocked}
              value={formData.shipping_fee}
              onChange={(e) => setFormData({ ...formData, shipping_fee: parseFloat(e.target.value) || 0 })}
              className="w-32 text-right text-xs border border-line rounded px-2 py-1 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
            />
          </div>

          <div className="flex justify-between py-2">
            <span className="text-muted">Refundable deposit</span>
            <span className="font-medium">{formatRupiah(totalDeposit)}</span>
          </div>

          <div className="flex justify-between items-center py-2">
            <div>
              <span className="text-muted">Store credit applied</span>
              {activeCustomer && (
                <div className="text-[11px] text-muted">
                  Remaining available: {formatRupiah(Number(activeCustomer.current_credit) || 0)}
                </div>
              )}
            </div>
            <input
              type="number"
              disabled={isAddressLocked}
              max={Number(activeCustomer?.current_credit) || 0}
              value={formData.store_credit_applied}
              onChange={(e) =>
                setFormData({ ...formData, store_credit_applied: parseFloat(e.target.value) || 0 })
              }
              className="w-32 text-right text-xs border border-line rounded px-2 py-1 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
            />
          </div>

          <div className="flex justify-between py-3 text-base font-serif font-bold text-ink">
            <span>Total</span>
            <span>{formatRupiah(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Team Notes & Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-line rounded-[10px] p-5 flex flex-col">
          <h3 className="font-serif text-[18px] font-normal mb-1">
            Log Note <span className="text-[12px] text-muted font-sans">- internal team only</span>
          </h3>
          <form onSubmit={handleAddNote} className="mt-2 flex-1 flex flex-col">
            <textarea
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Note for the team..."
              className="w-full text-xs border border-line rounded-lg p-2.5 bg-[#FDFCFA] focus:ring-1 focus:ring-wine"
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
            <p className="text-xs text-muted">No changes recorded yet.</p>
          ) : (
            <ul className="space-y-2.5 text-xs">
              {auditLogs.map((log: any) => (
                <li key={log.id} className="border-b border-line pb-1.5 last:border-none">
                  <span className="font-semibold">{log.admin_name}</span>: {log.action_type}{' '}
                  {log.new_value && <span className="text-wine-ink font-medium">({log.new_value})</span>}
                  <span className="text-muted ml-1">· {new Date(log.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* MODAL: ADD NEW CUSTOMER ADDRESS */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSaveNewAddress}
            className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-line max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-serif text-[20px]">Add Customer Address</h3>
                <p className="text-xs text-muted">
                  For {activeCustomer?.first_name} {activeCustomer?.last_name || ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="text-muted hover:text-ink p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block uppercase tracking-wider text-muted font-medium mb-1">
                  Address Label
                </label>
                <input
                  required
                  placeholder="e.g. Home, Office, Studio"
                  value={newAddress.label}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                  className="w-full border border-line rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block uppercase tracking-wider text-muted font-medium mb-1">
                  Street Address <span className="text-bad">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Street name, house/building number, unit..."
                  value={newAddress.street_address}
                  onChange={(e) => setNewAddress({ ...newAddress, street_address: e.target.value })}
                  className="w-full border border-line rounded-lg p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block uppercase tracking-wider text-muted font-medium mb-1">
                    City <span className="text-bad">*</span>
                  </label>
                  <input
                    required
                    placeholder="e.g. Jakarta Selatan"
                    value={newAddress.city}
                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                    className="w-full border border-line rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block uppercase tracking-wider text-muted font-medium mb-1">
                    Postal Code
                  </label>
                  <input
                    placeholder="e.g. 12180"
                    value={newAddress.postal_code}
                    onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                    className="w-full border border-line rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#F6F4EF] rounded-lg border border-[#E5E0D6] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-wine" />
                    GPS Map Pin (Required for GoSend/Instant)
                  </span>
                  <button
                    type="button"
                    onClick={handleGeocodeSearch}
                    disabled={geocodingLoading}
                    className="px-2.5 py-1 bg-white border border-line text-[11px] rounded hover:bg-[#F2EFE8] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Search className="w-3 h-3" />
                    {geocodingLoading ? 'Searching...' : 'Find Coordinates'}
                  </button>
                </div>

                {geocodingError && (
                  <p className="text-[11px] text-bad">{geocodingError}</p>
                )}

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="block text-muted mb-0.5">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="-6.2345"
                      value={newAddress.latitude ?? ''}
                      onChange={(e) =>
                        setNewAddress({
                          ...newAddress,
                          latitude: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      className="w-full bg-white border border-line rounded px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-muted mb-0.5">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="106.8456"
                      value={newAddress.longitude ?? ''}
                      onChange={(e) =>
                        setNewAddress({
                          ...newAddress,
                          longitude: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      className="w-full bg-white border border-line rounded px-2 py-1 text-xs"
                    />
                  </div>
                </div>

                {newAddress.latitude !== null && newAddress.longitude !== null && (
                  <div className="w-full h-32 rounded-lg overflow-hidden border border-line mt-2 relative">
                    <iframe
                      title="OpenStreetMap Pin Preview"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(newAddress.longitude) - 0.005}%2C${Number(newAddress.latitude) - 0.005}%2C${Number(newAddress.longitude) + 0.005}%2C${Number(newAddress.latitude) + 0.005}&layer=mapnik&marker=${newAddress.latitude}%2C${newAddress.longitude}`}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="px-3.5 py-1.5 border border-line rounded-lg text-xs font-medium hover:bg-[#F6F4EF] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalLoading}
                className="px-4 py-1.5 bg-wine text-white rounded-lg text-xs font-medium hover:bg-[#181E15] transition disabled:opacity-50 cursor-pointer"
              >
                {modalLoading ? 'Saving...' : 'Save & Select Address'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

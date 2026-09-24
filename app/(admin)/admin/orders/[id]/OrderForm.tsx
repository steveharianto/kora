"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Printer,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Truck,
  Plus,
  Lock,
  X,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Send,
} from "lucide-react";
import {
  saveOrder,
  updateOrderStatus,
  addOrderNote,
  createCustomerAddress,
} from "@/app/actions/orders";
import { createCustomer } from "@/app/actions/customers";
import { dispatchOrderViaBiteship } from "@/app/actions/biteship";
import { formatRupiah } from "@/lib/utils";
import RupiahInput from "@/components/RupiahInput";
import AddressMapPicker from "@/components/AddressMapPicker";

// Locale-safe date formatter — matches server and client output byte-for-byte.
function formatLogDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function ProductSkuSelect({
  value,
  selectedLabel,
  disabled,
  allItems,
  onSelect,
}: {
  value: string;
  selectedLabel: string;
  disabled: boolean;
  allItems: any[];
  onSelect: (sku: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 40);
    return allItems
      .filter(
        (i: any) =>
          i.sku.toLowerCase().includes(q) ||
          (i.name || "").toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [allItems, query]);

  const displayValue = isOpen
    ? query
    : value
      ? `${value}${selectedLabel ? ` — ${selectedLabel}` : ""}`
      : "";

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        disabled={disabled}
        value={displayValue}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (!disabled) {
            setIsOpen(true);
            setQuery("");
          }
        }}
        placeholder="Search SKU or name..."
        className="w-full text-xs border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA] focus:ring-1 focus:ring-wine focus:outline-none disabled:bg-[#F6F4EF]"
      />
      {isOpen && !disabled && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-line rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-[11px] text-muted text-center">
              No items found.
            </div>
          ) : (
            filtered.map((i: any) => (
              <button
                key={i.sku}
                type="button"
                onClick={() => {
                  onSelect(i.sku);
                  setIsOpen(false);
                  setQuery("");
                }}
                className="w-full text-left px-2.5 py-2 text-[11px] hover:bg-[#F6F4EF] border-b border-line last:border-none"
              >
                <div className="font-mono font-bold text-ink">{i.sku}</div>
                <div className="text-muted text-[10.5px] truncate">
                  {i.name}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function OrderForm({
  initialOrder,
  allCustomers: initialCustomers,
  allItems,
  deliveryLeadTimes,
  notificationTemplates,
  bookingWindowDays = 3,
  auditLogs,
  currentAdmin,
}: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [noteText, setNoteText] = useState("");
  const [copiedResi, setCopiedResi] = useState(false);
  const waybillInputRef = useRef<HTMLInputElement>(null);

  const [allCustomers, setAllCustomers] = useState<any[]>(initialCustomers);

  const isSuperAdmin =
    currentAdmin?.role?.toLowerCase().replace(/[\s_-]+/g, "") === "superadmin";
  const isDraft = initialOrder.status === "Draft";
  const isWebsite = initialOrder.order_method === "Website";

  // Detect whether the WA-on-post notification was already dispatched
  const waPosted = useMemo(
    () =>
      (auditLogs || []).some(
        (l: any) =>
          l.action_type === "WA_DISPATCHED" && l.field_name === "order_posted",
      ),
    [auditLogs],
  );

  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialOrder.customer_id || "",
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const [bookingStep, setBookingStep] = useState<
    "closed" | "preview" | "booking" | "success" | "error"
  >("closed");
  const [bookingNote, setBookingNote] = useState(
    `KORA Rental ${initialOrder.id} - Handle with care`,
  );
  const [bookingResult, setBookingResult] = useState<{
    waybill: string;
    trackingUrl: string | null;
    courierCompany: string;
    courierType: string;
    price: number | null;
  } | null>(null);
  const [bookingError, setBookingError] = useState<string>("");
  const [copiedWaybill, setCopiedWaybill] = useState(false);

  // SSR-safe origin gate: empty on server → empty on first client render → match.
  // Populated in useEffect after hydration, so origin-dependent links appear post-mount.
  const [mountedOrigin, setMountedOrigin] = useState("");
  useEffect(() => {
    setMountedOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCustomerDropdownOpen(false);
        setCustomerSearch("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const activeCustomer = useMemo(
    () =>
      allCustomers.find((c: any) => c.id === selectedCustomerId) ||
      initialOrder.customers,
    [allCustomers, selectedCustomerId, initialOrder.customers],
  );

  const customerAddresses: any[] = useMemo(
    () => activeCustomer?.addresses || [],
    [activeCustomer],
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return allCustomers.slice(0, 50);
    return allCustomers
      .filter((c: any) => {
        const name = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
        return name.includes(q) || (c.phone || "").toLowerCase().includes(q);
      })
      .slice(0, 50);
  }, [allCustomers, customerSearch]);

  const [formData, setFormData] = useState({
    id: initialOrder.id,
    order_date:
      initialOrder.order_date || new Date().toISOString().split("T")[0],
    event_start_date: initialOrder.event_start_date || "",
    event_days: initialOrder.event_days || 1,
    pickup_date: initialOrder.pickup_date || "",
    return_date: initialOrder.return_date || "",
    city: initialOrder.city || "",
    postal_code: initialOrder.postal_code || "",
    street_address: initialOrder.street_address || "",
    longitude: initialOrder.longitude ?? null,
    latitude: initialOrder.latitude ?? null,
    order_method: initialOrder.order_method || "Manual",
    status: initialOrder.status || "Draft",
    pick_up_method: initialOrder.pick_up_method || "JNE - REG",
    packing_slip_id: initialOrder.packing_slip_id || "",
    payment_method: initialOrder.payment_method || "QRIS (EDC)",
    shipping_fee: Number(initialOrder.shipping_fee) || 0,
    store_credit_applied: Number(initialOrder.store_credit_applied) || 0,
  });

  useEffect(() => {
    setFormData((p) => ({
      ...p,
      id: initialOrder.id,
      order_date: initialOrder.order_date || p.order_date,
      event_start_date: initialOrder.event_start_date || "",
      event_days: initialOrder.event_days || 1,
      pickup_date: initialOrder.pickup_date || "",
      return_date: initialOrder.return_date || "",
      city: initialOrder.city || "",
      postal_code: initialOrder.postal_code || "",
      street_address: initialOrder.street_address || "",
      longitude: initialOrder.longitude ?? null,
      latitude: initialOrder.latitude ?? null,
      order_method: initialOrder.order_method || "Manual",
      status: initialOrder.status || "Draft",
      pick_up_method: initialOrder.pick_up_method || "JNE - REG",
      packing_slip_id: initialOrder.packing_slip_id || "",
      payment_method: initialOrder.payment_method || "QRIS (EDC)",
      shipping_fee: Number(initialOrder.shipping_fee) || 0,
      store_credit_applied: Number(initialOrder.store_credit_applied) || 0,
    }));
    setSelectedCustomerId(initialOrder.customer_id || "");
    setProducts(
      (initialOrder.order_products || []).map((op: any) => ({
        item_sku: op.item_sku,
        label: op.items?.name || "",
        quantity: op.quantity || 1,
        price: Number(op.price) || 0,
        deposit: Number(op.deposit) || 0,
      })),
    );
    setBookingNote(`KORA Rental ${initialOrder.id} - Handle with care`);
  }, [initialOrder]);

  const isAddressLocked = useMemo(
    () =>
      isWebsite ||
      ["In Shipping", "Active", "Completed"].includes(formData.status) ||
      Boolean(formData.packing_slip_id),
    [isWebsite, formData.status, formData.packing_slip_id],
  );

  // Booking window — mirrors server-side guard
  const daysUntilPickup = useMemo(() => {
    if (!formData.pickup_date) return null;
    const [py, pm, pd] = formData.pickup_date.split("-").map(Number);
    const pickup = new Date(py, pm - 1, pd);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    pickup.setHours(0, 0, 0, 0);
    return Math.round((pickup.getTime() - today.getTime()) / 86400000);
  }, [formData.pickup_date]);

  const canBookAtAll =
    daysUntilPickup !== null && daysUntilPickup <= bookingWindowDays;
  const canBookNow = daysUntilPickup !== null && daysUntilPickup <= 0;

  const bookingWindowOpensOn = useMemo(() => {
    if (!formData.pickup_date) return null;
    const [py, pm, pd] = formData.pickup_date.split("-").map(Number);
    const d = new Date(py, pm - 1, pd);
    d.setDate(d.getDate() - bookingWindowDays);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }, [formData.pickup_date, bookingWindowDays]);

  const alreadyDispatched = Boolean(
    formData.packing_slip_id &&
    ["In Shipping", "Active", "Completed"].includes(formData.status),
  );

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: "Home",
    street_address: "",
    city: "",
    postal_code: "",
    latitude: null as number | null,
    longitude: null as number | null,
    is_default: false,
  });

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerModalLoading, setCustomerModalLoading] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    gender: "Female",
    dob: "",
  });

  const [products, setProducts] = useState<any[]>(
    (initialOrder.order_products || []).map((op: any) => ({
      item_sku: op.item_sku,
      label: op.items?.name || "",
      quantity: op.quantity || 1,
      price: Number(op.price) || 0,
      deposit: Number(op.deposit) || 0,
    })),
  );

  const leadTimeDays = useMemo(() => {
    if (!formData.postal_code) return 1;
    const prefix2 = formData.postal_code.slice(0, 2);
    const match = deliveryLeadTimes.find((lead: any) => {
      if (lead.prefix.includes("-")) {
        const [s, e] = lead.prefix.replace("xxx", "").split("-");
        return prefix2 >= s && prefix2 <= e;
      }
      return lead.prefix.startsWith(prefix2);
    });
    return match ? Number(match.days) : 1;
  }, [formData.postal_code, deliveryLeadTimes]);

  const handleEventDateChange = (val: string) => {
    if (!val) {
      setFormData((p) => ({
        ...p,
        event_start_date: "",
        pickup_date: "",
        return_date: "",
      }));
      return;
    }
    const [y, m, d] = val.split("-").map(Number);
    const eventDate = new Date(y, m - 1, d);
    if (isNaN(eventDate.getTime())) return;
    const pickupD = new Date(eventDate);
    pickupD.setDate(pickupD.getDate() - leadTimeDays);
    const returnD = new Date(eventDate);
    returnD.setDate(returnD.getDate() + (Number(formData.event_days) || 1) + 1);
    setFormData((p) => ({
      ...p,
      event_start_date: val,
      pickup_date: pickupD.toISOString().split("T")[0],
      return_date: returnD.toISOString().split("T")[0],
    }));
  };

  const handleAddLine = () =>
    setProducts([
      ...products,
      { item_sku: "", label: "", quantity: 1, price: 0, deposit: 150000 },
    ]);

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

  const handleRemoveLine = (index: number) =>
    setProducts(products.filter((_, i) => i !== index));

  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const cust = allCustomers.find((c: any) => c.id === custId);
    if (cust?.addresses && cust.addresses.length > 0) {
      const a =
        cust.addresses.find((x: any) => x.is_default) || cust.addresses[0];
      setFormData((p) => ({
        ...p,
        street_address: a.street_address || "",
        city: a.city || "",
        postal_code: a.postal_code || "",
        latitude: a.latitude ?? null,
        longitude: a.longitude ?? null,
      }));
    } else {
      setFormData((p) => ({
        ...p,
        street_address: "",
        city: "",
        postal_code: "",
        latitude: null,
        longitude: null,
      }));
    }
    setIsCustomerDropdownOpen(false);
    setCustomerSearch("");
  };

  const displayCustomerValue = isCustomerDropdownOpen
    ? customerSearch
    : activeCustomer
      ? `${activeCustomer.first_name || ""} ${activeCustomer.last_name || ""} (${activeCustomer.phone || ""})`.trim()
      : "";

  const productsSubtotal = useMemo(
    () =>
      products.reduce(
        (s, p) => s + (Number(p.price) || 0) * (Number(p.quantity) || 1),
        0,
      ),
    [products],
  );
  const totalDeposit = useMemo(
    () =>
      products.reduce(
        (s, p) => s + (Number(p.deposit) || 0) * (Number(p.quantity) || 1),
        0,
      ),
    [products],
  );
  const maxAvailableCredit = Number(activeCustomer?.current_credit) || 0;

  const grandTotal = useMemo(
    () =>
      Math.max(
        0,
        productsSubtotal +
          totalDeposit +
          Number(formData.shipping_fee) -
          Number(formData.store_credit_applied),
      ),
    [
      productsSubtotal,
      totalDeposit,
      formData.shipping_fee,
      formData.store_credit_applied,
    ],
  );

  const missingFields = useMemo(() => {
    const m: string[] = [];
    if (!selectedCustomerId) m.push("Customer");
    if (!formData.event_start_date) m.push("Event Start Date");
    if (!formData.pickup_date) m.push("Pick Up/Send Date");
    if (!formData.return_date) m.push("Return Date");
    if (products.length === 0 || !products[0]?.item_sku)
      m.push("At least one product line");
    return m;
  }, [selectedCustomerId, formData, products]);

  const isComplete = missingFields.length === 0;

  const handleSave = async () => {
    setLoading(true);
    setErrorMsg("");
    const res = await saveOrder({
      ...formData,
      customer_id: selectedCustomerId,
      products,
    });
    if (res?.error) setErrorMsg(res.error);
    else router.refresh();
    setLoading(false);
  };

  const handleStatusTransition = async (newStatus: string) => {
    setLoading(true);
    setErrorMsg("");
    const res = await updateOrderStatus(formData.id, newStatus);
    if (res?.error) setErrorMsg(res.error);
    else {
      setFormData((p) => ({ ...p, status: newStatus }));
      router.refresh();
    }
    setLoading(false);
  };

  const handleOpenBookingModal = () => {
    setBookingStep("preview");
    setBookingError("");
    setBookingResult(null);
  };

  const handleCloseBookingModal = () => {
    if (bookingStep === "booking") return;
    setBookingStep("closed");
  };

  const handleConfirmBooking = async () => {
    setBookingStep("booking");
    setBookingError("");
    const res = await dispatchOrderViaBiteship(formData.id, {
      note: bookingNote,
    });
    if (res?.error) {
      setBookingError(res.error);
      setBookingStep("error");
      return;
    }
    setBookingResult({
      waybill: res.waybill!,
      trackingUrl: res.trackingUrl || null,
      courierCompany: res.courierCompany || "",
      courierType: res.courierType || "",
      price: res.price ?? null,
    });
    setFormData((p) => ({
      ...p,
      status: "In Shipping",
      packing_slip_id: res.waybill || p.packing_slip_id,
    }));
    setBookingStep("success");
    router.refresh();
  };

  const handleBookManually = () => {
    setBookingStep("closed");
    setTimeout(() => waybillInputRef.current?.focus(), 100);
  };

  const handleCopyResi = () => {
    if (!formData.packing_slip_id) return;
    navigator.clipboard.writeText(formData.packing_slip_id);
    setCopiedResi(true);
    setTimeout(() => setCopiedResi(false), 2000);
  };

  const handleCopyWaybill = () => {
    if (!bookingResult?.waybill) return;
    navigator.clipboard.writeText(bookingResult.waybill);
    setCopiedWaybill(true);
    setTimeout(() => setCopiedWaybill(false), 2000);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    await addOrderNote(formData.id, noteText);
    setNoteText("");
    router.refresh();
  };

  const whatsAppInvoiceUrl = useMemo(() => {
    if (!mountedOrigin) return "";
    if (!activeCustomer?.phone) return "";

    let p = String(activeCustomer.phone).replace(/\D/g, "");
    if (p.startsWith("0")) p = "62" + p.slice(1);

    const name =
      `${activeCustomer.first_name || ""} ${activeCustomer.last_name || ""}`.trim() ||
      "Customer";

    const defaultTpl =
      "Hi [CUSTOMER_NAME], thank you for your order [ORDER_ID]! Here is your invoice link: [INVOICE_LINK]. Total: [TOTAL].";
    const tpl = notificationTemplates?.order_posted?.template || defaultTpl;

    const url = `${mountedOrigin}/admin/orders/${formData.id}/invoice`;

    const message = tpl
      .replace(/\[CUSTOMER_NAME\]/g, name)
      .replace(/\[ORDER_ID\]/g, formData.id)
      .replace(/\[INVOICE_LINK\]/g, url)
      .replace(/\[TOTAL\]/g, formatRupiah(grandTotal));

    return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
  }, [
    mountedOrigin,
    activeCustomer,
    formData.id,
    notificationTemplates,
    grandTotal,
  ]);

  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.first_name || !newCustomerForm.phone) {
      alert("First name and Phone are required.");
      return;
    }
    setCustomerModalLoading(true);
    let clean = newCustomerForm.phone.replace(/\D/g, "");
    if (clean.startsWith("0")) clean = "62" + clean.slice(1);
    const res = await createCustomer({ ...newCustomerForm, phone: clean });
    if (res.error) alert(res.error);
    else if (res.customerId) {
      const created = {
        id: res.customerId,
        first_name: newCustomerForm.first_name,
        last_name: newCustomerForm.last_name,
        phone: clean,
        status: "Not Submitted",
        current_credit: 0,
        addresses: [],
      };
      setAllCustomers((prev) => [created, ...prev]);
      setSelectedCustomerId(res.customerId);
      setIsCustomerModalOpen(false);
      setIsCustomerDropdownOpen(false);
      setCustomerSearch("");
      setNewCustomerForm({
        first_name: "",
        last_name: "",
        phone: "",
        gender: "Female",
        dob: "",
      });
    }
    setCustomerModalLoading(false);
  };

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert("Please select a customer first before adding an address.");
      return;
    }
    if (!newAddress.street_address || !newAddress.city) {
      alert("Street address and City are required.");
      return;
    }
    setModalLoading(true);
    const res = await createCustomerAddress({
      customer_id: selectedCustomerId,
      label: newAddress.label,
      street_address: newAddress.street_address,
      city: newAddress.city,
      postal_code: newAddress.postal_code,
      latitude: newAddress.latitude,
      longitude: newAddress.longitude,
      is_default: newAddress.is_default,
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
          if (c.id !== selectedCustomerId) return c;
          const existing = c.addresses || [];
          const updated = newAddress.is_default
            ? existing.map((a: any) => ({ ...a, is_default: false }))
            : existing;
          return { ...c, addresses: [added, ...updated] };
        }),
      );

      setFormData((p) => ({
        ...p,
        street_address: added.street_address,
        city: added.city,
        postal_code: added.postal_code || "",
        latitude: added.latitude ?? null,
        longitude: added.longitude ?? null,
      }));

      setIsAddressModalOpen(false);
      setNewAddress({
        label: "Home",
        street_address: "",
        city: "",
        postal_code: "",
        latitude: null,
        longitude: null,
        is_default: false,
      });
    }
    setModalLoading(false);
  };

  const hasWaybill = Boolean(
    formData.packing_slip_id &&
    ["In Shipping", "Active", "Completed"].includes(formData.status),
  );

  return (
    <div>
      <Link
        href="/admin/orders"
        className="text-[12.5px] text-muted hover:text-wine-ink inline-block mb-2"
      >
        ← Back to Orders
      </Link>

      <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">
        Operations · Orders
      </div>

      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h1 className="font-serif text-[32px] font-normal tracking-[0.01em]">
          {formData.id} {isDraft && "- new"}
        </h1>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded bg-[#EFEBE2] text-muted mr-1">
            {formData.status}
          </span>

          {waPosted && (
            <span
              className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded border bg-[#EAF3E7] text-[#2E7D47] border-[#CAD3C5] flex items-center gap-1"
              title="Order-posted WA notification dispatched"
            >
              <Send className="w-3 h-3" /> WA Sent
            </span>
          )}

          {isDraft && (
            <button
              type="button"
              onClick={() => handleStatusTransition("Ordered")}
              disabled={loading || !isComplete}
              className="px-3.5 py-1.5 bg-ink text-white rounded-lg text-xs font-semibold hover:bg-[#181E15] transition disabled:opacity-50 cursor-pointer"
            >
              Post Order
            </button>
          )}

          {!isDraft && !isWebsite && isSuperAdmin && (
            <button
              type="button"
              onClick={() => handleStatusTransition("Draft")}
              disabled={loading}
              className="px-3 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] cursor-pointer"
            >
              Reset to Draft
            </button>
          )}

          {formData.status === "Ordered" && (
            <button
              type="button"
              onClick={handleOpenBookingModal}
              disabled={
                loading || !isComplete || !canBookAtAll || alreadyDispatched
              }
              title={
                alreadyDispatched
                  ? `Already dispatched (${formData.packing_slip_id})`
                  : !canBookAtAll && bookingWindowOpensOn
                    ? `Bookable from ${bookingWindowOpensOn} (${bookingWindowDays} days before pickup)`
                    : undefined
              }
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm cursor-pointer ${
                canBookAtAll && !alreadyDispatched
                  ? "bg-wine text-white hover:bg-[#181E15]"
                  : "bg-[#EFEBE2] text-muted"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              {alreadyDispatched
                ? "Already Booked"
                : !canBookAtAll
                  ? bookingWindowOpensOn
                    ? `Book from ${bookingWindowOpensOn}`
                    : "Book Biteship"
                  : canBookNow
                    ? "Book Biteship Now"
                    : "Book Biteship"}
            </button>
          )}

          {formData.status === "In Shipping" && (
            <button
              type="button"
              onClick={() => handleStatusTransition("Active")}
              disabled={loading}
              className="px-3.5 py-1.5 bg-ok-bg text-ok border border-ok/30 rounded-lg text-xs font-semibold hover:bg-ok-bg/80 cursor-pointer"
            >
              Mark Active
            </button>
          )}

          {formData.status !== "Cancelled" && (
            <button
              type="button"
              onClick={() => handleStatusTransition("Cancelled")}
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

          {whatsAppInvoiceUrl && (
            <a
              href={whatsAppInvoiceUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 border border-line bg-card rounded-lg text-xs font-medium hover:bg-[#F6F4EF] flex items-center gap-1 text-[#25D366]"
              title="Send Invoice to Customer WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WA Invoice
            </a>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-1.5 bg-wine text-white rounded-lg text-xs font-medium hover:bg-[#181E15] transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 text-xs bg-bad-bg border border-[#D9A79C] text-bad rounded-lg">
          {errorMsg}
        </div>
      )}

      {isWebsite && (
        <div className="mb-4 p-3 bg-[#F6F4EF] border border-[#CAD3C5] rounded-xl text-xs text-wine-ink flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-muted flex-shrink-0" />
          <span>
            <strong>Website Storefront Order:</strong> Customer, schedule, and
            fulfillment details are automated and locked against manual edits.
          </span>
        </div>
      )}

      {/* Customer & Schedule + Fulfilment columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* LEFT COLUMN — customer + schedule */}
        <div className="bg-card border border-line rounded-[10px] p-5">
          <h3 className="font-serif text-[18px] font-normal mb-3">
            Customer & schedule
          </h3>
          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] tracking-[0.14em] uppercase text-muted font-medium">
                  Customer <span className="text-bad">*</span>
                </label>
                {!isWebsite && !isAddressLocked && (
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="text-[11px] font-semibold text-wine-ink hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />+ Create Customer
                  </button>
                )}
              </div>
              <div ref={customerDropdownRef} className="relative">
                <input
                  type="text"
                  disabled={
                    isWebsite || (!isDraft && !isSuperAdmin) || isAddressLocked
                  }
                  value={displayCustomerValue}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onFocus={() => {
                    if (!isWebsite && !isAddressLocked) {
                      setIsCustomerDropdownOpen(true);
                      setCustomerSearch("");
                    }
                  }}
                  placeholder="Search customer name or phone..."
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-1 focus:ring-wine focus:outline-none disabled:bg-[#F6F4EF]"
                />
                {isCustomerDropdownOpen && !isWebsite && !isAddressLocked && (
                  <div className="absolute z-30 w-full mt-1 bg-white border border-line rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomerModalOpen(true);
                        setIsCustomerDropdownOpen(false);
                        setCustomerSearch("");
                      }}
                      className="w-full text-left px-3 py-2.5 text-xs font-semibold text-wine-ink hover:bg-[#F6F4EF] border-b border-line flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />+ Add Customer
                    </button>
                    {filteredCustomers.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-muted text-center">
                        No customers match your search.
                      </div>
                    ) : (
                      filteredCustomers.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleCustomerSelect(c.id)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[#F6F4EF] border-b border-line last:border-none"
                        >
                          <div className="font-medium text-ink">
                            {c.first_name} {c.last_name || ""}
                          </div>
                          <div className="text-muted text-[11px] font-mono">
                            {c.phone}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Phone
                </label>
                <input
                  disabled
                  value={activeCustomer?.phone || ""}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#F6F4EF] text-muted font-mono"
                />
              </div>
              <div className="flex items-end">
                <a
                  href={`https://wa.me/${(activeCustomer?.phone || "").replace(/\D/g, "").replace(/^0/, "62")}`}
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
                  disabled={isWebsite || (!isDraft && !isSuperAdmin)}
                  value={formData.order_date}
                  onChange={(e) =>
                    setFormData({ ...formData, order_date: e.target.value })
                  }
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Event Start Date <span className="text-bad">*</span>
                </label>
                <input
                  type="date"
                  disabled={isWebsite || isAddressLocked}
                  value={formData.event_start_date}
                  onChange={(e) => handleEventDateChange(e.target.value)}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Event Days
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={isWebsite || isAddressLocked}
                  value={formData.event_days}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      event_days: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Pick Up / Send Date <span className="text-bad">*</span>
                </label>
                <input
                  type="date"
                  disabled={isWebsite || isAddressLocked}
                  value={formData.pickup_date}
                  onChange={(e) =>
                    setFormData({ ...formData, pickup_date: e.target.value })
                  }
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
                disabled={isWebsite || isAddressLocked}
                value={formData.return_date}
                onChange={(e) =>
                  setFormData({ ...formData, return_date: e.target.value })
                }
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
              />
            </div>

            <div className="pt-2 border-t border-line">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] tracking-[0.14em] uppercase text-muted font-medium flex items-center gap-1">
                  Delivery Address <span className="text-bad">*</span>
                  {isAddressLocked && (
                    <Lock className="w-3 h-3 text-muted ml-0.5" />
                  )}
                </label>
                {!isWebsite && !isAddressLocked && selectedCustomerId && (
                  <button
                    type="button"
                    onClick={() => setIsAddressModalOpen(true)}
                    className="text-[11px] font-semibold text-wine-ink hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add New Address
                  </button>
                )}
              </div>

              {customerAddresses.length > 0 ? (
                <div className="mb-2">
                  <select
                    disabled={isWebsite || isAddressLocked}
                    value={
                      customerAddresses.find(
                        (a) => a.street_address === formData.street_address,
                      )?.id || ""
                    }
                    onChange={(e) => {
                      const addr = customerAddresses.find(
                        (a: any) => String(a.id) === e.target.value,
                      );
                      if (addr) {
                        setFormData((prev) => ({
                          ...prev,
                          street_address: addr.street_address || "",
                          city: addr.city || "",
                          postal_code: addr.postal_code || "",
                          latitude: addr.latitude ?? null,
                          longitude: addr.longitude ?? null,
                        }));
                      }
                    }}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                  >
                    <option value="">
                      — Select Saved Address ({customerAddresses.length}) —
                    </option>
                    {customerAddresses.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.label} — {a.street_address}, {a.city}{" "}
                        {a.postal_code ? `(${a.postal_code})` : ""}
                        {a.is_default ? " · Default" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <textarea
                rows={2}
                disabled={isWebsite || isAddressLocked}
                placeholder="Street name, house/building number, unit..."
                value={formData.street_address}
                onChange={(e) =>
                  setFormData({ ...formData, street_address: e.target.value })
                }
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
              />

              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  placeholder="City"
                  disabled={isWebsite || isAddressLocked}
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  className="text-xs border border-line rounded px-2.5 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                />
                <input
                  placeholder="Postal Code"
                  disabled={isWebsite || isAddressLocked}
                  value={formData.postal_code}
                  onChange={(e) =>
                    setFormData({ ...formData, postal_code: e.target.value })
                  }
                  className="text-xs border border-line rounded px-2.5 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — Fulfilment & payment */}
        <div className="bg-card border border-line rounded-[10px] p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-serif text-[18px] font-normal mb-3">
              Fulfilment & payment
            </h3>
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Order Method
                  </label>
                  <select
                    disabled={isWebsite || (!isDraft && !isSuperAdmin)}
                    value={formData.order_method}
                    onChange={(e) =>
                      setFormData({ ...formData, order_method: e.target.value })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                  >
                    <option value="Manual">Manual</option>
                    <option value="Website">Website</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Status
                  </label>
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
                  disabled={isWebsite || isAddressLocked}
                  value={formData.pick_up_method}
                  onChange={(e) =>
                    setFormData({ ...formData, pick_up_method: e.target.value })
                  }
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

              {hasWaybill ? (
                <div className="border border-[#CAD3C5] bg-[#F2F6EF] rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-[#2E7D47]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Booked & In Shipping
                    </div>
                    <span className="text-[10px] font-mono font-semibold text-ink uppercase">
                      {formData.pick_up_method || "Courier"}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-wider uppercase text-muted mb-0.5">
                      Waybill / Resi
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-bold text-ink flex-1 truncate">
                        {formData.packing_slip_id}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyResi}
                        className="flex-shrink-0 p-1.5 border border-line bg-white rounded-md hover:bg-[#F6F4EF] transition cursor-pointer"
                        title="Copy waybill"
                      >
                        {copiedResi ? (
                          <Check className="w-3.5 h-3.5 text-ok" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    <Link
                      href={`/admin/orders/${formData.id}/label`}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1F16] text-white rounded-lg text-xs font-medium hover:bg-black transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Label
                    </Link>
                    {initialOrder.return_label_url && (
                      <a
                        href={initialOrder.return_label_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-line bg-white rounded-lg text-xs font-medium hover:bg-[#F6F4EF] transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Track Package
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Packing Slip ID / Waybill
                  </label>
                  <input
                    ref={waybillInputRef}
                    disabled={isWebsite}
                    placeholder="— fills on dispatch or Biteship booking"
                    value={formData.packing_slip_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        packing_slip_id: e.target.value,
                      })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                  />
                  <p className="text-[10.5px] text-muted mt-1">
                    Or use the Book Biteship button above to auto-fill via
                    courier.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Payment Method
                </label>
                <select
                  disabled={isWebsite}
                  value={formData.payment_method}
                  onChange={(e) =>
                    setFormData({ ...formData, payment_method: e.target.value })
                  }
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]"
                >
                  <option value="QRIS (EDC)">QRIS (EDC)</option>
                  <option value="Bank Transfer - BCA">
                    Bank Transfer - BCA
                  </option>
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product line items */}
      <div className="bg-card border border-line rounded-[10px] p-5 mb-4">
        <h3 className="font-serif text-[18px] font-normal mb-3">
          Product <span className="text-bad">*</span>
        </h3>
        <div className="space-y-2.5 mb-3">
          <div className="hidden sm:grid grid-cols-12 gap-2.5 px-0.5 text-[10px] uppercase tracking-[0.14em] text-muted font-medium pb-2 border-b border-line items-center">
            <div className="col-span-3">Product SKU</div>
            <div className="col-span-4">Product Label</div>
            <div className="col-span-1 text-center">Qty</div>
            <div className="col-span-2 text-right">Price (Locked)</div>
            <div className="col-span-1 text-right">Deposit</div>
            <div className="col-span-1"></div>
          </div>

          {products.map((p, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2.5 items-center">
              <div className="col-span-3">
                <ProductSkuSelect
                  value={p.item_sku}
                  selectedLabel={p.label}
                  disabled={isWebsite || isAddressLocked}
                  allItems={allItems}
                  onSelect={(sku) => handleProductSelect(idx, sku)}
                />
              </div>
              <div className="col-span-4">
                <input
                  value={p.label}
                  readOnly
                  placeholder="Auto-fills from SKU"
                  className="w-full text-xs border border-line rounded-lg px-2.5 py-1.5 bg-[#F6F4EF] text-muted truncate"
                />
              </div>
              <div className="col-span-1">
                <input
                  type="number"
                  min={1}
                  disabled={isWebsite || isAddressLocked}
                  value={p.quantity}
                  onChange={(e) => {
                    const next = [...products];
                    next[idx].quantity = parseInt(e.target.value) || 1;
                    setProducts(next);
                  }}
                  className="w-full text-center text-xs border border-line rounded-lg py-1.5 bg-[#FDFCFA] focus:ring-1 focus:ring-wine focus:outline-none disabled:bg-[#F6F4EF]"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="text"
                  disabled
                  value={formatRupiah(p.price)}
                  className="w-full text-right text-xs border border-line rounded-lg px-2.5 py-1.5 bg-[#F6F4EF] text-muted font-medium font-tabular-nums"
                />
              </div>
              <div className="col-span-1">
                <input
                  type="text"
                  disabled
                  value={formatRupiah(p.deposit)}
                  className="w-full text-right text-xs border border-line rounded-lg px-2.5 py-1.5 bg-[#F6F4EF] text-muted font-medium font-tabular-nums"
                />
              </div>
              <div className="col-span-1 flex justify-end">
                {!isWebsite && !isAddressLocked && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    aria-label="Remove line"
                    className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-bad hover:bg-bad-bg/40 transition cursor-pointer text-base leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {!isWebsite && !isAddressLocked && (
          <button
            type="button"
            onClick={handleAddLine}
            className="text-xs font-semibold text-wine-ink hover:underline cursor-pointer"
          >
            + add a line
          </button>
        )}
      </div>

      {/* Financial summary */}
      <div className="bg-card border border-line rounded-[10px] p-5 mb-4">
        <h3 className="font-serif text-[18px] font-normal mb-3">
          Financial summary
        </h3>
        <div className="divide-y divide-line max-w-xl text-[13px]">
          <div className="flex justify-between py-2">
            <span className="text-muted">Products subtotal</span>
            <span className="font-medium">
              {formatRupiah(productsSubtotal)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-muted">Shipping fee (ongkir)</span>
            <RupiahInput
              value={formData.shipping_fee}
              onChange={(v) => setFormData({ ...formData, shipping_fee: v })}
              disabled={isWebsite || isAddressLocked}
              className="w-32 text-right"
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
                  Remaining available: {formatRupiah(maxAvailableCredit)}
                </div>
              )}
            </div>
            <RupiahInput
              value={formData.store_credit_applied}
              onChange={(v) => {
                const clamped = Math.max(0, Math.min(maxAvailableCredit, v));
                setFormData({ ...formData, store_credit_applied: clamped });
              }}
              disabled={isWebsite || isAddressLocked}
              className="w-32 text-right"
            />
          </div>
          <div className="flex justify-between py-3 text-base font-serif font-bold text-ink">
            <span>Total</span>
            <span>{formatRupiah(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Notes + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-line rounded-[10px] p-5 flex flex-col">
          <h3 className="font-serif text-[18px] font-normal mb-1">
            Log Note{" "}
            <span className="text-[12px] text-muted font-sans">
              - internal team only
            </span>
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
          <h3 className="font-serif text-[18px] font-normal mb-3">
            Activity log
          </h3>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-muted">No changes recorded yet.</p>
          ) : (
            <ul className="space-y-2.5 text-xs">
              {auditLogs.map((log: any) => (
                <li
                  key={log.id}
                  className="border-b border-line pb-1.5 last:border-none"
                >
                  <span className="font-semibold">{log.admin_name}</span>:{" "}
                  {log.action_type}{" "}
                  {log.new_value && (
                    <span className="text-wine-ink font-medium">
                      ({log.new_value})
                    </span>
                  )}
                  <span className="text-muted ml-1">
                    · {formatLogDate(log.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* BOOKING MODAL */}
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
                      Confirm Courier Booking
                    </h3>
                    <p className="text-[12px] text-muted mt-0.5">
                      Review the details before dispatching to the courier.
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
                  <div>
                    <div className="text-[10px] tracking-wider uppercase text-muted font-bold mb-1">
                      From
                    </div>
                    <div className="text-[13px] font-medium text-ink">
                      KORA Showroom
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-wider uppercase text-muted font-bold mb-1">
                      To
                    </div>
                    <div className="text-[13px] font-medium text-ink">
                      {activeCustomer?.first_name} {activeCustomer?.last_name}
                    </div>
                    <div className="text-muted mt-0.5">
                      {formData.street_address}, {formData.city}{" "}
                      {formData.postal_code}
                    </div>
                    <div className="text-muted font-mono mt-0.5">
                      {activeCustomer?.phone}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <div className="text-[10px] tracking-wider uppercase text-muted font-bold mb-1">
                        Courier
                      </div>
                      <div className="text-[13px] font-medium text-ink">
                        {formData.pick_up_method}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] tracking-wider uppercase text-muted font-bold mb-1">
                        Scheduled Pickup
                      </div>
                      <div className="text-[13px] font-medium text-ink">
                        {formData.pickup_date || "—"}
                      </div>
                    </div>
                  </div>
                  <div className="pt-1">
                    <div className="text-[10px] tracking-wider uppercase text-muted font-bold mb-1.5">
                      Items ({products.length})
                    </div>
                    <div className="border border-line rounded-lg divide-y divide-line">
                      {products.map((p, i) => (
                        <div
                          key={i}
                          className="px-3 py-2 flex justify-between text-[12px]"
                        >
                          <span className="font-mono font-bold text-ink">
                            {p.item_sku}
                          </span>
                          <span className="text-muted truncate ml-3 flex-1">
                            {p.label}
                          </span>
                          <span className="text-muted font-mono ml-3">
                            ×{p.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
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
                    onClick={handleConfirmBooking}
                    className="px-4 py-2 bg-wine text-white rounded-lg text-xs font-semibold hover:bg-[#181E15] transition cursor-pointer flex items-center gap-1.5"
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
                        Booked successfully
                      </h3>
                      <p className="text-[12px] text-muted mt-0.5">
                        {bookingResult.courierCompany
                          ? `${bookingResult.courierCompany.toUpperCase()} · ${bookingResult.courierType}`
                          : "Courier booked"}
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
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Link
                      href={`/admin/orders/${formData.id}/label`}
                      target="_blank"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1A1F16] text-white rounded-lg text-xs font-medium hover:bg-black transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Label
                    </Link>
                    {bookingResult.trackingUrl && (
                      <a
                        href={bookingResult.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-line bg-white rounded-lg text-xs font-medium hover:bg-[#F6F4EF] transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Track Package
                      </a>
                    )}
                  </div>
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
                        The courier could not be booked automatically.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3 text-xs">
                  <div className="p-3 bg-bad-bg border border-[#D9A79C] text-bad rounded-lg text-[12px] leading-relaxed">
                    {bookingError}
                  </div>
                  <p className="text-muted text-[11.5px] leading-relaxed">
                    You can retry the automatic booking, or obtain a waybill
                    from the Biteship dashboard and paste it manually below.
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
                    onClick={handleBookManually}
                    className="px-4 py-2 border border-line bg-white rounded-lg text-xs font-medium hover:bg-[#F6F4EF] transition cursor-pointer"
                  >
                    Book Manually Instead
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBooking}
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

      {/* MODAL: CREATE CUSTOMER */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSaveQuickCustomer}
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-line animate-in fade-in zoom-in-95"
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-serif text-[20px]">New Customer Profile</h3>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-muted hover:text-ink p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] tracking-wider uppercase text-muted mb-1">
                    First Name <span className="text-bad">*</span>
                  </label>
                  <input
                    required
                    value={newCustomerForm.first_name}
                    onChange={(e) =>
                      setNewCustomerForm({
                        ...newCustomerForm,
                        first_name: e.target.value,
                      })
                    }
                    className="w-full border border-line rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] tracking-wider uppercase text-muted mb-1">
                    Last Name
                  </label>
                  <input
                    value={newCustomerForm.last_name}
                    onChange={(e) =>
                      setNewCustomerForm({
                        ...newCustomerForm,
                        last_name: e.target.value,
                      })
                    }
                    className="w-full border border-line rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] tracking-wider uppercase text-muted mb-1">
                  Phone (WhatsApp) <span className="text-bad">*</span>
                </label>
                <input
                  required
                  placeholder="e.g. 628123456789"
                  value={newCustomerForm.phone}
                  onChange={(e) =>
                    setNewCustomerForm({
                      ...newCustomerForm,
                      phone: e.target.value,
                    })
                  }
                  className="w-full border border-line rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] tracking-wider uppercase text-muted mb-1">
                    Gender
                  </label>
                  <select
                    value={newCustomerForm.gender}
                    onChange={(e) =>
                      setNewCustomerForm({
                        ...newCustomerForm,
                        gender: e.target.value,
                      })
                    }
                    className="w-full border border-line rounded-lg px-3 py-2"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] tracking-wider uppercase text-muted mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    max="9999-12-31"
                    value={newCustomerForm.dob}
                    onChange={(e) => {
                      let val = e.target.value;
                      const parts = val.split("-");
                      if (parts[0] && parts[0].length > 4)
                        parts[0] = parts[0].slice(0, 4);
                      setNewCustomerForm({
                        ...newCustomerForm,
                        dob: parts.join("-"),
                      });
                    }}
                    className="w-full border border-line rounded-lg px-3 py-2"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="px-3.5 py-1.5 border border-line rounded-lg text-xs font-medium hover:bg-[#F6F4EF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={customerModalLoading}
                className="px-4 py-1.5 bg-wine text-white rounded-lg text-xs font-medium hover:bg-[#181E15] disabled:opacity-50"
              >
                {customerModalLoading ? "Creating..." : "Create & Select"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD ADDRESS — now with AddressMapPicker, matching the customer page */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-card border border-line rounded-xl w-full max-w-xl p-6 shadow-xl relative my-8 animate-in fade-in zoom-in-95">
            <h2 className="font-serif text-[22px] font-normal mb-1">
              Tambah Alamat Baru
            </h2>
            <p className="text-[13px] text-muted mb-4">
              Cari alamat atau geser pin pada peta untuk melengkapi koordinat
              pengiriman Biteship.
            </p>

            <form onSubmit={handleSaveNewAddress} className="space-y-3.5">
              <AddressMapPicker
                initialData={newAddress}
                onChange={(loc) => {
                  setNewAddress((prev) => ({
                    ...prev,
                    street_address: loc.street_address || prev.street_address,
                    city: loc.city || prev.city,
                    postal_code: loc.postal_code || prev.postal_code,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                  }));
                }}
              />

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Label Alamat
                  </label>
                  <input
                    value={newAddress.label}
                    placeholder="Rumah, Kantor, Studio..."
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, label: e.target.value })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Kota <span className="text-bad">*</span>
                  </label>
                  <input
                    required
                    value={newAddress.city}
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, city: e.target.value })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Alamat Lengkap <span className="text-bad">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={newAddress.street_address}
                  onChange={(e) =>
                    setNewAddress({
                      ...newAddress,
                      street_address: e.target.value,
                    })
                  }
                  placeholder="Nama jalan, nomor rumah, RT/RW, patokan..."
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Kode Pos
                  </label>
                  <input
                    value={newAddress.postal_code}
                    onChange={(e) =>
                      setNewAddress({
                        ...newAddress,
                        postal_code: e.target.value,
                      })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newAddress.latitude ?? ""}
                    onChange={(e) =>
                      setNewAddress({
                        ...newAddress,
                        latitude: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newAddress.longitude ?? ""}
                    onChange={(e) =>
                      setNewAddress({
                        ...newAddress,
                        longitude: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="order_addr_default"
                  checked={newAddress.is_default}
                  onChange={(e) =>
                    setNewAddress({
                      ...newAddress,
                      is_default: e.target.checked,
                    })
                  }
                  className="rounded border-line text-wine focus:ring-wine"
                />
                <label
                  htmlFor="order_addr_default"
                  className="text-xs text-ink cursor-pointer"
                >
                  Jadikan alamat utama (Default address)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="px-4 py-2 border border-line rounded-lg text-xs font-medium hover:bg-[#F6F4EF] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 bg-wine text-white rounded-lg text-xs font-medium hover:bg-[#181E15] disabled:opacity-50 cursor-pointer"
                >
                  {modalLoading ? "Menyimpan..." : "Simpan Alamat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

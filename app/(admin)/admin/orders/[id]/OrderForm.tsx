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
  Clock,
  MapPin,
  Plus,
  Lock,
  Search,
  X,
  UserPlus,
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

// ---------------------------------------------------------------------------
// Inline searchable SKU selector for product line items
// ---------------------------------------------------------------------------
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
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
  auditLogs,
  currentAdmin,
}: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [noteText, setNoteText] = useState("");
  const [copiedResi, setCopiedResi] = useState(false);

  const [allCustomers, setAllCustomers] = useState<any[]>(initialCustomers);

  const isSuperAdmin =
    currentAdmin?.role?.toLowerCase().replace(/[\s_-]+/g, "") === "superadmin";
  const isDraft = initialOrder.status === "Draft";
  const isWebsite = initialOrder.order_method === "Website";

  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialOrder.customer_id || "",
  );

  // Searchable customer combobox state
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCustomerDropdownOpen(false);
        setCustomerSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeCustomer = useMemo(() => {
    return (
      allCustomers.find((c: any) => c.id === selectedCustomerId) ||
      initialOrder.customers
    );
  }, [allCustomers, selectedCustomerId, initialOrder.customers]);

  const customerAddresses: any[] = useMemo(() => {
    return activeCustomer?.addresses || [];
  }, [activeCustomer]);

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
    setFormData((prev) => ({
      ...prev,
      id: initialOrder.id,
      order_date: initialOrder.order_date || prev.order_date,
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
  }, [initialOrder]);

  const isAddressLocked = useMemo(() => {
    return (
      isWebsite ||
      ["In Shipping", "Active", "Completed"].includes(formData.status) ||
      Boolean(formData.packing_slip_id)
    );
  }, [isWebsite, formData.status, formData.packing_slip_id]);

  // Modal: Add New Address
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [geocodingError, setGeocodingError] = useState("");
  const [newAddress, setNewAddress] = useState({
    label: "Home",
    street_address: "",
    city: "",
    postal_code: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });

  // Modal: Create Customer from Order
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

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const isPickupTodayOrPast = Boolean(
    formData.pickup_date && formData.pickup_date <= todayStr,
  );
  const isPickupFuture = Boolean(
    formData.pickup_date && formData.pickup_date > todayStr,
  );

  const leadTimeDays = useMemo(() => {
    if (!formData.postal_code) return 1;
    const prefix2 = formData.postal_code.slice(0, 2);
    const match = deliveryLeadTimes.find((lead: any) => {
      if (lead.prefix.includes("-")) {
        const [start, end] = lead.prefix.replace("xxx", "").split("-");
        return prefix2 >= start && prefix2 <= end;
      }
      return lead.prefix.startsWith(prefix2);
    });
    return match ? Number(match.days) : 1;
  }, [formData.postal_code, deliveryLeadTimes]);

  const handleEventDateChange = (val: string) => {
    if (!val) {
      setFormData((prev) => ({
        ...prev,
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

    setFormData((prev) => ({
      ...prev,
      event_start_date: val,
      pickup_date: pickupD.toISOString().split("T")[0],
      return_date: returnD.toISOString().split("T")[0],
    }));
  };

  const handleAddLine = () => {
    setProducts([
      ...products,
      { item_sku: "", label: "", quantity: 1, price: 0, deposit: 150000 },
    ]);
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

  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const cust = allCustomers.find((c: any) => c.id === custId);

    if (cust?.addresses && cust.addresses.length > 0) {
      const defaultAddr =
        cust.addresses.find((a: any) => a.is_default) || cust.addresses[0];
      setFormData((prev) => ({
        ...prev,
        street_address: defaultAddr.street_address || "",
        city: defaultAddr.city || "",
        postal_code: defaultAddr.postal_code || "",
        latitude: defaultAddr.latitude ?? null,
        longitude: defaultAddr.longitude ?? null,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
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

  const productsSubtotal = useMemo(() => {
    return products.reduce(
      (sum, p) => sum + (Number(p.price) || 0) * (Number(p.quantity) || 1),
      0,
    );
  }, [products]);

  const totalDeposit = useMemo(() => {
    return products.reduce(
      (sum, p) => sum + (Number(p.deposit) || 0) * (Number(p.quantity) || 1),
      0,
    );
  }, [products]);

  const maxAvailableCredit = Number(activeCustomer?.current_credit) || 0;

  const grandTotal = useMemo(() => {
    return Math.max(
      0,
      productsSubtotal +
        totalDeposit +
        Number(formData.shipping_fee) -
        Number(formData.store_credit_applied),
    );
  }, [
    productsSubtotal,
    totalDeposit,
    formData.shipping_fee,
    formData.store_credit_applied,
  ]);

  const missingFields = useMemo(() => {
    const m = [];
    if (!selectedCustomerId) m.push("Customer");
    if (!formData.event_start_date) m.push("Event Start Date");
    if (!formData.pickup_date) m.push("Pick Up/Send Date");
    if (!formData.return_date) m.push("Return Date");
    if (products.length === 0 || !products[0]?.item_sku)
      m.push("At least one product line");
    return m;
  }, [
    selectedCustomerId,
    formData.event_start_date,
    formData.pickup_date,
    formData.return_date,
    products,
  ]);

  const isComplete = missingFields.length === 0;

  const handleSave = async () => {
    setLoading(true);
    setErrorMsg("");
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
    setErrorMsg("");
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
          `Are you sure you want to summon the courier today anyway?`,
      );
      if (!confirmEarly) return;
    } else {
      if (
        !confirm(
          "Book courier pickup via Biteship now? Ensure parcel is packed and sealed.",
        )
      )
        return;
    }

    setDispatching(true);
    setErrorMsg("");
    const res = await dispatchOrderViaBiteship(formData.id);
    if (res?.error) {
      setErrorMsg(res.error);
    } else {
      setFormData((prev) => ({
        ...prev,
        status: "In Shipping",
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
    setNoteText("");
    router.refresh();
  };

  // WhatsApp Invoice Automation Link Generator
  const whatsAppInvoiceUrl = useMemo(() => {
    if (!activeCustomer?.phone) return "";
    let rawPhone = String(activeCustomer.phone).replace(/\D/g, "");
    if (rawPhone.startsWith("0")) rawPhone = "62" + rawPhone.slice(1);
    const custName =
      `${activeCustomer.first_name || ""} ${activeCustomer.last_name || ""}`.trim() ||
      "Customer";

    const defaultTpl =
      "Hi [CUSTOMER_NAME], thank you for your order [ORDER_ID]! Here is your invoice link: [INVOICE_LINK]. Total: [TOTAL].";
    const rawTemplate =
      notificationTemplates?.order_posted?.template || defaultTpl;
    const invoiceUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/admin/orders/${formData.id}/invoice`
        : `https://kora.com/orders/${formData.id}/invoice`;

    const message = rawTemplate
      .replace(/\[CUSTOMER_NAME\]/g, custName)
      .replace(/\[ORDER_ID\]/g, formData.id)
      .replace(/\[INVOICE_LINK\]/g, invoiceUrl)
      .replace(/\[TOTAL\]/g, formatRupiah(grandTotal));

    return `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`;
  }, [activeCustomer, formData.id, notificationTemplates, grandTotal]);

  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.first_name || !newCustomerForm.phone) {
      alert("First name and Phone are required.");
      return;
    }
    setCustomerModalLoading(true);

    let cleanPhone = newCustomerForm.phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "62" + cleanPhone.slice(1);

    const res = await createCustomer({
      ...newCustomerForm,
      phone: cleanPhone,
    });

    if (res.error) {
      alert(res.error);
    } else if (res.customerId) {
      const created = {
        id: res.customerId,
        first_name: newCustomerForm.first_name,
        last_name: newCustomerForm.last_name,
        phone: cleanPhone,
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

  const handleGeocodeSearch = async () => {
    const query =
      `${newAddress.street_address}, ${newAddress.city}, Indonesia`.trim();
    if (!query || query.length < 5) {
      setGeocodingError("Please enter street address and city first.");
      return;
    }

    setGeocodingLoading(true);
    setGeocodingError("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
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
        setGeocodingError(
          "Location pin not found. Check address spelling or enter coordinates manually.",
        );
      }
    } catch {
      setGeocodingError("Network error connecting to geocoder.");
    } finally {
      setGeocodingLoading(false);
    }
  };

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert("Please select a customer first before adding an address.");
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
        }),
      );

      setFormData((prev) => ({
        ...prev,
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
      });
    }

    setModalLoading(false);
  };

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

      {/* Header & Lifecycle Ribbon */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h1 className="font-serif text-[32px] font-normal tracking-[0.01em]">
          {formData.id} {isDraft && "- new"}
        </h1>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded bg-[#EFEBE2] text-muted mr-1">
            {formData.status}
          </span>

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
              onClick={handleBiteshipBooking}
              disabled={dispatching || loading || !isComplete}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm cursor-pointer ${
                isPickupTodayOrPast
                  ? "bg-wine text-white hover:bg-[#181E15]"
                  : "bg-[#F4EBE6] text-[#8C2C1D] border border-[#E5CAC3] hover:bg-[#EEDFD8]"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              {dispatching
                ? "Booking Biteship..."
                : isPickupTodayOrPast
                  ? "Book Biteship Now"
                  : "Book Biteship (Early)"}
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

      {/* 2-Column Main Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* LEFT COLUMN: Customer & Schedule */}
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

            {/* Delivery Address */}
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
                    <Plus className="w-3 h-3" />
                    Add New Address
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

        {/* RIGHT COLUMN: Fulfilment & Payment */}
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

              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Packing Slip ID / Waybill
                </label>
                <input
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
              </div>

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

      {/* Product Line Items (Price & Deposit LOCKED) */}
      <div className="bg-card border border-line rounded-[10px] p-5 mb-4">
        <h3 className="font-serif text-[18px] font-normal mb-3">
          Product <span className="text-bad">*</span>
        </h3>

        <div className="space-y-2.5 mb-3">
          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-12 gap-2.5 px-0.5 text-[10px] uppercase tracking-[0.14em] text-muted font-medium pb-2 border-b border-line items-center">
            <div className="col-span-3">Product SKU</div>
            <div className="col-span-4">Product Label</div>
            <div className="col-span-1 text-center">Qty</div>
            <div className="col-span-2 text-right">Price (Locked)</div>
            <div className="col-span-1 text-right">Deposit</div>
            <div className="col-span-1"></div>
          </div>

          {/* Line item rows */}
          {products.map((p, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2.5 items-center">
              {/* SKU — searchable */}
              <div className="col-span-3">
                <ProductSkuSelect
                  value={p.item_sku}
                  selectedLabel={p.label}
                  disabled={isWebsite || isAddressLocked}
                  allItems={allItems}
                  onSelect={(sku) => handleProductSelect(idx, sku)}
                />
              </div>

              {/* Label (read-only) */}
              <div className="col-span-4">
                <input
                  value={p.label}
                  readOnly
                  placeholder="Auto-fills from SKU"
                  className="w-full text-xs border border-line rounded-lg px-2.5 py-1.5 bg-[#F6F4EF] text-muted truncate"
                />
              </div>

              {/* Quantity */}
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

              {/* Price (locked) */}
              <div className="col-span-2">
                <input
                  type="text"
                  disabled
                  value={formatRupiah(p.price)}
                  className="w-full text-right text-xs border border-line rounded-lg px-2.5 py-1.5 bg-[#F6F4EF] text-muted font-medium font-tabular-nums"
                />
              </div>

              {/* Deposit (locked) */}
              <div className="col-span-1">
                <input
                  type="text"
                  disabled
                  value={formatRupiah(p.deposit)}
                  className="w-full text-right text-xs border border-line rounded-lg px-2.5 py-1.5 bg-[#F6F4EF] text-muted font-medium font-tabular-nums"
                />
              </div>

              {/* Remove row */}
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

      {/* Financial Summary */}
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
                // Strictly cap store credit to customer's available balance
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

      {/* Team Notes & Activity Log */}
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
                    · {new Date(log.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* MODAL: CREATE CUSTOMER QUICKLY */}
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
                <span className="text-[10px] text-muted mt-0.5 block">
                  Must start with country code (e.g. 628... or 614...)
                </span>
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

      {/* MODAL: ADD ADDRESS */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSaveNewAddress}
            className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-line max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-serif text-[20px]">Add Customer Address</h3>
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
                  onChange={(e) =>
                    setNewAddress({ ...newAddress, label: e.target.value })
                  }
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
                  onChange={(e) =>
                    setNewAddress({
                      ...newAddress,
                      street_address: e.target.value,
                    })
                  }
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
                    onChange={(e) =>
                      setNewAddress({ ...newAddress, city: e.target.value })
                    }
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
                    onChange={(e) =>
                      setNewAddress({
                        ...newAddress,
                        postal_code: e.target.value,
                      })
                    }
                    className="w-full border border-line rounded-lg px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setIsAddressModalOpen(false)}
                className="px-3.5 py-1.5 border border-line rounded-lg text-xs font-medium hover:bg-[#F6F4EF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalLoading}
                className="px-4 py-1.5 bg-wine text-white rounded-lg text-xs font-medium hover:bg-[#181E15] disabled:opacity-50"
              >
                {modalLoading ? "Saving..." : "Save & Select Address"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

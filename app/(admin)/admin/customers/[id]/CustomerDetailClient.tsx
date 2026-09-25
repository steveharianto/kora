"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import {
  updateCustomer,
  deleteCustomer,
  saveAddress,
  deleteAddress,
  setDefaultAddress,
  reviewKtp,
} from "@/app/actions/customers";
import { formatRupiah } from "@/lib/utils";
import AddressMapPicker from "@/components/AddressMapPicker";
import RupiahInput from "@/components/RupiahInput";

export default function CustomerDetailClient({
  customer,
  addresses,
  ktpLogs,
  ktpPhotoUrl,
  orders,
  auditLogs,
}: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // KTP review state
  const [ktpNotes, setKtpNotes] = useState("");
  const [ktpBusy, setKtpBusy] = useState(false);
  const [ktpFlash, setKtpFlash] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Profile Form State
  const [profile, setProfile] = useState({
    first_name: customer.first_name || "",
    last_name: customer.last_name || "",
    phone: customer.phone || "",
    gender: customer.gender || "",
    dob: customer.dob || "",
    status: customer.status || "Not Submitted",
    current_credit: customer.current_credit || 0,
  });

  // Keep state in sync with server prop refreshes
  useEffect(() => {
    setProfile({
      first_name: customer.first_name || "",
      last_name: customer.last_name || "",
      phone: customer.phone || "",
      gender: customer.gender || "",
      dob: customer.dob || "",
      status: customer.status || "Not Submitted",
      current_credit: customer.current_credit || 0,
    });
  }, [customer]);

  // Auto-clear the KTP flash after a few seconds
  useEffect(() => {
    if (!ktpFlash) return;
    const t = setTimeout(() => setKtpFlash(null), 4000);
    return () => clearTimeout(t);
  }, [ktpFlash]);

  // Address Modal State
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const [addressForm, setAddressForm] = useState({
    label: "Home",
    street_address: "",
    city: "",
    postal_code: "",
    latitude: null as number | null,
    longitude: null as number | null,
    is_default: false,
  });

  // Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const res = await updateCustomer(customer.id, profile);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      alert("Customer profile updated.");
      router.refresh();
    }

    setLoading(false);
  };

  // Open Address Modal
  const openAddressModal = (addr?: any) => {
    if (addr) {
      setEditingAddress(addr);
      setAddressForm({
        label: addr.label || "Home",
        street_address: addr.street_address || "",
        city: addr.city || "",
        postal_code: addr.postal_code || "",
        latitude: addr.latitude ?? null,
        longitude: addr.longitude ?? null,
        is_default: addr.is_default || false,
      });
    } else {
      setEditingAddress(null);
      setAddressForm({
        label: "Home",
        street_address: "",
        city: "",
        postal_code: "",
        latitude: null,
        longitude: null,
        is_default: addresses.length === 0,
      });
    }
    setIsAddressModalOpen(true);
  };

  // Save Address (Add or Edit)
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const payload = {
      ...addressForm,
      id: editingAddress?.id,
    };

    const res = await saveAddress(customer.id, payload);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setIsAddressModalOpen(false);
      router.refresh();
    }
    setLoading(false);
  };

  const handleDeleteAddress = async (id: number) => {
    if (!confirm("Hapus alamat ini?")) return;
    setLoading(true);
    await deleteAddress(id, customer.id);
    router.refresh();
    setLoading(false);
  };

  const handleSetDefault = async (id: number) => {
    setLoading(true);
    await setDefaultAddress(id, customer.id);
    router.refresh();
    setLoading(false);
  };

  // KTP Review — approve or reject (reject requires a reason)
  const handleKtpReview = async (newStatus: "Verified" | "Not Submitted") => {
    if (newStatus === "Not Submitted" && !ktpNotes.trim()) {
      setKtpFlash({
        type: "err",
        text: "Please add a rejection reason before resetting the KTP.",
      });
      return;
    }

    setKtpBusy(true);
    setKtpFlash(null);

    const res = await reviewKtp(customer.id, newStatus, ktpNotes.trim());

    setKtpBusy(false);

    if (res?.error) {
      setKtpFlash({ type: "err", text: res.error });
      return;
    }

    setKtpNotes("");
    setProfile((prev) => ({ ...prev, status: newStatus }));
    setKtpFlash({
      type: "ok",
      text:
        newStatus === "Verified"
          ? "KTP approved — WhatsApp notification sent."
          : "KTP rejected — WhatsApp notification sent.",
    });
    router.refresh();
  };

  const handleDeleteCustomer = async () => {
    if (!confirm("Hapus customer ini? Tindakan ini tidak dapat dibatalkan."))
      return;
    setLoading(true);
    const res = await deleteCustomer(customer.id);
    if (res.error) {
      setErrorMsg(res.error);
      setLoading(false);
      return;
    }
    router.push("/admin/customers");
  };

  const latestKtp = ktpLogs?.[0] ?? null;

  return (
    <div>
      {/* Header & Badges */}
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1.5">
            Directory · Customer
          </div>
          <h1 className="font-serif text-[32px] font-normal tracking-[0.01em]">
            {customer.first_name} {customer.last_name || ""}
          </h1>
          <p className="text-muted text-[13px] mt-1">
            Joined {new Date(customer.date_joined).toLocaleDateString()} · ID:{" "}
            {customer.id}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <span
            className={`text-[10px] font-bold tracking-widest uppercase rounded px-2.5 py-1 ${
              customer.status === "Verified"
                ? "bg-ok-bg text-ok"
                : "bg-warn-bg text-warn"
            }`}
          >
            {customer.status}
          </span>
          <button
            type="button"
            onClick={handleDeleteCustomer}
            disabled={loading}
            className="font-medium border border-line bg-card text-ink rounded-lg px-3.5 py-2 text-sm hover:border-[#C9C2B4] transition cursor-pointer disabled:opacity-50"
          >
            Delete Customer
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 text-sm bg-bad-bg border border-[#D9A79C] text-bad rounded-lg">
          {errorMsg}
        </div>
      )}

      {/* Grid: Left = Info & Addresses, Right = KTP Review & Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* 1. Customer Information Card */}
          <div className="bg-card border border-line rounded-[10px] p-5">
            <h3 className="font-serif text-[18px] font-normal mb-3">
              Customer Information
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    First Name
                  </label>
                  <input
                    required
                    value={profile.first_name}
                    onChange={(e) =>
                      setProfile({ ...profile, first_name: e.target.value })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Last Name
                  </label>
                  <input
                    value={profile.last_name}
                    onChange={(e) =>
                      setProfile({ ...profile, last_name: e.target.value })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Phone
                  </label>
                  <input
                    required
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile({ ...profile, phone: e.target.value })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Gender
                  </label>
                  <select
                    value={profile.gender}
                    onChange={(e) =>
                      setProfile({ ...profile, gender: e.target.value })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  >
                    <option value="">— Select —</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={profile.dob}
                    onChange={(e) =>
                      setProfile({ ...profile, dob: e.target.value })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Status
                  </label>
                  <select
                    value={profile.status}
                    onChange={(e) =>
                      setProfile({ ...profile, status: e.target.value })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  >
                    <option value="Verified">Verified</option>
                    <option value="KTP Pending">KTP Pending</option>
                    <option value="Not Submitted">Not Submitted</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Store Credit (Rp)
                </label>
                <RupiahInput
                  value={profile.current_credit}
                  onChange={(v) =>
                    setProfile({ ...profile, current_credit: v })
                  }
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="font-medium border border-wine bg-wine text-white rounded-lg px-3.5 py-1.5 text-xs hover:bg-[#181E15] transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>

          {/* 2. Addresses Management Card */}
          <div className="bg-card border border-line rounded-[10px] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-[18px] font-normal">
                Customer Addresses
              </h3>
              <button
                type="button"
                onClick={() => openAddressModal()}
                className="text-xs font-semibold text-wine-ink border border-wine/30 bg-wine-soft px-3 py-1.5 rounded-lg hover:bg-wine hover:text-white transition cursor-pointer"
              >
                + Add Address
              </button>
            </div>

            {addresses.length === 0 ? (
              <p className="text-sm text-muted py-3">
                Belum ada alamat yang tersimpan.
              </p>
            ) : (
              <div className="space-y-3">
                {addresses.map((addr: any) => (
                  <div
                    key={addr.id}
                    className={`p-3.5 rounded-lg border text-[13px] transition ${
                      addr.is_default
                        ? "bg-[#F9FAF8] border-[#CAD3C5]"
                        : "bg-[#FDFCFA] border-line"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink uppercase text-[11px] tracking-wider bg-[#EFEBE2] px-2 py-0.5 rounded">
                          {addr.label || "Home"}
                        </span>
                        {addr.is_default && (
                          <span className="bg-ok-bg text-ok text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {!addr.is_default && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(addr.id)}
                            className="text-muted hover:text-ink transition underline cursor-pointer"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openAddressModal(addr)}
                          className="text-wine-ink hover:underline transition cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="text-bad hover:underline transition cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <p className="text-ink font-medium leading-snug">
                      {addr.street_address}
                    </p>
                    <p className="text-muted text-xs mt-0.5">
                      {addr.city}, {addr.postal_code || "No Postal Code"}
                    </p>

                    {addr.latitude !== null && addr.longitude !== null && (
                      <div className="text-[11px] text-muted mt-2 flex items-center gap-1.5">
                        <span>
                          📍 {addr.latitude}, {addr.longitude}
                        </span>
                        <a
                          href={`https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-wine-ink underline"
                        >
                          Buka di Maps
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {/* KTP Verification Card */}
          <div className="bg-card border border-line rounded-[10px] p-5">
            <h3 className="font-serif text-[18px] font-normal mb-3">
              KTP Verification
            </h3>

            {/* Photo preview */}
            <div className="mb-4">
              {ktpPhotoUrl ? (
                <div className="border border-line rounded-lg overflow-hidden bg-[#F6F4EF]">
                  <a
                    href={ktpPhotoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block bg-black/5"
                    title="Open full size"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ktpPhotoUrl}
                      alt="Customer KTP"
                      className="w-full h-auto max-h-[320px] object-contain mx-auto"
                    />
                  </a>
                  <div className="flex items-center justify-between px-3 py-2 border-t border-line bg-white">
                    <span className="text-[11px] text-muted">
                      Uploaded{" "}
                      {latestKtp?.created_at
                        ? new Date(latestKtp.created_at).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                    <a
                      href={ktpPhotoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-semibold text-wine-ink hover:underline inline-flex items-center gap-1"
                    >
                      Open full size
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-line rounded-lg py-8 text-center bg-[#FDFCFA]">
                  <p className="text-xs text-muted">
                    No KTP photo uploaded yet.
                  </p>
                </div>
              )}
            </div>

            <div className="p-3.5 bg-[#F6F4EF] rounded-lg border border-[#E5E0D6]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted">
                  Current Verification Status:
                </span>
                <span className="font-bold text-xs uppercase">
                  {customer.status}
                </span>
              </div>

              <textarea
                rows={2}
                placeholder={
                  customer.status === "KTP Pending"
                    ? "Rejection reason (required if rejecting)…"
                    : "Internal verification notes…"
                }
                value={ktpNotes}
                onChange={(e) => setKtpNotes(e.target.value)}
                className="w-full text-xs border border-line rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
              />

              {ktpFlash && (
                <div
                  className={`mt-2 text-[11px] font-medium rounded-md px-2 py-1 ${
                    ktpFlash.type === "ok"
                      ? "bg-ok-bg text-ok"
                      : "bg-bad-bg text-bad"
                  }`}
                >
                  {ktpFlash.text}
                </div>
              )}

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => handleKtpReview("Not Submitted")}
                  disabled={ktpBusy || customer.status === "Not Submitted"}
                  className="px-3 py-1 bg-white border border-line text-xs rounded-md hover:bg-bad-bg hover:text-bad cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject / Reset
                </button>
                <button
                  type="button"
                  onClick={() => handleKtpReview("Verified")}
                  disabled={ktpBusy || customer.status === "Verified"}
                  className="px-3 py-1 bg-wine text-white text-xs rounded-md hover:bg-[#181E15] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {ktpBusy ? "Processing…" : "Approve KTP"}
                </button>
              </div>
            </div>

            {/* KTP Logs */}
            <div className="text-xs mt-4">
              <h4 className="font-semibold text-muted uppercase text-[10px] tracking-wider mb-2">
                Review History
              </h4>
              {ktpLogs.length === 0 ? (
                <p className="text-muted text-xs">
                  No verification events logged.
                </p>
              ) : (
                <ul className="space-y-2">
                  {ktpLogs.map((log: any) => (
                    <li
                      key={log.id}
                      className="border-b border-line pb-1.5 text-xs last:border-none"
                    >
                      <span className="font-medium">{log.status}</span> —{" "}
                      {log.description || "No notes"}{" "}
                      <span className="text-muted">
                        ({new Date(log.created_at).toLocaleDateString()})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Orders History Card */}
          <div className="bg-card border border-line rounded-[10px] p-5">
            <h3 className="font-serif text-[18px] font-normal mb-3">
              Order History
            </h3>
            {orders.length === 0 ? (
              <p className="text-sm text-muted">
                Belum ada order untuk customer ini.
              </p>
            ) : (
              <div className="space-y-2">
                {orders.map((o: any) => (
                  <div
                    key={o.id}
                    className="p-3 bg-[#FDFCFA] border border-line rounded-lg flex justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-ink mr-2">{o.id}</span>
                      <span className="text-muted">{o.order_date}</span>
                      <div className="mt-0.5 text-muted">
                        Total: {formatRupiah(o.total || 0)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="bg-[#EFEBE2] text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase">
                        {o.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: Add / Edit Address with Map */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-card border border-line rounded-xl w-full max-w-xl p-6 shadow-xl relative my-8 animate-in fade-in zoom-in-95">
            <h2 className="font-serif text-[22px] font-normal mb-1">
              {editingAddress ? "Edit Alamat" : "Tambah Alamat Baru"}
            </h2>
            <p className="text-[13px] text-muted mb-4">
              Cari alamat atau geser pin pada peta untuk melengkapi koordinat
              pengiriman Biteship.
            </p>

            <form onSubmit={handleSaveAddress} className="space-y-3.5">
              <AddressMapPicker
                initialData={addressForm}
                onChange={(loc) => {
                  setAddressForm((prev) => ({
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
                    value={addressForm.label}
                    placeholder="Rumah, Kantor, Studio..."
                    onChange={(e) =>
                      setAddressForm({ ...addressForm, label: e.target.value })
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
                    value={addressForm.city}
                    onChange={(e) =>
                      setAddressForm({ ...addressForm, city: e.target.value })
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
                  value={addressForm.street_address}
                  onChange={(e) =>
                    setAddressForm({
                      ...addressForm,
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
                    value={addressForm.postal_code}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
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
                    value={addressForm.latitude ?? ""}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
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
                    value={addressForm.longitude ?? ""}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
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
                  id="is_default_check"
                  checked={addressForm.is_default}
                  onChange={(e) =>
                    setAddressForm({
                      ...addressForm,
                      is_default: e.target.checked,
                    })
                  }
                  className="rounded border-line text-wine focus:ring-wine"
                />
                <label
                  htmlFor="is_default_check"
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
                  disabled={loading}
                  className="px-4 py-2 bg-wine text-white rounded-lg text-xs font-medium hover:bg-[#181E15] disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Menyimpan..." : "Simpan Alamat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

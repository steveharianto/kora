"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Upload, ChevronDown } from "lucide-react";
import { updateCustomerProfile, saveCustomerAddress, deleteCustomerAddress, setDefaultCustomerAddress } from "@/app/actions/customerProfile";
import type { CustomerSession } from "@/app/actions/customerAuth";
import ChangePasswordModal from "./ChangePasswordModal";
import AddressModal from "./AddressModal";
import IdVerificationModal from "@/components/storefront/IdVerificationModal";

interface Address {
  id: number;
  label: string;
  street_address: string;
  city: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
}

interface Props {
  customer: CustomerSession;
  addresses: Address[];
  latestKtp: { photo_url: string; status: string; created_at: string } | null;
}

export default function AccountClient({ customer, addresses, latestKtp }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState({
    firstName: customer.firstName || "",
    lastName: customer.lastName || "",
    dob: "",
    phone: customer.phone || "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [changePwOpen, setChangePwOpen] = useState(false);
  const [ktpOpen, setKtpOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const res = await updateCustomerProfile(profile);
    if (res.error) {
      setMsg({ type: "err", text: res.error });
    } else {
      setMsg({ type: "ok", text: "Profile updated." });
      router.refresh();
    }
    setSaving(false);
  };

  const openAddressModal = (addr?: Address) => {
    setEditingAddress(addr || null);
    setAddressModalOpen(true);
  };

  const handleDeleteAddress = async (id: number) => {
    if (!confirm("Delete this address?")) return;
    await deleteCustomerAddress(id);
    router.refresh();
  };

  const handleSetDefault = async (id: number) => {
    await setDefaultCustomerAddress(id);
    router.refresh();
  };

  const ktpUploaded = Boolean(latestKtp) || customer.status !== "Not Submitted";

  return (
    <div className="space-y-16">
      {/* ── Account section ─────────────────────────────────── */}
      <section>
        <h2 className="font-serif text-[28px] sm:text-[32px] text-store-fg mb-8 font-normal">
          Account
        </h2>

        {msg && (
          <div
            className={`mb-6 p-3 rounded-md text-[12px] ${
              msg.type === "ok"
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[12.5px] text-store-fg-muted mb-2">
                First Name
              </label>
              <input
                required
                value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent"
              />
            </div>
            <div>
              <label className="block text-[12.5px] text-store-fg-muted mb-2">
                Last Name
              </label>
              <input
                value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[12.5px] text-store-fg-muted mb-2">
                Date of Birth
              </label>
              <input
                type="date"
                value={profile.dob}
                onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                max="9999-12-31"
                className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent"
              />
            </div>
            <div>
              <label className="block text-[12.5px] text-store-fg-muted mb-2">Email</label>
              <input
                disabled
                value={customer.email || ""}
                className="w-full text-[13.5px] text-store-fg-muted bg-store-bg border border-store-border px-4 py-3"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[12.5px] text-store-fg-muted mb-2">
                WhatsApp Number
              </label>
              <input
                required
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full text-[13.5px] text-store-fg bg-transparent border border-store-border-strong px-4 py-3 focus:outline-none focus:border-store-accent font-mono"
              />
            </div>
            <div>
              <label className="block text-[12.5px] text-store-fg-muted mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  disabled
                  type="password"
                  value="••••••••"
                  className="w-full text-[13.5px] text-store-fg-muted bg-store-bg border border-store-border px-4 py-3 pr-11 font-mono"
                />
                <Eye className="w-4 h-4 text-store-fg-muted absolute right-3 top-1/2 -translate-y-1/2" strokeWidth={1.6} />
              </div>
              <button
                type="button"
                onClick={() => setChangePwOpen(true)}
                className="block mt-2 text-[11px] tracking-[0.16em] uppercase text-store-fg-muted underline underline-offset-4 hover:text-store-fg cursor-pointer"
              >
                Change Password
              </button>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-[12.5px] text-store-fg-muted mb-2">ID (KTP)</label>
            {ktpUploaded ? (
              <div className="border border-store-border bg-store-bg px-5 py-4 flex items-center justify-between gap-4 max-w-[560px]">
                <div>
                  <p className="text-[13px] text-store-fg">
                    ID uploaded — status:{" "}
                    <strong>{latestKtp?.status || customer.status}</strong>
                  </p>
                  <p className="text-[11.5px] text-store-fg-muted mt-0.5">
                    {latestKtp?.created_at
                      ? `Uploaded ${new Date(latestKtp.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                      : "Awaiting admin review"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setKtpOpen(true)}
                  className="text-[11px] tracking-[0.16em] uppercase text-store-fg-muted underline underline-offset-4 hover:text-store-fg cursor-pointer whitespace-nowrap"
                >
                  Replace
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setKtpOpen(true)}
                className="w-full max-w-[560px] border border-dashed border-store-fg/30 hover:border-store-accent py-10 px-6 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-center gap-3 text-store-fg-muted">
                  <Upload className="w-5 h-5" strokeWidth={1.5} />
                  <span className="text-[13px] tracking-wide">
                    Upload your ID (KTP) Photos Here
                  </span>
                </div>
              </button>
            )}
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-10 py-3 bg-store-accent text-white text-[11px] tracking-[0.22em] uppercase font-medium hover:bg-store-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </section>

      {/* ── Address section ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-8">
          <h2 className="font-serif text-[28px] sm:text-[32px] text-store-fg font-normal">
            Address
          </h2>
          <button
            type="button"
            onClick={() => openAddressModal()}
            className="px-5 py-2.5 bg-store-accent text-white text-[10.5px] tracking-[0.2em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer"
          >
            + Add New Address
          </button>
        </div>

        {addresses.length === 0 ? (
          <p className="text-[13px] text-store-fg-muted">No saved addresses yet.</p>
        ) : (
          <div className="space-y-4">
            {addresses.map((addr) => (
              <AddressRow
                key={addr.id}
                address={addr}
                onEdit={() => openAddressModal(addr)}
                onDelete={() => handleDeleteAddress(addr.id)}
                onSetDefault={() => handleSetDefault(addr.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Modals ─────────────────────────────────────────── */}
      <ChangePasswordModal isOpen={changePwOpen} onClose={() => setChangePwOpen(false)} />

      <AddressModal
        isOpen={addressModalOpen}
        onClose={() => {
          setAddressModalOpen(false);
          setEditingAddress(null);
        }}
        initial={editingAddress}
        onSaved={() => router.refresh()}
      />

      <IdVerificationModal
        isOpen={ktpOpen}
        onClose={() => setKtpOpen(false)}
        onProceed={() => {
          setKtpOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

/* ── Address row ──────────────────────────────────────────────── */

function AddressRow({
  address,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="border border-store-border bg-transparent px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-[14px] text-store-fg font-medium">{address.label}</p>
            {address.is_default && (
              <span className="text-[9.5px] tracking-wider uppercase bg-store-accent text-white px-2 py-0.5">
                Default
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-store-fg-muted leading-snug">
            {address.street_address}
            <br />
            {address.city}
            {address.postal_code ? `, ${address.postal_code}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {!address.is_default && (
            <button
              type="button"
              onClick={onSetDefault}
              className="px-4 py-2 bg-store-accent text-white text-[10.5px] tracking-[0.16em] uppercase font-medium hover:bg-store-accent-hover transition-colors cursor-pointer whitespace-nowrap"
            >
              Set as Default
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="px-4 py-2 border border-store-border-strong text-[10.5px] tracking-[0.16em] uppercase text-store-fg-muted hover:text-store-fg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              More
              <ChevronDown className="w-3 h-3" strokeWidth={1.6} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-32 bg-store-bg border border-store-border-strong shadow-lg z-20"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="block w-full text-left px-4 py-2.5 text-[11px] tracking-wide text-store-fg-muted hover:text-store-fg hover:bg-store-hover/40 cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="block w-full text-left px-4 py-2.5 text-[11px] tracking-wide text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

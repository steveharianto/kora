"use client";

import { useState } from "react";
import Link from "next/link";
import {
  saveAppSetting, saveDepositTiers, createAdminUser, updateAdminRole,
  deleteAdminUser, changeOwnPassword,
} from "@/app/actions/settings";
import { formatRupiah } from "@/lib/utils";
import { Lock, X } from "lucide-react";
import RupiahInput from "@/components/RupiahInput";

interface SettingsClientProps {
  activeTab: string;
  settingsMap: Record<string, any>;
  depositTiers: any[];
  admins: any[];
  types: any[];
  currentAdmin: any;
}

const TABS = [
  { key: "automation", label: "Automation" },
  { key: "rental-rules", label: "Rental rules" },
  { key: "orders", label: "Orders" },
  { key: "fittings", label: "Fittings" },
  { key: "notifications", label: "Notifications" },
  { key: "shipping", label: "Shipping" },
  { key: "website-content", label: "Website content" },
  { key: "users-roles", label: "Users & roles" },
  { key: "change-password", label: "Change password" },
  { key: "business-info", label: "Business info" },
];

export default function SettingsClient({
  activeTab,
  settingsMap,
  depositTiers: initialDepositTiers,
  admins: initialAdmins,
  currentAdmin,
}: SettingsClientProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isSuperAdmin =
    currentAdmin?.role?.toLowerCase().replace(/[\s_-]+/g, "") === "superadmin";

  // ---- Automation (unchanged) ----
  const [automation, setAutomation] = useState(
    settingsMap.automation || {
      dress_buffers: [
        { type: "Dress", days: 2 }, { type: "Kebaya", days: 3 },
        { type: "Kaftan", days: 2 }, { type: "Set / Outer", days: 2 }, { type: "Top", days: 1 },
      ],
      accessory_buffers: [
        { type: "Veil", days: 1 }, { type: "Belt / sash", days: 1 },
        { type: "Jewelry", days: 0 }, { type: "Bag / clutch", days: 1 },
      ],
    },
  );

  // ---- Rental rules (unchanged) ----
  const [rentalRules, setRentalRules] = useState(
    settingsMap.rental_rules || {
      period: {
        rental_days: 3, return_deadline: "Day 4 - return only", late_fee_day_1: 100000,
        escalation: "Doubles each additional day", qc_refund_window: "2 x 24 hours after receipt",
        max_return_reminders: 2,
      },
      late_fee_schedule: [
        { label: "Below Rp 500.000", fee: 100000 },
        { label: "Rp 500.000 - 1.000.000", fee: 140000 },
        { label: "Rp 1.000.001 - 2.000.000", fee: 200000 },
        { label: "Above Rp 2.000.000", fee: 400000 },
      ],
    },
  );
  const [depositTiers, setDepositTiers] = useState(initialDepositTiers);

  // ---- NEW: Orders tab state ----
  const [ordersSettings, setOrdersSettings] = useState(
    settingsMap.orders || {
      draft_stale_days: 30,
      auto_create_return_on_active: true,
    },
  );

  // ---- Fittings (unchanged) ----
  const [fittings, setFittings] = useState(
    settingsMap.fittings || {
      operating_hours: {
        weekday: { regular: "10:00 - 17:00", after_hours: "17:00 - 18:00" },
        saturday: { regular: "10:00 - 13:00", after_hours: "13:00 - 15:00" },
        sunday: { closed: true, note: "Sunday: closed, no bookings possible." },
      },
      session_rules: { max_dresses_per_session: 3, after_hours_fee: 100000, slot_length_hours: 1 },
    },
  );

  // ---- Notifications (unchanged) ----
  const [notifications, setNotifications] = useState(settingsMap.notifications || {});

  // ---- Shipping — extended ----
  const [shipping, setShipping] = useState(() => {
    const raw = settingsMap.shipping || {};
    const rawPrimary = raw.dispatch_addresses?.primary;
    const rawSecondary = raw.dispatch_addresses?.secondary;

    return {
      ...raw,
      dispatch_addresses: {
        primary:
          typeof rawPrimary === "object" && rawPrimary !== null
            ? rawPrimary
            : {
                name: "KORA Showroom Jakarta", phone: "081234567890",
                street_address: typeof rawPrimary === "string" ? rawPrimary : "Jl. Gunawarman No. 30, Kebayoran Baru",
                city: "Jakarta Selatan", postal_code: "12180",
                latitude: -6.23827, longitude: 106.81056,
              },
        secondary:
          typeof rawSecondary === "object" && rawSecondary !== null
            ? rawSecondary
            : {
                name: "KORA Studio Semarang", phone: "081234567891",
                street_address: typeof rawSecondary === "string" ? rawSecondary : "Puri Anjasmoro L2 No. 9B",
                city: "Semarang", postal_code: "50144",
                latitude: -6.974, longitude: 110.393,
              },
      },
      return_address: raw.return_address || {
        drop_off_point: "St. Moritz Ambassador Suites Tower, Unit 3808, Jl. Kembangan Kerep No. 1",
      },
      delivery_lead_times: raw.delivery_lead_times || [],
      courier_policy: raw.courier_policy || {
        provider: "Biteship - multi-courier (Paxel, Gosend, JNE, Tiki...)",
        dispatch_mode: "Manual - admin books after address confirmation",
        return_couriers_offered: "Paxel - Regular, Gosend - Instant, JNE - REG, Tiki - ONS",
      },
      refund_payout_methods: raw.refund_payout_methods || "Bank transfer, Dana, OVO, GoPay, Cash",

      // NEW fields
      booking_window_days: Number(raw.booking_window_days ?? 3),
      default_item_weight_g: Number(raw.default_item_weight_g ?? 800),
      item_weight_overrides: raw.item_weight_overrides || {},
    };
  });

  // Textarea representation of overrides
  const overridesText = useState(() => {
    const obj = shipping.item_weight_overrides || {};
    return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join("\n");
  });
  const [overridesDraft, setOverridesDraft] = overridesText;

  // ---- Website content (unchanged) ----
  const [websiteContent, setWebsiteContent] = useState(
    settingsMap.website_content || { shipping_return_policy: "" },
  );

  // ---- Permissions — extended ----
  const [permissions, setPermissions] = useState(
    settingsMap.permissions || {
      reset_order_draft: "superadmin_only",
      refund_store_credit: "superadmin_only",
      archive_inventory_item: "staff_and_superadmin",
      delete_inventory_item: "superadmin_only",
      staff_edits_product_info: "require_approval",
      cancel_website_orders: "superadmin_only",
      require_qc_review: true,
    },
  );
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "staff" });

  // ---- Business info (unchanged) ----
  const [businessInfo, setBusinessInfo] = useState(
    settingsMap.business_info || {
      brand_name: "KORA", showroom: "", operating_hours: "", whatsapp_business_number: "",
    },
  );

  // ---- Change password (unchanged) ----
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwFeedback, setPwFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const handleSave = async (key: string, payload: any) => {
    if (!isSuperAdmin) {
      alert("Unauthorized: Only Super Admins can update system settings.");
      return;
    }
    setLoading(true);
    setFeedback(null);
    const res = await saveAppSetting(key, payload);
    if (res?.error) setFeedback({ type: "error", message: res.error });
    else {
      setFeedback({ type: "success", message: "Changes saved successfully." });
      setTimeout(() => setFeedback(null), 3000);
    }
    setLoading(false);
  };

  const handleSaveRentalRules = async () => {
    if (!isSuperAdmin) { alert("Only Super Admins can update rental rules."); return; }
    setLoading(true);
    setFeedback(null);
    const [a, b] = await Promise.all([
      saveAppSetting("rental_rules", rentalRules),
      saveDepositTiers(depositTiers),
    ]);
    if (a?.error || b?.error) setFeedback({ type: "error", message: a?.error || b?.error || "Failed to save." });
    else {
      setFeedback({ type: "success", message: "Rental rules and deposit tiers updated." });
      setTimeout(() => setFeedback(null), 3000);
    }
    setLoading(false);
  };

  const handleSaveShipping = async () => {
    // Parse overrides textarea → object
    const obj: Record<string, number> = {};
    overridesDraft.split("\n").forEach((line) => {
      const [k, v] = line.split("=").map((s) => s.trim());
      if (k && v && !isNaN(Number(v))) obj[k] = Number(v);
    });
    await handleSave("shipping", { ...shipping, item_weight_overrides: obj });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await createAdminUser(newUser);
    if (res?.error) alert(res.error);
    else {
      setIsAddUserOpen(false);
      setNewUser({ name: "", email: "", password: "", role: "staff" });
      alert("User added successfully.");
    }
    setLoading(false);
  };

  const handleRoleChange = async (id: string, role: string) => {
    setLoading(true);
    const res = await updateAdminRole(id, role);
    if (res?.error) alert(res.error);
    setLoading(false);
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Permanently remove this user?")) return;
    setLoading(true);
    const res = await deleteAdminUser(id);
    if (res?.error) alert(res.error);
    setLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwLoading(true);
    setPwFeedback(null);
    const res = await changeOwnPassword(pwForm);
    if (res?.error) setPwFeedback({ type: "error", message: res.error });
    else {
      setPwFeedback({ type: "success", message: "Password updated successfully." });
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    }
    setPwLoading(false);
  };

  return (
    <div>
      <div className="flex gap-4 border-b border-line mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <Link key={t.key} href={`?tab=${t.key}`}
            className={`pb-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === t.key ? "text-wine-ink border-b-2 border-wine" : "text-muted hover:text-ink"
            }`}>
            {t.label}
          </Link>
        ))}
      </div>

      {!isSuperAdmin && activeTab !== "change-password" && (
        <div className="mb-5 p-3.5 bg-[#FBF8EF] border border-[#E8DFC2] text-[#84661E] rounded-xl text-xs flex items-center gap-2.5">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Read-Only Mode:</strong> Signed in as Staff ({currentAdmin?.name || "Staff"}).
            System policies, operating hours, and financial deposit tiers can only be altered by Super Admins.
          </span>
        </div>
      )}

      {feedback && (
        <div className={`mb-4 p-3 rounded-lg text-xs font-medium border ${
          feedback.type === "success"
            ? "bg-[#F2F6EF] border-[#CAD3C5] text-wine-ink"
            : "bg-bad-bg border-[#D9A79C] text-bad"
        }`}>
          {feedback.message}
        </div>
      )}

      {/* 1. AUTOMATION — unchanged */}
      {activeTab === "automation" && (
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <div className="bg-card border border-line rounded-[10px] p-5">
              <h3 className="font-serif text-[18px] font-normal mb-1">Dress turnaround buffer</h3>
              <p className="text-muted text-[12.5px] mb-4">Days blocked between return deadline and next start date.</p>
              <div className="space-y-3">
                {automation.dress_buffers.map((item: any, idx: number) => (
                  <div key={item.type} className="flex items-center justify-between py-1">
                    <span className="text-[13px] text-ink font-medium">{item.type}</span>
                    <input type="number" min={0} disabled={!isSuperAdmin} value={item.days}
                      onChange={(e) => {
                        const next = [...automation.dress_buffers];
                        next[idx].days = parseInt(e.target.value) || 0;
                        setAutomation({ ...automation, dress_buffers: next });
                      }}
                      className="w-24 text-right text-[13px] border border-line rounded-lg px-3 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border border-line rounded-[10px] p-5">
              <h3 className="font-serif text-[18px] font-normal mb-1">Accessory turnaround buffer</h3>
              <p className="text-muted text-[12.5px] mb-4">Set accessory buffers independently of dresses.</p>
              <div className="space-y-3">
                {automation.accessory_buffers.map((item: any, idx: number) => (
                  <div key={item.type} className="flex items-center justify-between py-1">
                    <span className="text-[13px] text-ink font-medium">{item.type}</span>
                    <input type="number" min={0} disabled={!isSuperAdmin} value={item.days}
                      onChange={(e) => {
                        const next = [...automation.accessory_buffers];
                        next[idx].days = parseInt(e.target.value) || 0;
                        setAutomation({ ...automation, accessory_buffers: next });
                      }}
                      className="w-24 text-right text-[13px] border border-line rounded-lg px-3 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button type="button" onClick={() => handleSave("automation", automation)}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

      {/* 2. RENTAL RULES — unchanged */}
      {activeTab === "rental-rules" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-line rounded-[10px] p-5">
              <h3 className="font-serif text-[18px] font-normal mb-4">Rental period</h3>
              <div className="grid grid-cols-2 gap-3.5 mb-3">
                <div>
                  <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">Rental Days</label>
                  <input type="number" disabled={!isSuperAdmin} value={rentalRules.period.rental_days}
                    onChange={(e) => setRentalRules({ ...rentalRules, period: { ...rentalRules.period, rental_days: parseInt(e.target.value) || 1 } })}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
                </div>
                <div>
                  <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">Return Deadline</label>
                  <input disabled={!isSuperAdmin} value={rentalRules.period.return_deadline}
                    onChange={(e) => setRentalRules({ ...rentalRules, period: { ...rentalRules.period, return_deadline: e.target.value } })}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3.5 mb-3">
                <div>
                  <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">Late Fee, Day 1 (Rp)</label>
                  <RupiahInput value={rentalRules.period.late_fee_day_1}
                    onChange={(v) => setRentalRules({ ...rentalRules, period: { ...rentalRules.period, late_fee_day_1: v } })}
                    disabled={!isSuperAdmin} />
                </div>
                <div>
                  <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">Escalation</label>
                  <input disabled={!isSuperAdmin} value={rentalRules.period.escalation}
                    onChange={(e) => setRentalRules({ ...rentalRules, period: { ...rentalRules.period, escalation: e.target.value } })}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
                </div>
              </div>
            </div>
            <div className="bg-card border border-line rounded-[10px] p-5">
              <h3 className="font-serif text-[18px] font-normal mb-3">Deposit tiers</h3>
              <table className="w-full text-[13px] mb-3">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wider text-muted border-b border-line text-left">
                    <th className="pb-2 font-medium">Rental Price</th>
                    <th className="pb-2 font-medium text-right">Refundable Deposit</th>
                  </tr>
                </thead>
                <tbody>
                  {depositTiers.map((tier: any, i: number) => (
                    <tr key={tier.id || i} className="border-b border-[#F6F4EF] last:border-none">
                      <td className="py-2.5 text-muted">
                        {i === 0 ? `Up to ${formatRupiah(tier.price_up_to)}`
                          : i === depositTiers.length - 1 ? `Above ${formatRupiah(depositTiers[i - 1]?.price_up_to)}`
                          : `${formatRupiah(depositTiers[i - 1]?.price_up_to + 1)} - ${formatRupiah(tier.price_up_to)}`}
                      </td>
                      <td className="py-2.5 text-right font-medium text-ink">
                        <RupiahInput value={tier.deposit_value}
                          onChange={(v) => {
                            const u = [...depositTiers]; u[i].deposit_value = v; setDepositTiers(u);
                          }}
                          disabled={!isSuperAdmin} className="w-32 text-right text-xs" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button type="button" onClick={handleSaveRentalRules} disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

      {/* 3. NEW: ORDERS */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="bg-card border border-line rounded-[10px] p-5 max-w-2xl space-y-4">
            <h3 className="font-serif text-[18px] font-normal">Order workflow</h3>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                  Draft Stale Threshold (Days)
                </label>
                <input type="number" min={1} disabled={!isSuperAdmin}
                  value={ordersSettings.draft_stale_days}
                  onChange={(e) => setOrdersSettings({ ...ordersSettings, draft_stale_days: parseInt(e.target.value) || 30 })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
                <p className="text-[11px] text-muted mt-1">Draft orders older than this get a STALE badge on the Orders list.</p>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                  <input type="checkbox" disabled={!isSuperAdmin}
                    checked={!!ordersSettings.auto_create_return_on_active}
                    onChange={(e) => setOrdersSettings({ ...ordersSettings, auto_create_return_on_active: e.target.checked })}
                    className="rounded text-wine focus:ring-wine" />
                  <span>Auto-create return when order becomes Active</span>
                </label>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => handleSave("orders", ordersSettings)}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

      {/* 4. FITTINGS — unchanged */}
      {activeTab === "fittings" && (
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <div className="bg-card border border-line rounded-[10px] p-5">
              <h3 className="font-serif text-[18px] font-normal mb-4">Operating hours</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted mb-1">WEEKDAY REGULAR</label>
                  <input disabled={!isSuperAdmin} value={fittings.operating_hours.weekday.regular}
                    onChange={(e) => setFittings({ ...fittings, operating_hours: { ...fittings.operating_hours, weekday: { ...fittings.operating_hours.weekday, regular: e.target.value } } })}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted mb-1">WEEKDAY AFTER HOURS (+FEE)</label>
                  <input disabled={!isSuperAdmin} value={fittings.operating_hours.weekday.after_hours}
                    onChange={(e) => setFittings({ ...fittings, operating_hours: { ...fittings.operating_hours, weekday: { ...fittings.operating_hours.weekday, after_hours: e.target.value } } })}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
                </div>
              </div>
            </div>
            <div className="bg-card border border-line rounded-[10px] p-5 space-y-4">
              <h3 className="font-serif text-[18px] font-normal">Session rules</h3>
              <div>
                <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">Max Dresses Per Session</label>
                <input type="number" disabled={!isSuperAdmin}
                  value={fittings.session_rules.max_dresses_per_session}
                  onChange={(e) => setFittings({ ...fittings, session_rules: { ...fittings.session_rules, max_dresses_per_session: parseInt(e.target.value) || 1 } })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
              </div>
              <div>
                <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">After-Hours Fitting Fee (Rp)</label>
                <RupiahInput value={fittings.session_rules.after_hours_fee}
                  onChange={(v) => setFittings({ ...fittings, session_rules: { ...fittings.session_rules, after_hours_fee: v } })}
                  disabled={!isSuperAdmin} />
              </div>
            </div>
          </div>
          <button type="button" onClick={() => handleSave("fittings", fittings)}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

      {/* 5. NOTIFICATIONS — unchanged */}
      {activeTab === "notifications" && (
        <div>
          <div className="bg-card border border-line rounded-[10px] p-5 mb-5 space-y-4">
            <h3 className="font-serif text-[18px] font-normal mb-1">WhatsApp automation</h3>
            {Object.entries(notifications).map(([key, item]: [string, any]) => (
              <div key={key} className="border border-line rounded-lg p-4 bg-[#FDFCFA]">
                <h4 className="font-medium text-[13.5px] text-ink mb-1">{item.title}</h4>
                <textarea rows={2} disabled={!isSuperAdmin} value={item.template}
                  onChange={(e) => {
                    const u = { ...notifications };
                    u[key].template = e.target.value;
                    setNotifications(u);
                  }}
                  className="w-full text-[13px] border border-line rounded-lg p-2.5 bg-white disabled:bg-[#F6F4EF]" />
              </div>
            ))}
          </div>
          <button type="button" onClick={() => handleSave("notifications", notifications)}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

      {/* 6. SHIPPING — extended */}
      {activeTab === "shipping" && (
        <div className="space-y-4">
          <div className="bg-card border border-line rounded-[10px] p-5">
            <h3 className="font-serif text-[18px] font-normal mb-3">Primary Origin (Showroom)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] tracking-wider uppercase text-muted mb-0.5">Contact Name</label>
                <input disabled={!isSuperAdmin}
                  value={shipping.dispatch_addresses?.primary?.name || ""}
                  onChange={(e) => setShipping({ ...shipping, dispatch_addresses: { ...shipping.dispatch_addresses, primary: { ...shipping.dispatch_addresses?.primary, name: e.target.value } } })}
                  className="w-full border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
              </div>
              <div>
                <label className="block text-[10px] tracking-wider uppercase text-muted mb-0.5">Phone Number</label>
                <input disabled={!isSuperAdmin}
                  value={shipping.dispatch_addresses?.primary?.phone || ""}
                  onChange={(e) => setShipping({ ...shipping, dispatch_addresses: { ...shipping.dispatch_addresses, primary: { ...shipping.dispatch_addresses?.primary, phone: e.target.value } } })}
                  className="w-full border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
              </div>
              <div>
                <label className="block text-[10px] tracking-wider uppercase text-muted mb-0.5">Street</label>
                <input disabled={!isSuperAdmin}
                  value={shipping.dispatch_addresses?.primary?.street_address || ""}
                  onChange={(e) => setShipping({ ...shipping, dispatch_addresses: { ...shipping.dispatch_addresses, primary: { ...shipping.dispatch_addresses?.primary, street_address: e.target.value } } })}
                  className="w-full border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
              </div>
              <div>
                <label className="block text-[10px] tracking-wider uppercase text-muted mb-0.5">City</label>
                <input disabled={!isSuperAdmin}
                  value={shipping.dispatch_addresses?.primary?.city || ""}
                  onChange={(e) => setShipping({ ...shipping, dispatch_addresses: { ...shipping.dispatch_addresses, primary: { ...shipping.dispatch_addresses?.primary, city: e.target.value } } })}
                  className="w-full border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
              </div>
              <div>
                <label className="block text-[10px] tracking-wider uppercase text-muted mb-0.5">Postal Code</label>
                <input disabled={!isSuperAdmin}
                  value={shipping.dispatch_addresses?.primary?.postal_code || ""}
                  onChange={(e) => setShipping({ ...shipping, dispatch_addresses: { ...shipping.dispatch_addresses, primary: { ...shipping.dispatch_addresses?.primary, postal_code: e.target.value } } })}
                  className="w-full border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] tracking-wider uppercase text-muted mb-0.5">Latitude</label>
                  <input type="number" step="any" disabled={!isSuperAdmin}
                    value={shipping.dispatch_addresses?.primary?.latitude ?? ""}
                    onChange={(e) => setShipping({ ...shipping, dispatch_addresses: { ...shipping.dispatch_addresses, primary: { ...shipping.dispatch_addresses?.primary, latitude: e.target.value ? parseFloat(e.target.value) : null } } })}
                    className="w-full border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
                </div>
                <div>
                  <label className="block text-[10px] tracking-wider uppercase text-muted mb-0.5">Longitude</label>
                  <input type="number" step="any" disabled={!isSuperAdmin}
                    value={shipping.dispatch_addresses?.primary?.longitude ?? ""}
                    onChange={(e) => setShipping({ ...shipping, dispatch_addresses: { ...shipping.dispatch_addresses, primary: { ...shipping.dispatch_addresses?.primary, longitude: e.target.value ? parseFloat(e.target.value) : null } } })}
                    className="w-full border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
                </div>
              </div>
            </div>
          </div>

          {/* NEW: Courier booking rules */}
          <div className="bg-card border border-line rounded-[10px] p-5">
            <h3 className="font-serif text-[18px] font-normal mb-1">Courier booking rules</h3>
            <p className="text-muted text-[12.5px] mb-4">
              Applied to both outbound and return shipments. Guards run server-side; the order detail page mirrors them client-side.
            </p>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                  Booking Window (Days Before Pickup)
                </label>
                <input type="number" min={0} disabled={!isSuperAdmin}
                  value={shipping.booking_window_days}
                  onChange={(e) => setShipping({ ...shipping, booking_window_days: parseInt(e.target.value) || 0 })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
                <p className="text-[11px] text-muted mt-1">Book Biteship button stays disabled until this many days before pickup.</p>
              </div>
              <div>
                <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                  Default Item Weight (grams)
                </label>
                <input type="number" min={1} disabled={!isSuperAdmin}
                  value={shipping.default_item_weight_g}
                  onChange={(e) => setShipping({ ...shipping, default_item_weight_g: parseInt(e.target.value) || 1 })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
                <p className="text-[11px] text-muted mt-1">Applied to any SKU not listed in overrides.</p>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                Per-SKU Weight Overrides
              </label>
              <textarea rows={5} disabled={!isSuperAdmin}
                value={overridesDraft}
                onChange={(e) => setOverridesDraft(e.target.value)}
                placeholder={"ZM19=1200\nKB04=1500"}
                className="w-full text-[12px] font-mono border border-line rounded-lg p-2.5 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
              <p className="text-[11px] text-muted mt-1">
                One per line, format <code className="font-mono bg-[#F6F4EF] px-1 rounded">SKU=grams</code>. Blank or invalid lines are ignored on save.
              </p>
            </div>
          </div>

          <button type="button" onClick={handleSaveShipping} disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

      {/* 7. WEBSITE CONTENT — unchanged */}
      {activeTab === "website-content" && (
        <div>
          <div className="bg-card border border-line rounded-[10px] p-5 mb-4 max-w-2xl">
            <h3 className="font-serif text-[18px] font-normal mb-1">Shipping & return policy</h3>
            <textarea rows={5} disabled={!isSuperAdmin}
              value={websiteContent.shipping_return_policy}
              onChange={(e) => setWebsiteContent({ ...websiteContent, shipping_return_policy: e.target.value })}
              className="w-full text-[13px] border border-line rounded-lg p-3 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
          </div>
          <button type="button" onClick={() => handleSave("website_content", websiteContent)}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50">
            {loading ? "Saving..." : "Save content"}
          </button>
        </div>
      )}

      {/* 8. USERS & ROLES — extended with new permission toggles */}
      {activeTab === "users-roles" && (
        <div className="space-y-5">
          <div className="bg-card border border-line rounded-[10px] p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-[18px] font-normal">Users</h3>
              <button type="button" onClick={() => setIsAddUserOpen(true)} disabled={!isSuperAdmin}
                className="font-medium bg-wine text-white rounded-lg px-3 py-1.5 text-xs hover:bg-[#181E15] disabled:opacity-50 cursor-pointer">
                + Add User
              </button>
            </div>
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider text-muted border-b border-line text-left">
                  <th className="pb-2 font-medium">User</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6F4EF]">
                {initialAdmins.map((u: any) => (
                  <tr key={u.id}>
                    <td className="py-3">
                      <div className="font-medium text-ink">{u.name}</div>
                      <div className="text-xs text-muted">{u.email}</div>
                    </td>
                    <td className="py-3">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#EFEBE2]">{u.role}</span>
                    </td>
                    <td className="py-3 text-right">
                      {isSuperAdmin && u.id !== currentAdmin?.id && (
                        <>
                          <button type="button"
                            onClick={() => handleRoleChange(u.id, u.role === "superadmin" ? "staff" : "superadmin")}
                            className="text-wine-ink underline text-xs cursor-pointer mr-3">
                            Make {u.role === "superadmin" ? "Staff" : "Superadmin"}
                          </button>
                          <button type="button" onClick={() => handleDeleteUser(u.id)}
                            className="text-bad underline text-xs cursor-pointer">
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* NEW: workflow permissions */}
          <div className="bg-card border border-line rounded-[10px] p-5">
            <h3 className="font-serif text-[18px] font-normal mb-1">Workflow permissions</h3>
            <p className="text-muted text-[12.5px] mb-4">
              Controls server-side guards in the orders and returns modules.
            </p>
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                  Website Order Cancellation
                </label>
                <select disabled={!isSuperAdmin}
                  value={permissions.cancel_website_orders || "superadmin_only"}
                  onChange={(e) => setPermissions({ ...permissions, cancel_website_orders: e.target.value })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]">
                  <option value="superadmin_only">Superadmin only (recommended)</option>
                  <option value="staff_and_superadmin">Staff + Superadmin allowed</option>
                </select>
                <p className="text-[11px] text-muted mt-1">
                  Website orders still require a gateway refund outside the system.
                </p>
              </div>

              <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                <input type="checkbox" disabled={!isSuperAdmin}
                  checked={permissions.require_qc_review !== false}
                  onChange={(e) => setPermissions({ ...permissions, require_qc_review: e.target.checked })}
                  className="rounded text-wine focus:ring-wine" />
                <span>Require QC review step before deposit release</span>
              </label>
              <p className="text-[11px] text-muted pl-6 -mt-3">
                When enabled, returns must pass through "Start QC review" before releasing the deposit.
              </p>
            </div>
          </div>

          <button type="button" onClick={() => handleSave("permissions", permissions)}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>

          {isAddUserOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <form onSubmit={handleCreateUser}
                className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-line">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-serif text-[20px]">Add User</h3>
                  <button type="button" onClick={() => setIsAddUserOpen(false)}
                    className="text-muted hover:text-ink p-1 cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3 text-xs">
                  <input required placeholder="Full name" value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full border border-line rounded-lg px-3 py-2" />
                  <input required type="email" placeholder="Email" value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full border border-line rounded-lg px-3 py-2" />
                  <input required type="password" minLength={8} placeholder="Password (min 8 chars)" value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full border border-line rounded-lg px-3 py-2" />
                  <select value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full border border-line rounded-lg px-3 py-2">
                    <option value="staff">Staff</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 mt-5">
                  <button type="button" onClick={() => setIsAddUserOpen(false)}
                    className="px-3.5 py-1.5 border border-line rounded-lg text-xs font-medium hover:bg-[#F6F4EF]">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading}
                    className="px-4 py-1.5 bg-wine text-white rounded-lg text-xs font-medium hover:bg-[#181E15] disabled:opacity-50">
                    {loading ? "Creating..." : "Create User"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* 9. CHANGE PASSWORD — unchanged */}
      {activeTab === "change-password" && (
        <div className="bg-card border border-line rounded-[10px] p-5 mb-5 max-w-xl space-y-3.5">
          <div>
            <h3 className="font-serif text-[18px] font-normal mb-1">Change your password</h3>
            <p className="text-muted text-[12.5px]">
              Signed in as <span className="text-ink font-medium">{currentAdmin?.name}</span> ({currentAdmin?.email}).
              Your password is stored hashed — no one, including other admins, can see it.
            </p>
          </div>

          {pwFeedback && (
            <div className={`p-3 rounded-lg text-xs font-medium border ${
              pwFeedback.type === "success"
                ? "bg-[#F2F6EF] border-[#CAD3C5] text-wine-ink"
                : "bg-bad-bg border-[#D9A79C] text-bad"
            }`}>
              {pwFeedback.message}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <div>
              <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                Current Password <span className="text-bad">*</span>
              </label>
              <input type="password" required autoComplete="current-password"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                New Password <span className="text-bad">*</span>
              </label>
              <input type="password" required autoComplete="new-password" minLength={8}
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none" />
              <span className="text-[10px] text-muted mt-1 block">Minimum 8 characters.</span>
            </div>
            <div>
              <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                Confirm New Password <span className="text-bad">*</span>
              </label>
              <input type="password" required autoComplete="new-password" minLength={8}
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none" />
            </div>
            <div className="pt-2">
              <button type="submit" disabled={pwLoading}
                className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50 cursor-pointer">
                {pwLoading ? "Updating..." : "Update password"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 10. BUSINESS INFO — unchanged */}
      {activeTab === "business-info" && (
        <div>
          <div className="bg-card border border-line rounded-[10px] p-5 mb-5 max-w-xl space-y-3.5">
            {[
              { key: "brand_name", label: "Brand Name" },
              { key: "showroom", label: "Showroom" },
              { key: "operating_hours", label: "Operating Hours" },
              { key: "whatsapp_business_number", label: "WhatsApp Business Number" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">{label}</label>
                <input disabled={!isSuperAdmin}
                  value={(businessInfo as any)[key] || ""}
                  onChange={(e) => setBusinessInfo({ ...businessInfo, [key]: e.target.value })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] disabled:bg-[#F6F4EF]" />
              </div>
            ))}
          </div>
          <button type="button" onClick={() => handleSave("business_info", businessInfo)}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50">
            {loading ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}

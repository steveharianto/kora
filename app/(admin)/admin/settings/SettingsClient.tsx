'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  saveAppSetting,
  saveDepositTiers,
  createAdminUser,
  updateAdminRole,
  deleteAdminUser,
} from '@/app/actions/settings';
import { formatRupiah } from '@/lib/utils';

interface SettingsClientProps {
  activeTab: string;
  settingsMap: Record<string, any>;
  depositTiers: any[];
  admins: any[];
  types: any[];
  currentAdmin: any;
}

const TABS = [
  { key: 'automation', label: 'Automation' },
  { key: 'rental-rules', label: 'Rental rules' },
  { key: 'fittings', label: 'Fittings' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'website-content', label: 'Website content' },
  { key: 'users-roles', label: 'Users & roles' },
  { key: 'business-info', label: 'Business info' },
];

export default function SettingsClient({
  activeTab,
  settingsMap,
  depositTiers: initialDepositTiers,
  admins: initialAdmins,
  currentAdmin,
}: SettingsClientProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isSuperAdmin = currentAdmin?.role?.toLowerCase().replace(/[\s_-]+/g, '') === 'superadmin';

  // 1. Automation State
  const [automation, setAutomation] = useState(
    settingsMap.automation || {
      dress_buffers: [
        { type: 'Dress', days: 2 },
        { type: 'Kebaya', days: 3 },
        { type: 'Kaftan', days: 2 },
        { type: 'Set / Outer', days: 2 },
        { type: 'Top', days: 1 },
      ],
      accessory_buffers: [
        { type: 'Veil', days: 1 },
        { type: 'Belt / sash', days: 1 },
        { type: 'Jewelry', days: 0 },
        { type: 'Bag / clutch', days: 1 },
      ],
    }
  );

  // 2. Rental Rules State
  const [rentalRules, setRentalRules] = useState(
    settingsMap.rental_rules || {
      period: {
        rental_days: 3,
        return_deadline: 'Day 4 - return only',
        late_fee_day_1: 100000,
        escalation: 'Doubles each additional day',
        qc_refund_window: '2 x 24 hours after receipt',
        max_return_reminders: 2,
      },
      late_fee_schedule: [
        { label: 'Below Rp 500.000', fee: 100000 },
        { label: 'Rp 500.000 - 1.000.000', fee: 140000 },
        { label: 'Rp 1.000.001 - 2.000.000', fee: 200000 },
        { label: 'Above Rp 2.000.000', fee: 400000 },
      ],
    }
  );
  const [depositTiers, setDepositTiers] = useState(initialDepositTiers);

  // 3. Fittings State
  const [fittings, setFittings] = useState(
    settingsMap.fittings || {
      operating_hours: {
        weekday: { regular: '10:00 - 17:00', after_hours: '17:00 - 18:00' },
        saturday: { regular: '10:00 - 13:00', after_hours: '13:00 - 15:00' },
        sunday: { closed: true, note: 'Sunday: closed, no bookings possible.' },
      },
      session_rules: {
        max_dresses_per_session: 3,
        after_hours_fee: 100000,
        slot_length_hours: 1,
      },
    }
  );

  // 4. Notifications State
  const [notifications, setNotifications] = useState(settingsMap.notifications || {});
  const [previewTemplateKey, setPreviewTemplateKey] = useState<string | null>(null);

  // 5. Shipping State (Normalized to structured dispatch addresses)
  const [shipping, setShipping] = useState(() => {
    const raw = settingsMap.shipping || {};
    const rawPrimary = raw.dispatch_addresses?.primary;
    const rawSecondary = raw.dispatch_addresses?.secondary;

    return {
      ...raw,
      dispatch_addresses: {
        primary: typeof rawPrimary === 'object' && rawPrimary !== null ? rawPrimary : {
          name: 'KORA Showroom Jakarta',
          phone: '081234567890',
          street_address: typeof rawPrimary === 'string' ? rawPrimary : 'Jl. Gunawarman No. 30, Kebayoran Baru',
          city: 'Jakarta Selatan',
          postal_code: '12180',
          latitude: -6.23827,
          longitude: 106.81056,
        },
        secondary: typeof rawSecondary === 'object' && rawSecondary !== null ? rawSecondary : {
          name: 'KORA Studio Semarang',
          phone: '081234567891',
          street_address: typeof rawSecondary === 'string' ? rawSecondary : 'Puri Anjasmoro L2 No. 9B',
          city: 'Semarang',
          postal_code: '50144',
          latitude: -6.974,
          longitude: 110.393,
        },
      },
      return_address: raw.return_address || {
        drop_off_point: 'St. Moritz Ambassador Suites Tower, Unit 3808, Jl. Kembangan Kerep No. 1',
      },
      delivery_lead_times: raw.delivery_lead_times || [],
      courier_policy: raw.courier_policy || {
        provider: 'Biteship - multi-courier (Paxel, Gosend, JNE, Tiki...)',
        dispatch_mode: 'Manual - admin books after address confirmation',
        return_couriers_offered: 'Paxel - Regular, Gosend - Instant, JNE - REG, Tiki - ONS',
      },
      refund_payout_methods: raw.refund_payout_methods || 'Bank transfer, Dana, OVO, GoPay, Cash',
    };
  });

  // 6. Website Content State
  const [websiteContent, setWebsiteContent] = useState(
    settingsMap.website_content || {
      shipping_return_policy: '',
    }
  );

  // 7. Users & Roles State
  const [permissions, setPermissions] = useState(
    settingsMap.permissions || {
      reset_order_draft: 'superadmin_only',
      refund_store_credit: 'superadmin_only',
      archive_inventory_item: 'staff_and_superadmin',
      delete_inventory_item: 'superadmin_only',
      staff_edits_product_info: 'require_approval',
    }
  );
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'staff' });

  // 8. Business Info State
  const [businessInfo, setBusinessInfo] = useState(
    settingsMap.business_info || {
      brand_name: 'KORA',
      showroom: '',
      operating_hours: '',
      whatsapp_business_number: '',
    }
  );

  // Handlers
  const handleSave = async (key: string, payload: any) => {
    setLoading(true);
    setFeedback(null);
    const res = await saveAppSetting(key, payload);
    if (res?.error) {
      setFeedback({ type: 'error', message: res.error });
    } else {
      setFeedback({ type: 'success', message: 'Changes saved successfully.' });
      setTimeout(() => setFeedback(null), 3000);
    }
    setLoading(false);
  };

  const handleSaveRentalRules = async () => {
    setLoading(true);
    setFeedback(null);
    const [rulesRes, tiersRes] = await Promise.all([
      saveAppSetting('rental_rules', rentalRules),
      saveDepositTiers(depositTiers),
    ]);

    if (rulesRes?.error || tiersRes?.error) {
      setFeedback({ type: 'error', message: rulesRes?.error || tiersRes?.error || 'Failed to save.' });
    } else {
      setFeedback({ type: 'success', message: 'Rental rules and deposit tiers updated.' });
      setTimeout(() => setFeedback(null), 3000);
    }
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await createAdminUser(newUser);
    if (res?.error) {
      alert(res.error);
    } else {
      setIsAddUserOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'staff' });
      alert('User added successfully.');
    }
    setLoading(false);
  };

  const handleRoleChange = async (adminId: string, role: string) => {
    setLoading(true);
    const res = await updateAdminRole(adminId, role);
    if (res?.error) alert(res.error);
    setLoading(false);
  };

  const handleDeleteUser = async (adminId: string) => {
    if (!confirm('Permanently remove this user?')) return;
    setLoading(true);
    const res = await deleteAdminUser(adminId);
    if (res?.error) alert(res.error);
    setLoading(false);
  };

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-line mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`?tab=${t.key}`}
            className={`pb-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === t.key ? 'text-wine-ink border-b-2 border-wine' : 'text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {feedback && (
        <div
          className={`mb-4 p-3 rounded-lg text-xs font-medium border ${
            feedback.type === 'success'
              ? 'bg-[#F2F6EF] border-[#CAD3C5] text-wine-ink'
              : 'bg-bad-bg border-[#D9A79C] text-bad'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* 1. AUTOMATION */}
      {activeTab === 'automation' && (
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <div className="bg-card border border-line rounded-[10px] p-5">
              <h3 className="font-serif text-[18px] font-normal mb-1">Dress turnaround buffer</h3>
              <p className="text-muted text-[12.5px] mb-4">
                Days blocked on the rent calendar between the return deadline and next start date.
              </p>
              <div className="space-y-3">
                {automation.dress_buffers.map((item: any, idx: number) => (
                  <div key={item.type} className="flex items-center justify-between py-1">
                    <span className="text-[13px] text-ink font-medium">{item.type}</span>
                    <input
                      type="number"
                      min={0}
                      value={item.days}
                      onChange={(e) => {
                        const next = [...automation.dress_buffers];
                        next[idx].days = parseInt(e.target.value) || 0;
                        setAutomation({ ...automation, dress_buffers: next });
                      }}
                      className="w-24 text-right text-[13px] border border-line rounded-lg px-3 py-1.5 bg-[#FDFCFA]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-line rounded-[10px] p-5 flex flex-col justify-between">
              <div>
                <h3 className="font-serif text-[18px] font-normal mb-1">Accessory turnaround buffer</h3>
                <p className="text-muted text-[12.5px] mb-4">Set accessory turnaround buffers independently of dresses.</p>
                <div className="space-y-3">
                  {automation.accessory_buffers.map((item: any, idx: number) => (
                    <div key={item.type} className="flex items-center justify-between py-1">
                      <span className="text-[13px] text-ink font-medium">{item.type}</span>
                      <input
                        type="number"
                        min={0}
                        value={item.days}
                        onChange={(e) => {
                          const next = [...automation.accessory_buffers];
                          next[idx].days = parseInt(e.target.value) || 0;
                          setAutomation({ ...automation, accessory_buffers: next });
                        }}
                        className="w-24 text-right text-[13px] border border-line rounded-lg px-3 py-1.5 bg-[#FDFCFA]"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 p-3.5 bg-[#F6F4EF] rounded-lg border border-[#E5E0D6] text-[11.5px] text-ink">
                <strong>Override anywhere, anytime.</strong> Type defaults apply automatically to item calendars. A per-item override set in Inventory always wins.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSave('automation', automation)}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      )}

      {/* 2. RENTAL RULES */}
      {activeTab === 'rental-rules' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-line rounded-[10px] p-5">
              <h3 className="font-serif text-[18px] font-normal mb-4">Rental period</h3>
              <div className="grid grid-cols-2 gap-3.5 mb-3">
                <div>
                  <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">Rental Days</label>
                  <input
                    type="number"
                    value={rentalRules.period.rental_days}
                    onChange={(e) =>
                      setRentalRules({
                        ...rentalRules,
                        period: { ...rentalRules.period, rental_days: parseInt(e.target.value) || 1 },
                      })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">Return Deadline</label>
                  <input
                    value={rentalRules.period.return_deadline}
                    onChange={(e) =>
                      setRentalRules({
                        ...rentalRules,
                        period: { ...rentalRules.period, return_deadline: e.target.value },
                      })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 mb-3">
                <div>
                  <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">Late Fee, Day 1 (Rp)</label>
                  <input
                    type="number"
                    value={rentalRules.period.late_fee_day_1}
                    onChange={(e) =>
                      setRentalRules({
                        ...rentalRules,
                        period: { ...rentalRules.period, late_fee_day_1: parseInt(e.target.value) || 0 },
                      })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">Escalation</label>
                  <input
                    value={rentalRules.period.escalation}
                    onChange={(e) =>
                      setRentalRules({
                        ...rentalRules,
                        period: { ...rentalRules.period, escalation: e.target.value },
                      })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">QC Refund Window</label>
                  <input
                    value={rentalRules.period.qc_refund_window}
                    onChange={(e) =>
                      setRentalRules({
                        ...rentalRules,
                        period: { ...rentalRules.period, qc_refund_window: e.target.value },
                      })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">Max Return Reminders</label>
                  <input
                    type="number"
                    value={rentalRules.period.max_return_reminders}
                    onChange={(e) =>
                      setRentalRules({
                        ...rentalRules,
                        period: { ...rentalRules.period, max_return_reminders: parseInt(e.target.value) || 1 },
                      })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                  />
                </div>
              </div>
            </div>

            <div className="bg-card border border-line rounded-[10px] p-5 flex flex-col justify-between">
              <div>
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
                          {i === 0
                            ? `Up to ${formatRupiah(tier.price_up_to)}`
                            : i === depositTiers.length - 1
                            ? `Above ${formatRupiah(depositTiers[i - 1]?.price_up_to)}`
                            : `${formatRupiah(depositTiers[i - 1]?.price_up_to + 1)} - ${formatRupiah(tier.price_up_to)}`}
                        </td>
                        <td className="py-2.5 text-right font-medium text-ink">
                          <input
                            type="number"
                            value={tier.deposit_value}
                            onChange={(e) => {
                              const updated = [...depositTiers];
                              updated[i].deposit_value = parseFloat(e.target.value) || 0;
                              setDepositTiers(updated);
                            }}
                            className="w-32 text-right border border-line rounded px-2 py-1 text-xs bg-[#FDFCFA]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[11px] text-muted">
                Tiers mirror the active rental ledger and auto-calculate on inventory creation.
              </div>
            </div>
          </div>

          <div className="bg-card border border-line rounded-[10px] p-5">
            <h3 className="font-serif text-[18px] font-normal mb-1">
              Late fee schedule <span className="text-[12px] text-muted font-sans">- per day late, deducted from deposit</span>
            </h3>
            <div className="divide-y divide-line mt-3 max-w-xl">
              {rentalRules.late_fee_schedule.map((row: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-2.5">
                  <span className="text-[13px] text-ink">{row.label}</span>
                  <input
                    type="number"
                    value={row.fee}
                    onChange={(e) => {
                      const next = [...rentalRules.late_fee_schedule];
                      next[idx].fee = parseInt(e.target.value) || 0;
                      setRentalRules({ ...rentalRules, late_fee_schedule: next });
                    }}
                    className="w-32 text-right text-[13px] border border-line rounded-lg px-3 py-1 bg-[#FDFCFA]"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveRentalRules}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      )}

      {/* 3. FITTINGS */}
      {activeTab === 'fittings' && (
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <div className="bg-card border border-line rounded-[10px] p-5">
              <h3 className="font-serif text-[18px] font-normal mb-1">Operating hours</h3>
              <p className="text-muted text-[12.5px] mb-4">Drives the day-aware slot picker on the fittings schedule.</p>
              <div className="space-y-4">
                <div>
                  <div className="text-[10.5px] tracking-wider uppercase text-muted font-medium mb-1.5">Monday - Friday</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-muted mb-1">REGULAR HOURS</label>
                      <input
                        value={fittings.operating_hours.weekday.regular}
                        onChange={(e) =>
                          setFittings({
                            ...fittings,
                            operating_hours: {
                              ...fittings.operating_hours,
                              weekday: { ...fittings.operating_hours.weekday, regular: e.target.value },
                            },
                          })
                        }
                        className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted mb-1">AFTER HOURS (+FEE)</label>
                      <input
                        value={fittings.operating_hours.weekday.after_hours}
                        onChange={(e) =>
                          setFittings({
                            ...fittings,
                            operating_hours: {
                              ...fittings.operating_hours,
                              weekday: { ...fittings.operating_hours.weekday, after_hours: e.target.value },
                            },
                          })
                        }
                        className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[10.5px] tracking-wider uppercase text-muted font-medium mb-1.5">Saturday</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-muted mb-1">REGULAR HOURS</label>
                      <input
                        value={fittings.operating_hours.saturday.regular}
                        onChange={(e) =>
                          setFittings({
                            ...fittings,
                            operating_hours: {
                              ...fittings.operating_hours,
                              saturday: { ...fittings.operating_hours.saturday, regular: e.target.value },
                            },
                          })
                        }
                        className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted mb-1">AFTER HOURS (+FEE)</label>
                      <input
                        value={fittings.operating_hours.saturday.after_hours}
                        onChange={(e) =>
                          setFittings({
                            ...fittings,
                            operating_hours: {
                              ...fittings.operating_hours,
                              saturday: { ...fittings.operating_hours.saturday, after_hours: e.target.value },
                            },
                          })
                        }
                        className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                      />
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted pt-2 border-t border-line">
                  {fittings.operating_hours.sunday.note || 'Sunday: closed, no bookings possible.'}
                </div>
              </div>
            </div>

            <div className="bg-card border border-line rounded-[10px] p-5 flex flex-col justify-between">
              <div>
                <h3 className="font-serif text-[18px] font-normal mb-4">Session rules</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                      Max Dresses Per Session
                    </label>
                    <input
                      type="number"
                      value={fittings.session_rules.max_dresses_per_session}
                      onChange={(e) =>
                        setFittings({
                          ...fittings,
                          session_rules: {
                            ...fittings.session_rules,
                            max_dresses_per_session: parseInt(e.target.value) || 1,
                          },
                        })
                      }
                      className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                      After-Hours Fitting Fee (Rp)
                    </label>
                    <input
                      type="number"
                      value={fittings.session_rules.after_hours_fee}
                      onChange={(e) =>
                        setFittings({
                          ...fittings,
                          session_rules: {
                            ...fittings.session_rules,
                            after_hours_fee: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                    />
                  </div>
                </div>
              </div>

              <div className="text-[11.5px] text-muted mt-6">
                Slot length is fixed at 1 hour - staff manages the changeover.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSave('fittings', fittings)}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      )}

      {/* 4. NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div>
          <div className="bg-card border border-line rounded-[10px] p-5 mb-5">
            <h3 className="font-serif text-[18px] font-normal mb-1">WhatsApp automation</h3>
            <p className="text-muted text-[12.5px] mb-5">
              Placeholders in [BRACKETS] are auto-filled from the record at send time.
            </p>

            <div className="space-y-4">
              {Object.entries(notifications).map(([key, item]: [string, any]) => (
                <div key={key} className="border border-line rounded-lg p-4 bg-[#FDFCFA]">
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <h4 className="font-medium text-[13.5px] text-ink">{item.title}</h4>
                      <p className="text-[11px] text-muted font-mono mt-0.5">
                        Placeholders: {item.placeholders}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewTemplateKey(key)}
                      className="text-xs font-medium border border-line px-2.5 py-1 rounded hover:bg-[#F6F4EF]"
                    >
                      Preview
                    </button>
                  </div>

                  <textarea
                    rows={2}
                    value={item.template}
                    onChange={(e) => {
                      const updated = { ...notifications };
                      updated[key].template = e.target.value;
                      setNotifications(updated);
                    }}
                    className="w-full text-[13px] border border-line rounded-lg p-2.5 bg-white focus:ring-1 focus:ring-wine focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSave('notifications', notifications)}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save changes'}
          </button>

          {previewTemplateKey && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-xl p-5 max-w-md w-full shadow-lg border border-line">
                <h4 className="font-serif text-[18px] mb-2">WhatsApp Preview</h4>
                <div className="p-3.5 bg-[#DCF8C6]/40 rounded-lg border border-[#CAD3C5] text-[13px] text-ink mb-4 whitespace-pre-wrap leading-relaxed">
                  {notifications[previewTemplateKey]?.template
                    ?.replace(/\[CUSTOMER_NAME\]/g, 'Dea Kirana')
                    ?.replace(/\[ORDER_ID\]/g, 'S0241')
                    ?.replace(/\[INVOICE_LINK\]/g, 'kora.com/inv/s0241')
                    ?.replace(/\[TOTAL\]/g, 'Rp 1.075.000')
                    ?.replace(/\[TRACKING_LINK\]/g, 'biteship.com/track/BTS-88213')
                    ?.replace(/\[RETURN_DEADLINE\]/g, '27/08/2026')
                    ?.replace(/\[REFUND_AMOUNT\]/g, 'Rp 150.000')
                    ?.replace(/\[QC_SUMMARY\]/g, 'Items verified with no deductions.')
                    ?.replace(/\[FITTING_TIME\]/g, '14:00')}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPreviewTemplateKey(null)}
                    className="px-4 py-1.5 bg-card border border-line text-xs rounded-lg hover:bg-[#F6F4EF]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. SHIPPING (WITH COORDINATES FOR BITESHIP) */}
      {activeTab === 'shipping' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Primary Origin (Showroom) */}
            <div className="bg-card border border-line rounded-[10px] p-5">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-serif text-[18px] font-normal">Primary Origin (Showroom)</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-ok-bg text-ok px-2 py-0.5 rounded">
                  Biteship Origin
                </span>
              </div>
              <p className="text-muted text-[12px] mb-3">
                Courier pickup location. Accurate latitude, longitude, and phone are strictly required by Biteship.
              </p>

              <div className="space-y-2.5 text-[13px]">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] tracking-wider uppercase text-muted mb-0.5">Contact Name</label>
                    <input
                      value={shipping.dispatch_addresses?.primary?.name || ''}
                      onChange={(e) =>
                        setShipping({
                          ...shipping,
                          dispatch_addresses: {
                            ...shipping.dispatch_addresses,
                            primary: { ...shipping.dispatch_addresses?.primary, name: e.target.value },
                          },
                        })
                      }
                      className="w-full border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] tracking-wider uppercase text-muted mb-0.5">Phone Number</label>
                    <input
                      value={shipping.dispatch_addresses?.primary?.phone || ''}
                      onChange={(e) =>
                        setShipping({
                          ...shipping,
                          dispatch_addresses: {
                            ...shipping.dispatch_addresses,
                            primary: { ...shipping.dispatch_addresses?.primary, phone: e.target.value },
                          },
                        })
                      }
                      className="w-full border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] tracking-wider uppercase text-muted mb-0.5">Street Address</label>
                  <input
                    value={shipping.dispatch_addresses?.primary?.street_address || ''}
                    onChange={(e) =>
                      setShipping({
                        ...shipping,
                        dispatch_addresses: {
                          ...shipping.dispatch_addresses,
                          primary: { ...shipping.dispatch_addresses?.primary, street_address: e.target.value },
                        },
                      })
                    }
                    className="w-full border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] tracking-wider uppercase text-muted mb-0.5">City</label>
                    <input
                      value={shipping.dispatch_addresses?.primary?.city || ''}
                      onChange={(e) =>
                        setShipping({
                          ...shipping,
                          dispatch_addresses: {
                            ...shipping.dispatch_addresses,
                            primary: { ...shipping.dispatch_addresses?.primary, city: e.target.value },
                          },
                        })
                      }
                      className="w-full border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] tracking-wider uppercase text-muted mb-0.5">Postal Code</label>
                    <input
                      value={shipping.dispatch_addresses?.primary?.postal_code || ''}
                      onChange={(e) =>
                        setShipping({
                          ...shipping,
                          dispatch_addresses: {
                            ...shipping.dispatch_addresses,
                            primary: { ...shipping.dispatch_addresses?.primary, postal_code: e.target.value },
                          },
                        })
                      }
                      className="w-full border border-line rounded-lg px-2.5 py-1.5 bg-[#FDFCFA]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 p-2.5 bg-[#F6F4EF] rounded-lg border border-[#E5E0D6]">
                  <div>
                    <label className="block text-[10px] tracking-wider uppercase text-ink font-semibold mb-0.5">
                      Origin Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={shipping.dispatch_addresses?.primary?.latitude ?? ''}
                      onChange={(e) =>
                        setShipping({
                          ...shipping,
                          dispatch_addresses: {
                            ...shipping.dispatch_addresses,
                            primary: {
                              ...shipping.dispatch_addresses?.primary,
                              latitude: e.target.value ? parseFloat(e.target.value) : null,
                            },
                          },
                        })
                      }
                      className="w-full border border-line rounded px-2 py-1 bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] tracking-wider uppercase text-ink font-semibold mb-0.5">
                      Origin Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={shipping.dispatch_addresses?.primary?.longitude ?? ''}
                      onChange={(e) =>
                        setShipping({
                          ...shipping,
                          dispatch_addresses: {
                            ...shipping.dispatch_addresses,
                            primary: {
                              ...shipping.dispatch_addresses?.primary,
                              longitude: e.target.value ? parseFloat(e.target.value) : null,
                            },
                          },
                        })
                      }
                      className="w-full border border-line rounded px-2 py-1 bg-white text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Inbound Return Destination */}
            <div className="bg-card border border-line rounded-[10px] p-5 flex flex-col justify-between">
              <div>
                <h3 className="font-serif text-[18px] font-normal mb-1">Return Destination</h3>
                <p className="text-muted text-[12px] mb-3">Address printed on return booking slips.</p>
                <div>
                  <label className="block text-[10px] tracking-wider uppercase text-muted mb-1">
                    Drop-Off Point
                  </label>
                  <textarea
                    rows={4}
                    value={shipping.return_address?.drop_off_point || ''}
                    onChange={(e) =>
                      setShipping({
                        ...shipping,
                        return_address: { ...shipping.return_address, drop_off_point: e.target.value },
                      })
                    }
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                  />
                </div>
              </div>

              <div className="mt-4 p-3 bg-[#F6F4EF] rounded-lg border border-[#E5E0D6] text-xs text-muted">
                <strong>Biteship Note:</strong> On-demand couriers (GoSend, Grab, Paxel) will fail if origin or destination coordinates are missing.
              </div>
            </div>
          </div>

          {/* Delivery Lead Times */}
          <div className="bg-card border border-line rounded-[10px] p-5">
            <h3 className="font-serif text-[18px] font-normal mb-1">Delivery lead time</h3>
            <p className="text-muted text-[12.5px] mb-4">Calculates auto-suggested Send Dates per postal prefix.</p>

            <table className="w-full text-[13px] max-w-2xl mb-4">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider text-muted border-b border-line text-left">
                  <th className="pb-2 font-medium">Postal Prefix</th>
                  <th className="pb-2 font-medium">Region</th>
                  <th className="pb-2 font-medium text-right">Days Before Event</th>
                </tr>
              </thead>
              <tbody>
                {shipping.delivery_lead_times?.map((lead: any, i: number) => (
                  <tr key={lead.prefix} className="border-b border-line/50 last:border-none">
                    <td className="py-2 font-mono text-muted text-xs">{lead.prefix}</td>
                    <td className="py-2">{lead.region}</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        value={lead.days}
                        onChange={(e) => {
                          const next = [...shipping.delivery_lead_times];
                          next[i].days = parseInt(e.target.value) || 1;
                          setShipping({ ...shipping, delivery_lead_times: next });
                        }}
                        className="w-16 text-right border border-line rounded px-2 py-1 bg-[#FDFCFA]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 border-t border-line">
              <div>
                <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                  Return Couriers Offered
                </label>
                <input
                  value={shipping.courier_policy?.return_couriers_offered || ''}
                  onChange={(e) =>
                    setShipping({
                      ...shipping,
                      courier_policy: { ...shipping.courier_policy, return_couriers_offered: e.target.value },
                    })
                  }
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                />
              </div>
              <div>
                <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                  Refund & Payout Methods Offered
                </label>
                <input
                  value={shipping.refund_payout_methods || ''}
                  onChange={(e) => setShipping({ ...shipping, refund_payout_methods: e.target.value })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSave('shipping', shipping)}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      )}

      {/* 6. WEBSITE CONTENT */}
      {activeTab === 'website-content' && (
        <div>
          <div className="bg-card border border-line rounded-[10px] p-5 mb-4 max-w-2xl">
            <h3 className="font-serif text-[18px] font-normal mb-1">Shipping & return policy</h3>
            <p className="text-muted text-[12.5px] mb-3">One shared block shown across every product detail page.</p>
            <textarea
              rows={5}
              value={websiteContent.shipping_return_policy}
              onChange={(e) =>
                setWebsiteContent({ ...websiteContent, shipping_return_policy: e.target.value })
              }
              className="w-full text-[13px] border border-line rounded-lg p-3 bg-[#FDFCFA] focus:ring-1 focus:ring-wine focus:outline-none leading-relaxed"
            />
          </div>

          <button
            type="button"
            onClick={() => handleSave('website_content', websiteContent)}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save content'}
          </button>
        </div>
      )}

      {/* 7. USERS & ROLES */}
      {activeTab === 'users-roles' && (
        <div className="space-y-5">
          <div className="bg-card border border-line rounded-[10px] p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-[18px] font-normal">Users</h3>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(true)}
                disabled={!isSuperAdmin}
                className="font-medium bg-wine text-white rounded-lg px-3 py-1.5 text-xs hover:bg-[#181E15] disabled:opacity-50 cursor-pointer"
              >
                + Add User
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wider text-muted border-b border-line text-left">
                    <th className="pb-2 font-medium">User</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium">Access</th>
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
                        <span
                          className={`text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded ${
                            u.role === 'superadmin' ? 'bg-[#EAF3E7] text-[#2E7D47]' : 'bg-[#EFEBE2] text-ink'
                          }`}
                        >
                          {u.role === 'superadmin' ? 'SUPER ADMIN' : 'STAFF'}
                        </span>
                      </td>
                      <td className="py-3 text-muted text-xs">
                        {u.role === 'superadmin'
                          ? 'Everything incl. settings & payouts'
                          : 'Orders, fittings, inventory status - no settings, no reports'}
                      </td>
                      <td className="py-3 text-right">
                        {isSuperAdmin && u.id !== currentAdmin?.id && (
                          <div className="flex justify-end gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => handleRoleChange(u.id, u.role === 'superadmin' ? 'staff' : 'superadmin')}
                              className="text-wine-ink underline"
                            >
                              Make {u.role === 'superadmin' ? 'Staff' : 'Superadmin'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-bad underline ml-2"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-card border border-line rounded-[10px] p-5">
            <h3 className="font-serif text-[18px] font-normal mb-1">Permissions</h3>
            <p className="text-muted text-[12.5px] mb-4">Guardrails for sensitive system actions.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                  Reset a Posted (Manual) Order to Draft
                </label>
                <select
                  value={permissions.reset_order_draft}
                  onChange={(e) => setPermissions({ ...permissions, reset_order_draft: e.target.value })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                >
                  <option value="superadmin_only">Super Admin only</option>
                  <option value="staff_and_superadmin">Staff + Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                  Refund Store Credit
                </label>
                <select
                  value={permissions.refund_store_credit}
                  onChange={(e) => setPermissions({ ...permissions, refund_store_credit: e.target.value })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                >
                  <option value="superadmin_only">Super Admin only</option>
                  <option value="staff_and_superadmin">Staff + Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                  Archive an Inventory Item
                </label>
                <select
                  value={permissions.archive_inventory_item}
                  onChange={(e) => setPermissions({ ...permissions, archive_inventory_item: e.target.value })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                >
                  <option value="staff_and_superadmin">Staff + Super Admin</option>
                  <option value="superadmin_only">Super Admin only</option>
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                  Delete an Inventory Item
                </label>
                <select
                  value={permissions.delete_inventory_item}
                  onChange={(e) => setPermissions({ ...permissions, delete_inventory_item: e.target.value })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                >
                  <option value="superadmin_only">Super Admin only</option>
                  <option value="staff_and_superadmin">Staff + Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                  Staff Edits to Product Information
                </label>
                <select
                  value={permissions.staff_edits_product_info}
                  onChange={(e) => setPermissions({ ...permissions, staff_edits_product_info: e.target.value })}
                  className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
                >
                  <option value="require_approval">Require Super Admin approval</option>
                  <option value="direct_save">Direct save (no approval)</option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSave('permissions', permissions)}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save changes'}
          </button>

          {isAddUserOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <form onSubmit={handleCreateUser} className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg border border-line">
                <h3 className="font-serif text-[20px] mb-3">Add System User</h3>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-[11px] uppercase text-muted mb-1">Name</label>
                    <input
                      required
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      className="w-full text-xs border border-line rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase text-muted mb-1">Email</label>
                    <input
                      required
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="w-full text-xs border border-line rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase text-muted mb-1">Temporary Password</label>
                    <input
                      required
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full text-xs border border-line rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase text-muted mb-1">Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="w-full text-xs border border-line rounded px-3 py-2"
                    >
                      <option value="staff">Staff</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddUserOpen(false)}
                    className="px-3 py-1.5 border border-line text-xs rounded hover:bg-[#F6F4EF]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-3 py-1.5 bg-wine text-white text-xs rounded hover:bg-[#181E15]"
                  >
                    {loading ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* 8. BUSINESS INFO */}
      {activeTab === 'business-info' && (
        <div>
          <div className="bg-card border border-line rounded-[10px] p-5 mb-5 max-w-xl space-y-3.5">
            <div>
              <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">Brand Name</label>
              <input
                value={businessInfo.brand_name}
                onChange={(e) => setBusinessInfo({ ...businessInfo, brand_name: e.target.value })}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
              />
            </div>
            <div>
              <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">Showroom</label>
              <input
                value={businessInfo.showroom}
                onChange={(e) => setBusinessInfo({ ...businessInfo, showroom: e.target.value })}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
              />
            </div>
            <div>
              <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">Operating Hours</label>
              <input
                value={businessInfo.operating_hours}
                onChange={(e) => setBusinessInfo({ ...businessInfo, operating_hours: e.target.value })}
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
              />
            </div>
            <div>
              <label className="block text-[10.5px] tracking-wider uppercase text-muted mb-1">
                WhatsApp Business Number
              </label>
              <input
                value={businessInfo.whatsapp_business_number}
                onChange={(e) =>
                  setBusinessInfo({ ...businessInfo, whatsapp_business_number: e.target.value })
                }
                className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSave('business_info', businessInfo)}
            disabled={loading || !isSuperAdmin}
            className="font-medium bg-wine text-white rounded-lg px-4 py-2 text-sm hover:bg-[#181E15] transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  );
}

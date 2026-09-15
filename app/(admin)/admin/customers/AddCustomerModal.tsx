'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCustomer } from '@/app/actions/customers';

export default function AddCustomerModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    gender: 'Female',
    dob: '',
  });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    // Auto-normalize Indonesian local 08xx to international 628xx
    if (val.startsWith('08')) {
      val = '62' + val.slice(1);
    }
    setFormData((prev) => ({ ...prev, phone: val }));
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val) {
      setFormData((prev) => ({ ...prev, dob: '' }));
      return;
    }
    const parts = val.split('-');
    // Strict 4-digit year limit
    if (parts[0] && parts[0].length > 4) {
      parts[0] = parts[0].slice(0, 4);
      val = parts.join('-');
    }
    setFormData((prev) => ({ ...prev, dob: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (formData.phone.length < 9) {
      setErrorMsg('Please enter a valid phone number with country code (e.g. 628... or 614...).');
      setLoading(false);
      return;
    }

    const res = await createCustomer(formData);
    if (res.error) {
      setErrorMsg(res.error);
      setLoading(false);
      return;
    }

    setIsOpen(false);
    setLoading(false);
    router.push(`/admin/customers/${res.customerId}`);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="font-medium border border-wine bg-wine text-white rounded-lg px-3.5 py-2 text-sm hover:bg-[#181E15] transition cursor-pointer"
      >
        + Add Customer
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-card border border-line rounded-xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95">
            <h2 className="font-serif text-[22px] font-normal mb-1">New Customer</h2>
            <p className="text-[13px] text-muted mb-4">Create a customer profile. Addresses can be added immediately after.</p>

            {errorMsg && (
              <div className="mb-4 p-2.5 text-xs bg-bad-bg border border-[#D9A79C] text-bad rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    First Name <span className="text-bad">*</span>
                  </label>
                  <input
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                    Last Name
                  </label>
                  <input
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">
                  Phone (WhatsApp with Country Code) <span className="text-bad">*</span>
                </label>
                <input
                  required
                  placeholder="e.g. 628217389482 or 6148379202"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  className="w-full text-[13px] font-mono border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                />
                <span className="text-[10px] text-muted mt-1 block">
                  Must start with country code (e.g. 62 for Indonesia, 61 for Australia) without the &apos;+&apos; sign.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.14em] uppercase text-muted mb-1">Date of Birth</label>
                  <input
                    type="date"
                    max="9999-12-31"
                    value={formData.dob}
                    onChange={handleDobChange}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 bg-[#FDFCFA] focus:ring-2 focus:ring-[#CAD3C5] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-line rounded-lg text-xs font-medium hover:bg-[#F6F4EF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-wine text-white rounded-lg text-xs font-medium hover:bg-[#181E15] disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

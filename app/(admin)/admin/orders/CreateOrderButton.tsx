'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOrderDraft } from '@/app/actions/orders';

export default function CreateOrderButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    setLoading(true);
    const res = await createOrderDraft();
    if (res.error) {
      alert(res.error);
      setLoading(false);
      return;
    }

    if (res.orderId) {
      router.push(`/admin/orders/${res.orderId}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCreate}
      disabled={loading}
      className="font-medium bg-wine text-white rounded-lg px-3.5 py-2 text-[13px] hover:bg-[#181E15] transition cursor-pointer disabled:opacity-50"
    >
      {loading ? 'Creating...' : 'Create Order'}
    </button>
  );
}

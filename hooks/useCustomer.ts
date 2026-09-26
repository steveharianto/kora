'use client';

import { useEffect, useState } from 'react';
import type { SessionCustomer } from '@/lib/auth/session';

export type Customer = SessionCustomer;

export function useCustomer(initial: Customer | null = null) {
  const [customer, setCustomer] = useState<Customer | null>(initial);
  const [loading, setLoading] = useState(initial === null);

  useEffect(() => {
    if (initial !== null) {
      setCustomer(initial);
      setLoading(false);
      return;
    }

    let alive = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (alive) setCustomer(d.customer ?? null);
      })
      .catch(() => {
        if (alive) setCustomer(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [initial]);

  return { customer, loading };
}

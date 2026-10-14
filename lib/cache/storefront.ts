// Cached data fetchers for read-heavy, low-churn storefront tables.
//
// Every fetcher uses `unstable_cache` with:
//   • a short revalidate window (safety net)
//   • a tag so admin writes can invalidate instantly
//
// They must NOT use `createClient()` from `lib/supabase/server` because
// that reads cookies — a dynamic data source forbidden inside `unstable_cache`.

import { unstable_cache } from 'next/cache';
import { createStaticClient } from '@/lib/supabase/static';

/* ── Items ────────────────────────────────────────────────────────── */

export const getCachedShopRawItems = unstable_cache(
  async () => {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('items')
      .select(`
        sku,
        name,
        size,
        color,
        tags,
        rental_price,
        status,
        website_status,
        date_added,
        buffer_override,
        measurements,
        brands ( name ),
        types ( name, default_buffer_days ),
        item_images ( image_url, display_order )
      `)
      .eq('website_status', 'Published')
      .eq('is_archived', false)
      .order('date_added', { ascending: false });

    return data || [];
  },
  ['shop-raw-items'],
  { revalidate: 60, tags: ['items'] },
);

/* ── Deposit tiers ────────────────────────────────────────────────── */

export interface DepositTier {
  price_up_to: number;
  deposit_value: number;
}

export const getCachedDepositTiers = unstable_cache(
  async (): Promise<DepositTier[]> => {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('deposit_tiers')
      .select('price_up_to, deposit_value')
      .order('price_up_to', { ascending: true });

    return (data || []).map((t: any) => ({
      price_up_to: Number(t.price_up_to),
      deposit_value: Number(t.deposit_value),
    }));
  },
  ['deposit-tiers'],
  { revalidate: 300, tags: ['settings', 'deposit-tiers'] },
);

/* ── Rental rules (late fees, deposit policy text) ────────────────── */

export interface RentalRules {
  late_fee_schedule?: { label: string; fee: number }[];
  period?: Record<string, unknown>;
  [k: string]: unknown;
}

export const getCachedRentalRules = unstable_cache(
  async (): Promise<RentalRules | null> => {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'rental_rules')
      .single();

    return (data?.value as RentalRules) || null;
  },
  ['rental-rules'],
  { revalidate: 300, tags: ['settings', 'rental-rules'] },
);

/* ── Brands / Types (admin reference lists) ───────────────────────── */

export interface NamedRef {
  id: number;
  name: string;
}

export const getCachedBrands = unstable_cache(
  async (): Promise<NamedRef[]> => {
    const supabase = createStaticClient();
    const { data } = await supabase.from('brands').select('id, name').order('name');
    return data || [];
  },
  ['brands'],
  { revalidate: 300, tags: ['reference'] },
);

export const getCachedTypes = unstable_cache(
  async (): Promise<NamedRef[]> => {
    const supabase = createStaticClient();
    const { data } = await supabase.from('types').select('id, name').order('name');
    return data || [];
  },
  ['types'],
  { revalidate: 300, tags: ['reference'] },
);

export const getCachedCategories = unstable_cache(
  async (): Promise<NamedRef[]> => {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('categories')
      .select('id, name')
      .order('name');
    return data || [];
  },
  ['categories'],
  { revalidate: 300, tags: ['reference'] },
);

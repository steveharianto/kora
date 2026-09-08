import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from '@/app/actions/auth';
import SettingsClient from './SettingsClient';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedParams = await searchParams;
  const activeTab = resolvedParams.tab || 'automation';

  const supabase = await createClient();
  const currentAdmin = await getCurrentAdmin();

  // Fetch all app_settings records, deposit tiers, admins, and types in parallel
  const [settingsRes, depositTiersRes, adminsRes, typesRes] = await Promise.all([
    supabase.from('app_settings').select('*'),
    supabase.from('deposit_tiers').select('*').order('price_up_to', { ascending: true }),
    supabase.from('admins').select('id, name, email, role, is_active, created_at').order('created_at', { ascending: true }),
    supabase.from('types').select('*').order('id', { ascending: true }),
  ]);

  // Turn settings array into a keyed object: { automation: {...}, shipping: {...} }
  const settingsMap: Record<string, any> = {};
  (settingsRes.data || []).forEach((row) => {
    settingsMap[row.key] = row.value;
  });

  return (
    <div className="max-w-[1200px] pb-24">
      <div className="mb-5">
        <div className="text-[11px] tracking-[0.22em] uppercase text-muted mb-1 font-medium">
          System
        </div>
        <h1 className="font-serif text-[32px] font-normal tracking-[0.01em] text-ink">
          Settings
        </h1>
      </div>

      <SettingsClient
        activeTab={activeTab}
        settingsMap={settingsMap}
        depositTiers={depositTiersRes.data || []}
        admins={adminsRes.data || []}
        types={typesRes.data || []}
        currentAdmin={currentAdmin}
      />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/app/actions/auth";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedParams = await searchParams;
  const activeTab = resolvedParams.tab || "automation";

  const supabase = await createClient();
  const currentAdmin = await getCurrentAdmin();

  const [settingsRes, depositTiersRes, adminsRes] = await Promise.all([
    supabase.from("app_settings").select("*"),
    supabase
      .from("deposit_tiers")
      .select("*")
      .order("price_up_to", { ascending: true }),
    supabase
      .from("admins")
      .select("id, name, email, role, is_active, created_at")
      .order("created_at", { ascending: true }),
  ]);

  const settingsMap: Record<string, any> = {};
  (settingsRes.data || []).forEach((row) => {
    settingsMap[row.key] = row.value;
  });

  return (
    <div className="pb-24">
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
        currentAdmin={currentAdmin}
      />
    </div>
  );
}

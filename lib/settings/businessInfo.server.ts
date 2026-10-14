// lib/settings/businessInfo.server.ts
//
// Server-side reader for the `business_info` app_setting.
//
// Uses React cache() so multiple server components rendered in the same
// request tree share one DB round-trip. Safe to call from anywhere on the
// server; never import from a client component.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { normaliseOperatingHours, type OperatingHours } from "./businessInfo";

export const getOperatingHours = cache(async (): Promise<OperatingHours> => {
  const supabase = await createClient();

  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "business_info")
    .maybeSingle();

  return normaliseOperatingHours(
    (data?.value as Record<string, unknown> | null)?.operating_hours,
  );
});

// lib/settings/businessInfo.server.ts
//
// Server-side reader for the `business_info` app_setting.
//
// Uses React cache() so multiple server components rendered in the same
// request tree share one DB round-trip. Safe to call from anywhere on the
// server; never import from a client component.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { normaliseBusinessInfo, type BusinessInfo } from "./businessInfo";

export const getBusinessInfo = cache(async (): Promise<BusinessInfo> => {
  const supabase = await createClient();

  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "business_info")
    .maybeSingle();

  return normaliseBusinessInfo(data?.value);
});

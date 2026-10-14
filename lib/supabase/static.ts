// Cookie-free Supabase client for use inside `unstable_cache` and any other
// context where Next.js forbids dynamic data sources (cookies, headers).
//
// Since RLS is disabled and anon has full read grants (see the project
// notes), the anon key is sufficient. Using the service role here would
// work too but bypasses any future RLS we might add.

import { createClient } from '@supabase/supabase-js';

export function createStaticClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

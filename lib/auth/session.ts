import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const SESSION_COOKIE_NAME = 'kora_session';

export type SessionCustomer = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  status: string;
};

export async function getSessionCustomerId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function getSessionCustomer(): Promise<SessionCustomer | null> {
  const id = await getSessionCustomerId();
  if (!id) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, status')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as SessionCustomer;
}

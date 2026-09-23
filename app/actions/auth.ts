'use server';

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export interface AdminSession {
  id: string;
  name: string;
  email: string;
  role: string;
}

export async function loginAdmin(formData: { email: string; password: string }) {
  const supabase = await createClient();
  const email = formData.email.trim().toLowerCase();
  const plainPassword = formData.password;

  // 1. Query the admin record
  const { data: admin, error } = await supabase
    .from('admins')
    .select('id, name, email, password, role, is_active')
    .eq('email', email)
    .single();

  if (error) {
    console.error('Supabase Query Error:', error.message, error.details);
    return { error: `Database error: ${error.message}` };
  }

  if (!admin) {
    console.warn(`Admin record not found for email: ${email}`);
    return { error: 'Invalid email or password.' };
  }

  // 2. Account active status check
  if (!admin.is_active) {
    return { error: 'This account has been deactivated. Please contact support.' };
  }

  // 3. Verify hashed password
  const isValidPassword = await bcrypt.compare(plainPassword, admin.password);

  if (!isValidPassword) {
    console.warn(`Password mismatch for admin: ${email}`);
    return { error: 'Invalid email or password.' };
  }

  // 4. Create session payload
  const sessionData: AdminSession = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  };

  // 5. Set session cookie (httpOnly for security), plus display-only role & name cookies (readable by client UI)
  const cookieStore = await cookies();
  cookieStore.set('kora_admin_session', JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  cookieStore.set('kora_admin_role', admin.role, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  cookieStore.set('kora_admin_name', admin.name, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return { success: true };
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete('kora_admin_session');
  cookieStore.delete('kora_admin_role');
  cookieStore.delete('kora_admin_name');
  redirect('/admin');
}

export async function getCurrentAdmin(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('kora_admin_session');
  if (!sessionCookie?.value) return null;

  try {
    const parsed = JSON.parse(sessionCookie.value) as AdminSession;
    if (!parsed?.id) return null;

    // Validate against database to ensure account still exists and remains active
    const supabase = await createClient();
    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, name, email, role, is_active')
      .eq('id', parsed.id)
      .single();

    if (error || !admin || !admin.is_active) {
      return null;
    }

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    };
  } catch {
    return null;
  }
}

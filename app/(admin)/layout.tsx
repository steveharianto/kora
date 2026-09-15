'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTransition, useEffect, useState } from 'react';
import { logoutAdmin } from '@/app/actions/auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin';
  const [isPending, startTransition] = useTransition();
  const [adminRole, setAdminRole] = useState<string>('Staff');

  useEffect(() => {
    // Read non-sensitive role cookie set by server action
    const match = document.cookie.match(/kora_admin_role=([^;]+)/);
    if (match) {
      const role = decodeURIComponent(match[1]).toLowerCase();
      if (role.includes('super')) {
        setAdminRole('Super Admin');
      } else {
        setAdminRole('Staff');
      }
    }
  }, [pathname]);

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAdmin();
    });
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 w-60 bg-[#2C3527] text-white flex flex-col p-6 z-20">
        <div className="text-2xl font-serif tracking-[0.3em] text-[#F3EFE8] mb-8">
          KORA
        </div>

        <nav className="flex-1 space-y-1 text-sm font-medium">
          <div className="text-[10px] uppercase tracking-widest text-[#9CA893] pt-2 pb-1">Overview</div>
          <Link href="/admin/dashboard" className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors">
            Dashboard
          </Link>

          <div className="text-[10px] uppercase tracking-widest text-[#9CA893] pt-4 pb-1">Operations</div>
          <Link href="/admin/orders" className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors">
            Orders
          </Link>
          <Link href="/admin/returns" className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors">
            Returns
          </Link>
          <Link href="/admin/fittings" className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors">
            Fittings
          </Link>

          <div className="text-[10px] uppercase tracking-widest text-[#9CA893] pt-4 pb-1">Catalog</div>
          <Link href="/admin/inventory" className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors">
            Inventory
          </Link>
          <Link href="/admin/customers" className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors">
            Customers
          </Link>

          <div className="text-[10px] uppercase tracking-widest text-[#9CA893] pt-4 pb-1">System</div>
          <Link href="/admin/reports" className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors">
            Reports
          </Link>
          <Link href="/admin/settings" className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors">
            Settings
          </Link>
        </nav>

        <div className="pt-4 border-t border-[#141811] text-xs text-[#9CA893] flex items-end justify-between">
          <div>
            <span className="block font-semibold text-white">Admin Session</span>
            {adminRole}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            className="hover:text-[#D9A79C] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      </aside>

      <main className="ml-60 flex-1 p-10 min-w-0">
        {children}
      </main>
    </div>
  );
}

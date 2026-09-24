// app/(admin)/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition, useEffect, useState } from "react";
import { logoutAdmin } from "@/app/actions/auth";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin";
  const [isPending, startTransition] = useTransition();
  const [adminRole, setAdminRole] = useState<string>("Staff");
  const [adminName, setAdminName] = useState<string>("");

  // Sidebar collapse state — defaults to open, persisted in localStorage
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem("kora_admin_sidebar");
    if (stored === "closed") setIsSidebarOpen(false);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem(
        "kora_admin_sidebar",
        next ? "open" : "closed",
      );
      return next;
    });
  };

  useEffect(() => {
    const roleMatch = document.cookie.match(/kora_admin_role=([^;]+)/);
    if (roleMatch) {
      const role = decodeURIComponent(roleMatch[1]).toLowerCase();
      setAdminRole(role.includes("super") ? "Super Admin" : "Staff");
    }

    const nameMatch = document.cookie.match(/kora_admin_name=([^;]+)/);
    if (nameMatch) setAdminName(decodeURIComponent(nameMatch[1]));
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
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-60 bg-[#2C3527] text-white flex flex-col p-6 z-20 transition-transform duration-200 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/admin/dashboard"
            className="text-2xl font-serif tracking-[0.3em] text-[#F3EFE8] select-none hover:opacity-90 transition-opacity"
          >
            KORA
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Hide sidebar"
            title="Hide sidebar"
            className="p-1.5 rounded-lg hover:bg-[#3B4734] transition-colors cursor-pointer text-[#9CA893] hover:text-white"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 text-sm font-medium">
          <div className="text-[10px] uppercase tracking-widest text-[#9CA893] pt-2 pb-1">
            Overview
          </div>
          <Link
            href="/admin/dashboard"
            className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors"
          >
            Dashboard
          </Link>

          <div className="text-[10px] uppercase tracking-widest text-[#9CA893] pt-4 pb-1">
            Operations
          </div>
          <Link
            href="/admin/orders"
            className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors"
          >
            Orders
          </Link>
          <Link
            href="/admin/returns"
            className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors"
          >
            Returns
          </Link>
          <Link
            href="/admin/fittings"
            className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors"
          >
            Fittings
          </Link>

          <div className="text-[10px] uppercase tracking-widest text-[#9CA893] pt-4 pb-1">
            Catalog
          </div>
          <Link
            href="/admin/inventory"
            className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors"
          >
            Inventory
          </Link>
          <Link
            href="/admin/customers"
            className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors"
          >
            Customers
          </Link>

          <div className="text-[10px] uppercase tracking-widest text-[#9CA893] pt-4 pb-1">
            System
          </div>
          <Link
            href="/admin/reports"
            className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors"
          >
            Reports
          </Link>
          <Link
            href="/admin/settings"
            className="flex items-center px-3 py-2 rounded-lg hover:bg-[#3B4734] transition-colors"
          >
            Settings
          </Link>
        </nav>

        <div className="pt-4 border-t border-[#141811] text-xs text-[#9CA893] flex items-end justify-between">
          <div className="min-w-0 mr-3">
            <span
              className="block font-semibold text-white truncate"
              title={adminName || "Admin"}
            >
              {adminName || "Admin"}
            </span>
            {adminRole}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            className="hover:text-[#D9A79C] transition-colors disabled:opacity-50 cursor-pointer flex-shrink-0"
          >
            {isPending ? "Logging out..." : "Log out"}
          </button>
        </div>
      </aside>

      {/* Main content — margin adjusts with sidebar */}
      <main
        className={`flex-1 p-10 min-w-0 transition-all duration-200 ${
          isSidebarOpen ? "ml-60" : "ml-0"
        }`}
      >
        {/* Floating open button when sidebar is hidden */}
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Show sidebar"
            title="Show sidebar"
            className="fixed top-4 left-4 z-30 p-2 rounded-lg bg-[#2C3527] text-white shadow-lg hover:bg-[#3B4734] transition-colors cursor-pointer"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {children}
      </main>
    </div>
  );
}

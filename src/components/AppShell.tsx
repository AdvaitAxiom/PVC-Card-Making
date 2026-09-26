"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IdCard, LayoutGrid, LayoutTemplate, LogOut, Settings } from "lucide-react";
import { ConfirmProvider } from "./ConfirmDialog";
import { cx } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "My cards", icon: LayoutGrid },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/settings", label: "Backup", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <ConfirmProvider>
      <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <IdCard size={18} />
            </span>
            <span className="hidden sm:inline">PVC Card Maker</span>
          </Link>

          <nav className="ml-4 flex items-center gap-1">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <button onClick={signOut} className="btn-ghost ml-auto">
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="flex-1">{children}</main>
      </div>
    </ConfirmProvider>
  );
}

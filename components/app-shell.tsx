import type { ReactNode } from "react";
import { signOutAction } from "@/app/actions/auth";
import { NavLinks, type NavItem } from "@/components/nav-links";

export function AppShell({
  email,
  portal,
  nav,
  children,
}: {
  email: string | null;
  portal: string;
  nav: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print bg-navy text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-3 sm:px-6">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-tight">VTA Payroll</span>
            <span className="text-sm text-[#b9cdea]">{portal}</span>
          </div>
          <form action={signOutAction} className="flex items-center gap-3">
            {email ? <span className="hidden text-sm text-[#b9cdea] sm:inline">{email}</span> : null}
            <button type="submit" className="rounded-md px-3 py-1.5 text-sm text-white hover:bg-white/10">
              ออกจากระบบ
            </button>
          </form>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <NavLinks items={nav} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

/** โครงหน้าระหว่างรอตรวจสิทธิ์ (แสดงทันที ไม่รอ session) */
export function ShellFallback() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-[88px] max-w-7xl items-start px-4 pt-3 sm:px-6">
          <span className="text-lg font-semibold tracking-tight">VTA Payroll</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <p className="text-muted">กำลังโหลด…</p>
      </main>
    </div>
  );
}

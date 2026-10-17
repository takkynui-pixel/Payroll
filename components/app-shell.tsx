import type { ReactNode } from "react";
import { signOutAction } from "@/app/actions/auth";
import type { NavItem } from "@/components/nav-links";
import { ShellFrame } from "@/components/shell-frame";

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
    <ShellFrame
      portal={portal}
      nav={nav}
      email={email}
      signOut={
        <form action={signOutAction}>
          <button type="submit" className="rounded-lg px-3 py-1.5 text-sm text-navy hover:bg-mist">
            ออกจากระบบ
          </button>
        </form>
      }
    >
      {children}
    </ShellFrame>
  );
}

/** โครงหน้าระหว่างรอตรวจสิทธิ์ (แสดงทันที ไม่รอ session) */
export function ShellFallback() {
  return (
    <div className="min-h-screen">
      <aside className="sidebar-surface fixed inset-y-0 left-0 hidden w-64 lg:block" />
      <div className="lg:pl-64">
        <div className="h-16 border-b border-line/60 bg-surface" />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
          <p className="text-muted">กำลังโหลด…</p>
        </main>
      </div>
    </div>
  );
}

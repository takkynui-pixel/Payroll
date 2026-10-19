import type { ReactNode } from "react";
import { signOutAction } from "@/app/actions/auth";
import type { NavItem } from "@/components/nav-links";
import { NavIcon } from "@/components/nav-icons";
import { ShellFrame } from "@/components/shell-frame";

export function AppShell({
  email,
  portal,
  nav,
  notice,
  children,
}: {
  email: string | null;
  portal: string;
  nav: NavItem[];
  notice?: { count: number; href: string; label: string };
  children: ReactNode;
}) {
  return (
    <ShellFrame
      portal={portal}
      nav={nav}
      email={email}
      notice={notice}
      signOut={
        <form action={signOutAction}>
          <button type="submit" className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm text-ink hover:bg-soft">
            <NavIcon name="logout" className="size-4" />
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
      <div className="h-16 border-b border-line bg-surface" />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-8">
        <p className="text-muted">กำลังโหลด…</p>
      </main>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { NavLinks, type NavItem } from "@/components/nav-links";

/**
 * โครงหน้าหลัก: แถบเมนูซ้ายสีฟ้าสว่าง + แถบบน + เนื้อหา
 * จอแคบ (< lg) เมนูซ่อนเป็นลิ้นชักเปิดจากปุ่มด้านบน กด Esc หรือพื้นหลังเพื่อปิด
 */
export function ShellFrame({
  portal,
  nav,
  email,
  signOut,
  children,
}: {
  portal: string;
  nav: NavItem[];
  email: string | null;
  /** ฟอร์มออกจากระบบ (ส่งมาจาก server component เพราะเรียก server action) */
  signOut: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const initial = (email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen">
      {open ? (
        <button
          type="button"
          aria-label="ปิดเมนู"
          onClick={() => setOpen(false)}
          className="no-print fixed inset-0 z-30 bg-navy/40 lg:hidden"
        />
      ) : null}

      <aside
        id="sidebar"
        className={`sidebar-surface no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col gap-5 overflow-y-auto px-4 py-5 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="rounded-xl bg-surface px-3 py-3 shadow-card">
          <Image src="/brand/vta-logo.png" alt="VTA Service" width={720} height={217} priority className="h-auto w-full" />
        </div>
        <div>
          <p className="px-3 pb-2 text-xs font-semibold tracking-wide text-[#1f4e86]">{portal}</p>
          <NavLinks items={nav} onNavigate={() => setOpen(false)} />
        </div>
        <p className="mt-auto px-3 text-xs text-[#1f4e86]">VTA Payroll</p>
      </aside>

      <div className="lg:pl-64 print:pl-0">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line/60 bg-surface/90 px-4 backdrop-blur sm:px-8">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="sidebar"
            className="grid size-10 place-items-center rounded-lg text-navy hover:bg-mist lg:hidden"
          >
            <span className="sr-only">เมนู</span>
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <p className="text-sm font-medium text-navy lg:hidden">{portal}</p>
          <div className="ml-auto flex items-center gap-3">
            {email ? <span className="hidden text-sm text-muted sm:inline">{email}</span> : null}
            <span aria-hidden className="grid size-9 place-items-center rounded-full bg-[#d6ecff] text-sm font-semibold text-brand">
              {initial}
            </span>
            {signOut}
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

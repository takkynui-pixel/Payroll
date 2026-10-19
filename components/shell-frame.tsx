"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavIcon } from "@/components/nav-icons";
import { NavLinks, type NavItem } from "@/components/nav-links";

/**
 * โครงหน้าหลักแบบ Payrole: แถบบนสีขาว (โลโก้ + แท็บเมนูทรงแคปซูล + ตั้งค่า/แจ้งเตือน/ผู้ใช้) และเนื้อหาเต็มความกว้าง
 * จอแคบ (< lg) แท็บเมนูซ่อนเป็นลิ้นชักเปิดจากปุ่มด้านบน กด Esc หรือพื้นหลังเพื่อปิด
 */
export function ShellFrame({
  portal,
  nav,
  email,
  signOut,
  notice,
  children,
}: {
  portal: string;
  nav: NavItem[];
  email: string | null;
  /** ฟอร์มออกจากระบบ (ส่งมาจาก server component เพราะเรียก server action) */
  signOut: ReactNode;
  /** ตัวเลขแจ้งเตือนที่กระดิ่ง (เช่น งวดที่รอดำเนินการ) */
  notice?: { count: number; href: string; label: string };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open && !menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMenu(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (menu && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, menu]);

  const name = (email ?? "ผู้ใช้").split("@")[0];
  const initial = name.charAt(0).toUpperCase();
  const settings = nav.find((n) => n.href.endsWith("/users"));
  const tabs = nav.filter((n) => n !== settings);

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-8">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="drawer"
            className="grid size-11 place-items-center rounded-full text-ink hover:bg-page lg:hidden"
          >
            <span className="sr-only">เมนู</span>
            <NavIcon name={open ? "close" : "menu"} className="size-6" />
          </button>

          <Link href={nav[0]?.href ?? "/"} className="shrink-0" aria-label="VTA Service หน้าแรก">
            <Image src="/brand/vta-logo.png" alt="VTA Service" width={720} height={217} priority className="h-9 w-auto" />
          </Link>

          <div className="mx-auto hidden min-w-0 overflow-x-auto lg:block">
            <NavLinks items={tabs} variant="tabs" />
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {settings ? (
              <Link
                href={settings.href}
                className="grid size-11 place-items-center rounded-full text-ink hover:bg-page"
              >
                <NavIcon name="settings" />
                <span className="sr-only">{settings.label}</span>
              </Link>
            ) : null}
            {notice ? (
              <Link href={notice.href} className="relative grid size-11 place-items-center rounded-full text-ink hover:bg-page">
                <NavIcon name="bell" />
                <span className="sr-only">{notice.label}</span>
                {notice.count > 0 ? (
                  <span
                    aria-hidden
                    className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold leading-5 text-white"
                  >
                    {notice.count > 99 ? "99+" : notice.count}
                  </span>
                ) : null}
              </Link>
            ) : null}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenu((v) => !v)}
                aria-expanded={menu}
                aria-haspopup="true"
                className="flex min-h-11 items-center gap-2.5 rounded-full py-1 pl-1 pr-2 hover:bg-page"
              >
                <span aria-hidden className="grid size-9 place-items-center rounded-full bg-accent text-sm font-semibold text-white">
                  {initial}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-[10rem] truncate text-sm font-medium text-ink">{name}</span>
                  <span className="block text-xs text-muted">{portal}</span>
                </span>
              </button>
              {menu ? (
                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-lg">
                  <p className="truncate px-3 py-2 text-xs text-muted">{email}</p>
                  <p className="px-3 pb-2 text-xs font-medium text-ink">{portal}</p>
                  <div className="border-t border-line pt-1">
                    <Link
                      href="/account"
                      onClick={() => setMenu(false)}
                      className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm text-ink hover:bg-page"
                    >
                      <NavIcon name="shield" className="size-4" />
                      เปลี่ยนรหัสผ่าน
                    </Link>
                    {signOut}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {open ? (
        <button
          type="button"
          aria-label="ปิดเมนู"
          onClick={() => setOpen(false)}
          className="no-print fixed inset-0 z-40 bg-brand-deep/50 lg:hidden"
        />
      ) : null}
      <aside
        id="drawer"
        aria-hidden={!open}
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-4 overflow-y-auto bg-brand-deep px-4 py-5 shadow-xl transition-transform lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full invisible"
        }`}
      >
        <div className="self-start rounded-xl bg-white px-3 py-2">
          <Image src="/brand/vta-logo.png" alt="VTA Service" width={720} height={217} className="h-8 w-auto" />
        </div>
        <p className="px-3 text-xs font-semibold text-white/70">{portal}</p>
        <NavLinks items={nav} onNavigate={() => setOpen(false)} />
      </aside>

      <main className="mx-auto w-full min-w-0 max-w-[1400px] overflow-x-clip px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}

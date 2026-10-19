"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon, type NavIconName } from "@/components/nav-icons";
import { cn } from "@/lib/cn";

export interface NavItem {
  href: string;
  label: string;
  icon?: NavIconName;
  /** แสดงเฉพาะผู้ที่มี role นี้ (ไม่ระบุ = ทุกคนในพอร์ทัล) */
  onlyRole?: string;
}

export function NavLinks({
  items,
  onNavigate,
  variant = "list",
}: {
  items: NavItem[];
  onNavigate?: () => void;
  /** list = เมนูแนวตั้ง (ลิ้นชัก), tabs = แท็บแคปซูลแนวนอน (แถบบน) */
  variant?: "list" | "tabs";
}) {
  const pathname = usePathname();
  // เมนูที่ href เป็น "หน้าแรกของพอร์ทัล" (เช่น /admin) ต้องตรงทั้งหมด ไม่งั้นจะติดสถานะ active ทุกหน้าย่อย
  const isRoot = (href: string) => items.some((o) => o.href !== href && o.href.startsWith(`${href}/`));

  return (
    <nav aria-label="เมนูหลัก">
      <ul className={variant === "tabs" ? "flex items-center gap-1" : "space-y-1"}>
        {items.map((item) => {
          const active = isRoot(item.href) ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm transition-colors",
                  variant === "tabs"
                    ? active
                      ? "border border-line bg-surface font-medium text-accent shadow-card"
                      : "border border-transparent text-muted hover:text-ink"
                    : active
                      ? "bg-ink font-semibold text-white"
                      : "text-ink hover:bg-page",
                )}
              >
                {variant === "list" ? <NavIcon name={item.icon ?? "doc"} /> : null}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

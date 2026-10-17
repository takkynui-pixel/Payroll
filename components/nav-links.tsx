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

export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  // เมนูที่ href เป็น "หน้าแรกของพอร์ทัล" (เช่น /admin) ต้องตรงทั้งหมด ไม่งั้นจะติดสถานะ active ทุกหน้าย่อย
  const isRoot = (href: string) => items.some((o) => o.href !== href && o.href.startsWith(`${href}/`));

  return (
    <nav aria-label="เมนูหลัก">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isRoot(item.href) ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-surface font-semibold text-brand shadow-card"
                    : "text-navy hover:bg-white/60",
                )}
              >
                <NavIcon name={item.icon ?? "doc"} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

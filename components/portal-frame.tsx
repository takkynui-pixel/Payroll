import { Suspense, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireRole, type AppRole } from "@/lib/auth";
import { AppShell, ShellFallback } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";

interface FrameProps {
  allowed: AppRole[];
  portal: string;
  nav: NavItem[];
  /** นับงวดที่รอดำเนินการเพื่อแสดงที่กระดิ่ง (เฉพาะพอร์ทัลที่ระบุ) */
  noticeHref?: string;
  children: ReactNode;
}

/** ตรวจสิทธิ์ฝั่ง server แล้วครอบด้วยเมนูของพอร์ทัล (ด่านจริงคือ RLS ในฐานข้อมูล) */
async function PortalGate({ allowed, portal, nav, noticeHref, children }: FrameProps) {
  const session = await requireRole(allowed);
  let notice: { count: number; href: string; label: string } | undefined;
  if (noticeHref) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("payroll_periods")
      .select("id", { count: "exact", head: true })
      .in("status", [session.isStaff ? "approved" : "client_reviewing"]);
    notice = { count: count ?? 0, href: noticeHref, label: `งวดที่รอดำเนินการ ${count ?? 0} รายการ` };
  }
  return (
    <AppShell
      email={session.email}
      notice={notice}
      portal={portal}
      nav={nav.filter((n) => !n.onlyRole || session.roles.some((r) => r === n.onlyRole))}
    >
      {children}
    </AppShell>
  );
}

/**
 * ใช้เป็น layout ของแต่ละพอร์ทัล
 * การอ่าน session อยู่ใน Suspense เพื่อให้เปิดใช้ Cache Components ได้ (ทุกหน้าข้างในจึงอยู่ใต้ boundary นี้)
 */
export function PortalFrame(props: FrameProps) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <PortalGate {...props} />
    </Suspense>
  );
}

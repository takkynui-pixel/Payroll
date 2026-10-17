import { Suspense, type ReactNode } from "react";
import { requireRole, type AppRole } from "@/lib/auth";
import { AppShell, ShellFallback } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";

interface FrameProps {
  allowed: AppRole[];
  portal: string;
  nav: NavItem[];
  children: ReactNode;
}

/** ตรวจสิทธิ์ฝั่ง server แล้วครอบด้วยเมนูของพอร์ทัล (ด่านจริงคือ RLS ในฐานข้อมูล) */
async function PortalGate({ allowed, portal, nav, children }: FrameProps) {
  const session = await requireRole(allowed);
  return (
    <AppShell
      email={session.email}
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

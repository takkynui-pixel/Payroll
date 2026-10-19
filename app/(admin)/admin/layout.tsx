import type { ReactNode } from "react";
import { PortalFrame } from "@/components/portal-frame";
import { STAFF_ROLES } from "@/lib/auth";
import { ADMIN_NAV } from "@/lib/nav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PortalFrame allowed={STAFF_ROLES} portal="ทีม Payroll" nav={ADMIN_NAV} noticeHref="/admin/payroll">
      {children}
    </PortalFrame>
  );
}

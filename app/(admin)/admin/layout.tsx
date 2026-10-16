import type { ReactNode } from "react";
import { PortalFrame } from "@/components/portal-frame";
import { STAFF_ROLES } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "ภาพรวม" },
  { href: "/admin/companies", label: "บริษัทลูกค้า" },
  { href: "/admin/employees", label: "พนักงาน" },
  { href: "/admin/payroll", label: "งวดเงินเดือน" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PortalFrame allowed={STAFF_ROLES} portal="ทีม Payroll" nav={NAV}>
      {children}
    </PortalFrame>
  );
}

import type { ReactNode } from "react";
import { PortalFrame } from "@/components/portal-frame";
import { STAFF_ROLES } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "ภาพรวม", icon: "home" as const },
  { href: "/admin/companies", label: "บริษัทลูกค้า", icon: "building" as const },
  { href: "/admin/employees", label: "พนักงาน", icon: "users" as const },
  { href: "/admin/payroll", label: "งวดเงินเดือน", icon: "payroll" as const },
  { href: "/admin/import", label: "นำเข้าข้อมูล", icon: "upload" as const },
  { href: "/admin/users", label: "ผู้ใช้และสิทธิ์", icon: "shield" as const, onlyRole: "super_admin" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PortalFrame allowed={STAFF_ROLES} portal="ทีม Payroll" nav={NAV} noticeHref="/admin/payroll">
      {children}
    </PortalFrame>
  );
}

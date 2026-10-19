import type { NavItem } from "@/components/nav-links";

/** เมนูของแต่ละพอร์ทัล (ใช้ร่วมกับหน้าบัญชีของฉันที่ทุกบทบาทเข้าได้) */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "ภาพรวม", icon: "home" },
  { href: "/admin/companies", label: "บริษัทลูกค้า", icon: "building" },
  { href: "/admin/employees", label: "พนักงาน", icon: "users" },
  { href: "/admin/payroll", label: "งวดเงินเดือน", icon: "payroll" },
  { href: "/admin/import", label: "นำเข้าข้อมูล", icon: "upload" },
  { href: "/admin/users", label: "ผู้ใช้และสิทธิ์", icon: "shield", onlyRole: "super_admin" },
];
export const CLIENT_NAV: NavItem[] = [{ href: "/client", label: "งวดเงินเดือน", icon: "payroll" }];
export const EMPLOYEE_NAV: NavItem[] = [{ href: "/payslips", label: "สลิปเงินเดือน", icon: "doc" }];

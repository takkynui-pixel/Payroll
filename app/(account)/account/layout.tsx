import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ShellFallback } from "@/components/app-shell";
import { PortalFrame } from "@/components/portal-frame";
import { getSession } from "@/lib/auth";
import { ADMIN_NAV, CLIENT_NAV, EMPLOYEE_NAV } from "@/lib/nav";

/** หน้าบัญชีของฉัน: ผู้ใช้ทุกบทบาทเข้าได้ แสดงเมนูตามบทบาทหลักของตน */
async function AccountGate({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.roles.length === 0) redirect("/no-access");
  const [portal, nav] = session.isStaff
    ? (["ทีม Payroll", ADMIN_NAV] as const)
    : session.roles.includes("client_hr")
      ? (["พอร์ทัลลูกค้า", CLIENT_NAV] as const)
      : (["สลิปเงินเดือน", EMPLOYEE_NAV] as const);
  return (
    <PortalFrame allowed={["super_admin", "payroll_admin", "client_hr", "employee"]} portal={portal} nav={[...nav]}>
      {children}
    </PortalFrame>
  );
}

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AccountGate>{children}</AccountGate>
    </Suspense>
  );
}

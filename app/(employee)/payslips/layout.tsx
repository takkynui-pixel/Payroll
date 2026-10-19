import type { ReactNode } from "react";
import { PortalFrame } from "@/components/portal-frame";
import { EMPLOYEE_NAV } from "@/lib/nav";

export default function PayslipsLayout({ children }: { children: ReactNode }) {
  return (
    <PortalFrame allowed={["employee"]} portal="สลิปเงินเดือน" nav={EMPLOYEE_NAV}>
      {children}
    </PortalFrame>
  );
}

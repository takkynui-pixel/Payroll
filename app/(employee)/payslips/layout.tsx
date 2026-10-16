import type { ReactNode } from "react";
import { PortalFrame } from "@/components/portal-frame";

const NAV = [{ href: "/payslips", label: "สลิปเงินเดือน" }];

export default function PayslipsLayout({ children }: { children: ReactNode }) {
  return (
    <PortalFrame allowed={["employee"]} portal="สลิปเงินเดือน" nav={NAV}>
      {children}
    </PortalFrame>
  );
}

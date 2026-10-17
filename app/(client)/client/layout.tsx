import type { ReactNode } from "react";
import { PortalFrame } from "@/components/portal-frame";

const NAV = [{ href: "/client", label: "งวดเงินเดือน", icon: "payroll" as const }];

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <PortalFrame allowed={["client_hr"]} portal="พอร์ทัลลูกค้า" nav={NAV}>
      {children}
    </PortalFrame>
  );
}

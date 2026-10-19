import type { ReactNode } from "react";
import { PortalFrame } from "@/components/portal-frame";
import { CLIENT_NAV } from "@/lib/nav";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <PortalFrame allowed={["client_hr"]} portal="พอร์ทัลลูกค้า" nav={CLIENT_NAV} noticeHref="/client">
      {children}
    </PortalFrame>
  );
}

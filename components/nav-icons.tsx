import type { ReactNode } from "react";

export type NavIconName = "home" | "building" | "users" | "payroll" | "upload" | "shield" | "doc";

const PATHS: Record<NavIconName, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M10 20v-5h4v5" />,
  building: <path d="M4 21V5.5L12 3l8 2.5V21M9 8h1.5M13.5 8H15M9 12h1.5M13.5 12H15M9 16h1.5M13.5 16H15M2.5 21h19" />,
  users: <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1.5a4 4 0 0 0-3-3.9M15.5 4.2a3.5 3.5 0 0 1 0 6.6" />,
  payroll: <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9ZM3 10h18M7 15h3" />,
  upload: <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />,
  shield: <path d="M12 3 4.5 6v5.5c0 4.5 3.1 7.9 7.5 9.5 4.4-1.6 7.5-5 7.5-9.5V6L12 3ZM9 12l2.2 2.2L15.5 10" />,
  doc: <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v4h4M9 12h6M9 16h6" />,
};

/** ไอคอนเส้น 20px สำหรับเมนู (ตกแต่งอย่างเดียว ซ่อนจากโปรแกรมอ่านหน้าจอ) */
export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

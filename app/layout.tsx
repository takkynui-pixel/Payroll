import type { Metadata } from "next";
// ฟอนต์ Prompt ฝังมากับแพ็กเกจ (ไม่ดึงจาก Google ตอนผู้ใช้เปิดหน้าเว็บ)
import "@fontsource/prompt/400.css";
import "@fontsource/prompt/500.css";
import "@fontsource/prompt/600.css";
import "@fontsource/prompt/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "VTA Payroll", template: "%s | VTA Payroll" },
  description: "ระบบบริหารเงินเดือนและ Outsourcing ของ VTA Service",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

import Image from "next/image";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return (
    <main className="sidebar-surface flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 rounded-2xl bg-surface px-6 py-5 shadow-card">
          <Image src="/brand/vta-logo.png" alt="VTA Service" width={720} height={217} priority className="mx-auto h-auto w-56" />
        </div>
        <div className="rounded-2xl border border-line/60 bg-surface p-6 shadow-card">
          <h1 className="text-xl font-semibold tracking-tight text-navy">เข้าสู่ระบบ Payroll</h1>
          <p className="mb-5 mt-1 text-sm text-muted">สำหรับทีม Payroll, HR ของบริษัทลูกค้า และพนักงานที่ได้รับสิทธิ์</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

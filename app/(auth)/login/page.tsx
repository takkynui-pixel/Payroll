import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <div className="mb-6">
        <p className="text-sm font-medium text-brand">VTA Service</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy">เข้าสู่ระบบ Payroll</h1>
        <p className="mt-1 text-sm text-muted">สำหรับทีม Payroll, HR ของบริษัทลูกค้า และพนักงานที่ได้รับสิทธิ์</p>
      </div>
      <div className="rounded-md border border-line bg-surface p-5">
        <LoginForm />
      </div>
    </main>
  );
}

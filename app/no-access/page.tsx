import type { Metadata } from "next";
import { signOutAction } from "@/app/actions/auth";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "ยังไม่มีสิทธิ์ใช้งาน" };

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-xl font-semibold text-ink">บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน</h1>
      <p className="mt-2 text-sm text-muted">
        ล็อกอินสำเร็จ แต่ยังไม่ได้กำหนดบทบาทให้บัญชีนี้ กรุณาติดต่อผู้ดูแลระบบของ VTA Service เพื่อให้เพิ่มสิทธิ์ แล้วเข้าสู่ระบบใหม่
      </p>
      <form action={signOutAction} className="mt-6">
        <button type="submit" className={buttonClass({ variant: "secondary" })}>
          ออกจากระบบ
        </button>
      </form>
    </main>
  );
}

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, homePathFor } from "@/lib/auth";

/** อ่าน session ต้องอยู่ใน Suspense (Cache Components) แล้วพาไปหน้าแรกตามบทบาท */
async function RoleRedirect(): Promise<never> {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(homePathFor(session.roles));
}

export default function Home() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">กำลังเปิดระบบ…</p>}>
      <RoleRedirect />
    </Suspense>
  );
}

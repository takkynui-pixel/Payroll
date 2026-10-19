import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "บัญชีของฉัน" };

export default async function AccountPage() {
  const session = await getSession();
  return (
    <>
      <PageHeader title="บัญชีของฉัน" description={session?.email ?? undefined} />
      <div className="max-w-md">
        <Card title="เปลี่ยนรหัสผ่าน">
          <PasswordForm />
        </Card>
      </div>
    </>
  );
}

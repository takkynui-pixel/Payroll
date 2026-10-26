import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/server";
import { BankForm } from "./bank-form";
import { FilingForm } from "./filing-form";

export const metadata: Metadata = { title: "ข้อมูลบริษัท" };

export default async function CompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
  const id = z.uuid().safeParse((await params).companyId);
  if (!id.success) notFound();

  const supabase = await createClient();
  const { data: company, error } = await supabase.from("companies").select("*").eq("id", id.data).is("deleted_at", null).maybeSingle();
  if (error) return <FormError message={error.message} />;
  if (!company) notFound();

  return (
    <>
      <PageHeader
        title={company.name}
        description="ข้อมูลนี้ใช้กรอกหัวแบบ ภ.ง.ด.1 / 1ก / กท.20 ก และไฟล์นำส่งธนาคาร"
        action={
          <Link href="/admin/companies" className={buttonClass({ variant: "secondary" })}>
            กลับไปรายชื่อ
          </Link>
        }
      />
      <div className="max-w-3xl space-y-6">
        <FilingForm company={company} />
        <BankForm company={company} />
      </div>
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/server";
import { PeriodForm } from "./period-form";

export const metadata: Metadata = { title: "สร้างงวดเงินเดือน" };

export default async function NewPeriodPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id,name")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name");
  const companies = data ?? [];

  return (
    <>
      <PageHeader title="สร้างงวดเงินเดือน" description="งวดใหม่เริ่มที่สถานะ “ร่าง” จากนั้นนำเข้าข้อมูลเวลาทำงานแล้วกดคำนวณ" />
      <FormError message={error?.message} />
      {companies.length === 0 ? (
        <EmptyState
          title="ยังไม่มีบริษัทลูกค้า"
          action={
            <Link href="/admin/companies" className={buttonClass()}>
              ไปเพิ่มบริษัท
            </Link>
          }
        >
          ต้องมีบริษัทก่อนจึงจะสร้างงวดเงินเดือนได้
        </EmptyState>
      ) : (
        <PeriodForm companies={companies} />
      )}
    </>
  );
}

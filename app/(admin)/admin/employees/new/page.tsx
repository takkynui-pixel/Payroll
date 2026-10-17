import Link from "next/link";
import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/server";
import { AddEmployeeForm } from "../employee-forms";

export const metadata: Metadata = { title: "เพิ่มพนักงาน" };

export default async function NewEmployeePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const defaultCompany = z.uuid().safeParse((await searchParams).company).data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id,name")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name");

  return (
    <>
      <PageHeader
        title="เพิ่มพนักงาน"
        description="เพิ่มทีละคน ถ้ามีหลายคนให้ใช้นำเข้าจาก Excel"
        action={
          <div className="flex gap-2">
            <Link href="/admin/import" className={buttonClass({ variant: "secondary" })}>
              นำเข้าจาก Excel
            </Link>
            <Link href="/admin/employees" className={buttonClass({ variant: "secondary" })}>
              กลับ
            </Link>
          </div>
        }
      />
      <FormError message={error?.message} />
      <AddEmployeeForm companies={data ?? []} defaultCompany={defaultCompany} />
    </>
  );
}

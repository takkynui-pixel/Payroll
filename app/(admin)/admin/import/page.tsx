import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { FormError } from "@/components/ui/field";
import { formatDateRangeTh } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "นำเข้าข้อมูล" };

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const periodParam = z.uuid().safeParse(sp.period).data;

  const supabase = await createClient();
  const [companies, periods] = await Promise.all([
    supabase.from("companies").select("id,name").is("deleted_at", null).eq("is_active", true).order("name"),
    supabase
      .from("payroll_periods")
      .select("id,company_id,period_name,start_date,end_date,status")
      .in("status", ["draft", "calculated"])
      .order("start_date", { ascending: false })
      .limit(100),
  ]);

  const nameOf = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const companyOptions = (companies.data ?? []).map((c) => ({ id: c.id, label: c.name }));
  const periodOptions = (periods.data ?? []).map((p) => ({
    id: p.id,
    label: `${nameOf.get(p.company_id) ?? "-"} · ${p.period_name} (${formatDateRangeTh(p.start_date, p.end_date)})`,
  }));

  return (
    <>
      <PageHeader
        title="นำเข้าข้อมูลจาก Excel"
        description="ดาวน์โหลดแม่แบบ กรอกข้อมูล แล้วอัปโหลดเพื่อตรวจก่อนบันทึก ถ้ามีแถวผิด ระบบจะไม่บันทึกเลยแม้แต่แถวเดียว"
      />
      <FormError message={companies.error?.message ?? periods.error?.message} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ImportForm
          kind="timesheets"
          title="เวลาทำงานและรายการเพิ่ม-หักของงวด"
          description="วันทำงาน OT สาย ขาด และค่ากะ/ค่าอาหาร/เบี้ยขยัน ฯลฯ นำเข้าได้เฉพาะงวดที่ยังเป็นร่างหรือคำนวณแล้ว"
          targetLabel="งวดเงินเดือน"
          options={periodOptions}
          defaultTarget={periodParam}
          templateHref="/admin/import/template/timesheets"
        />
        <ImportForm
          kind="employees"
          title="พนักงานใหม่พร้อมโครงสร้างเงินเดือน"
          description="เพิ่มพนักงานใหม่หลายคนพร้อมกัน (รหัสที่มีอยู่แล้วจะถูกปฏิเสธ) เลขบัตรประชาชนเก็บแบบเข้ารหัส"
          targetLabel="บริษัท"
          options={companyOptions}
          templateHref="/admin/import/template/employees"
        />
      </div>
    </>
  );
}

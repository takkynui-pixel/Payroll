import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { FormError } from "@/components/ui/field";
import { PrintToolbar } from "@/components/tax/print-toolbar";
import { Warnings } from "@/components/tax/rd-forms";
import { WcfForm } from "@/components/tax/wcf-form";
import { createClient } from "@/lib/supabase/server";
import { loadFilingData } from "@/lib/tax/load";
import { buildAnnual } from "@/lib/tax/pnd";
import { buildWcf } from "@/lib/tax/wcf";

export const metadata: Metadata = { title: "กท.20 ก" };

const schema = z.object({ company: z.uuid(), year: z.coerce.number().int().min(2020).max(2100) });

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const parsed = schema.safeParse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  if (!parsed.success) {
    return (
      <>
        <FormError message="ข้อมูลที่เลือกไม่ครบ กลับไปเลือกบริษัทและปีอีกครั้ง" />
        <Link href="/admin/tax" className="text-brand underline">
          กลับไปหน้าเลือก
        </Link>
      </>
    );
  }
  const { company: companyId, year } = parsed.data;
  const supabase = await createClient();
  const data = await loadFilingData(supabase, companyId, year);
  if ("error" in data) return <FormError message={data.error} />;

  const report = buildWcf(data.rows, year, data.payTypes);
  const annual = buildAnnual(data.rows, year);

  const warnings: string[] = [];
  if (!data.company.wcf_account_no) warnings.push("ยังไม่ได้กรอกเลขที่บัญชีนายจ้าง (กองทุนเงินทดแทน) กรอกได้ที่เมนู บริษัทลูกค้า > ชื่อบริษัท");
  if (!data.company.tax_id) warnings.push("ยังไม่ได้กรอกเลขประจำตัวผู้เสียภาษี");
  if (!data.company.wcf_business_code || Number(data.company.wcf_rate) <= 0) warnings.push("ยังไม่ได้กรอกรหัสกิจการหรืออัตราเงินสมทบ ช่องนั้นจะว่างให้เขียนเอง");
  if (!data.company.signer_name) warnings.push("ยังไม่ได้ระบุชื่อและตำแหน่งผู้ลงนาม");
  if (data.pendingPeriods > 0) warnings.push(`ปี ${year + 543} ยังมี ${data.pendingPeriods} งวดที่ยังไม่อนุมัติ จึงยังไม่ถูกนับในรายงานนี้`);
  if (report.total.totalSatang === 0) warnings.push("ไม่พบรายการจ่ายค่าจ้างในปีที่เลือก (นับเฉพาะงวดที่อนุมัติหรือปิดงวดแล้ว)");

  return (
    <>
      <PrintToolbar backHref="/admin/tax" title="กท.20 ก" />
      <Warnings items={warnings} />
      <div className="overflow-x-auto pb-4 print:overflow-visible">
        <WcfForm company={data.company} year={year} report={report} taxPayeeCount={annual.payeeCount} taxIncomeSatang={annual.incomeSatang} />
      </div>
    </>
  );
}

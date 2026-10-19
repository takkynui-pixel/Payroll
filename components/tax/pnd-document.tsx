import Link from "next/link";
import { z } from "zod";
import { FormError } from "@/components/ui/field";
import { PrintToolbar } from "@/components/tax/print-toolbar";
import { AttachSheet, CoverPnd1, CoverPnd1k, Warnings, type AttachLine } from "@/components/tax/rd-forms";
import { loadFilingData, loadIdCards, missingCompanyFields } from "@/lib/tax/load";
import { buildAnnual, buildMonthly, paginate } from "@/lib/tax/pnd";
import { createClient } from "@/lib/supabase/server";

const ROWS_PER_PAGE = 6;

const schema = z.object({
  company: z.uuid(),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12).optional(),
  all: z.string().optional(),
  add: z.coerce.number().int().min(1).max(99).optional(),
});

/** หน้าตัวอย่างก่อนพิมพ์ของ ภ.ง.ด.1 (รายเดือน) และ ภ.ง.ด.1ก (รายปี) */
export async function PndDocument({ kind, params }: { kind: "pnd1" | "pnd1k"; params: Record<string, string | string[] | undefined> }) {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = schema.safeParse(flat);
  const back = "/admin/tax";
  if (!parsed.success || (kind === "pnd1" && !parsed.data.month)) {
    return (
      <>
        <FormError message="ข้อมูลที่เลือกไม่ครบ กลับไปเลือกบริษัท ปี และเดือนอีกครั้ง" />
        <Link href={back} className="text-brand underline">
          กลับไปหน้าเลือก
        </Link>
      </>
    );
  }
  const { company: companyId, year, month, all, add } = parsed.data;

  const supabase = await createClient();
  const data = await loadFilingData(supabase, companyId, year);
  if ("error" in data) return <FormError message={data.error} />;

  const report =
    kind === "pnd1"
      ? buildMonthly(data.rows, year, month!, all === "1")
      : buildAnnual(data.rows, year);

  const idCards = await loadIdCards(supabase, report.lines.map((l) => l.employeeId));
  const lines: AttachLine[] = report.lines.map((l) => ({
    ...l,
    idCard: idCards.get(l.employeeId) ?? null,
    address: data.addresses.get(l.employeeId) ?? null,
  }));

  const pages = paginate(lines, ROWS_PER_PAGE);
  const warnings: string[] = [];
  const missing = missingCompanyFields(data.company);
  if (missing.length) warnings.push(`ข้อมูลบริษัทยังไม่ครบ: ${missing.join(", ")} (กรอกได้ที่เมนู บริษัทลูกค้า > ชื่อบริษัท)`);
  if (!data.company.signer_name) warnings.push("ยังไม่ได้ระบุชื่อและตำแหน่งผู้ลงนาม (ช่องลายเซ็นจะว่างให้เซ็นเอง)");
  const noId = lines.filter((l) => !l.idCard).length;
  if (noId) warnings.push(`พนักงาน ${noId} รายยังไม่มีเลขบัตรประชาชนในระบบ ช่องเลขประจำตัวผู้เสียภาษีจะว่าง`);
  if (kind === "pnd1k") {
    const noAddr = lines.filter((l) => !l.address).length;
    if (noAddr) warnings.push(`พนักงาน ${noAddr} รายยังไม่มีที่อยู่ (ใบแนบ ภ.ง.ด.1ก ต้องระบุที่อยู่ผู้มีเงินได้ กรอกได้ที่หน้าข้อมูลพนักงาน)`);
  }
  if (data.pendingPeriods > 0) warnings.push(`ปี ${year + 543} ยังมี ${data.pendingPeriods} งวดที่ยังไม่อนุมัติ จึงยังไม่ถูกนับในรายงานนี้`);
  if (report.lines.length === 0) warnings.push("ไม่พบรายการจ่ายเงินได้ในช่วงที่เลือก (นับเฉพาะงวดที่อนุมัติหรือปิดงวดแล้ว)");

  const title = kind === "pnd1" ? "ภ.ง.ด.1 (รายเดือน)" : "ภ.ง.ด.1ก (รายปี)";
  const sums = pages.map((p) => ({
    income: p.reduce((s, l) => s + l.incomeSatang, 0),
    tax: p.reduce((s, l) => s + l.taxSatang, 0),
  }));

  return (
    <>
      <PrintToolbar backHref={back} title={title} />
      <Warnings items={warnings} />
      <div className="overflow-x-auto pb-4 print:overflow-visible">
        {kind === "pnd1" ? (
          <CoverPnd1 company={data.company} year={year} month={month!} report={report} attachPages={pages.length} additionalNo={add} />
        ) : (
          <CoverPnd1k company={data.company} year={year} report={report} attachPages={pages.length} additionalNo={add} />
        )}
        {pages.map((pageLines, i) => (
          <AttachSheet
            key={i}
            kind={kind}
            company={data.company}
            lines={pageLines}
            pageNo={i + 1}
            pageCount={pages.length}
            rowsPerPage={ROWS_PER_PAGE}
            startIndex={i * ROWS_PER_PAGE}
            pageTotal={sums[i]}
            grandTotal={i === pages.length - 1 ? { income: report.incomeSatang, tax: report.taxSatang } : undefined}
          />
        ))}
      </div>
    </>
  );
}

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { loadFilingData, loadIdCards, missingCompanyFields, type CompanyRow } from "@/lib/tax/load";
import { ATTACH_LAYOUTS } from "@/lib/tax/pdf/attach-layout";
import { buildAnnual, buildMonthly, paginate, type PayeeLine, type PndReport } from "@/lib/tax/pnd";

/** จำนวนรายต่อใบแนบตามแบบทางการ: ภ.ง.ด.1 = 8, ภ.ง.ด.1ก = 7 */
export const rowsPerPageOf = (kind: "pnd1" | "pnd1k") => ATTACH_LAYOUTS[kind].rows.length;

const schema = z.object({
  company: z.uuid(),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12).optional(),
  all: z.string().optional(),
  add: z.coerce.number().int().min(1).max(99).optional(),
});

export interface PndLine extends PayeeLine {
  idCard: string | null;
  address: string | null;
}

export interface PndPrepared {
  company: CompanyRow;
  year: number;
  month?: number;
  additionalNo?: number;
  report: PndReport;
  lines: PndLine[];
  pages: PndLine[][];
  warnings: string[];
}

/** เตรียมข้อมูล ภ.ง.ด.1 / 1ก ที่ใช้ร่วมกันทั้งหน้าตัวอย่างและไฟล์ PDF */
export async function preparePnd(
  supabase: SupabaseClient<Database>,
  kind: "pnd1" | "pnd1k",
  params: Record<string, string | string[] | undefined>,
): Promise<PndPrepared | { error: string }> {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = schema.safeParse(flat);
  if (!parsed.success || (kind === "pnd1" && !parsed.data.month)) {
    return { error: "ข้อมูลที่เลือกไม่ครบ กลับไปเลือกบริษัท ปี และเดือนอีกครั้ง" };
  }
  const { company: companyId, year, month, all, add } = parsed.data;

  const data = await loadFilingData(supabase, companyId, year);
  if ("error" in data) return { error: data.error };

  const report = kind === "pnd1" ? buildMonthly(data.rows, year, month!, all === "1") : buildAnnual(data.rows, year);
  const idCards = await loadIdCards(supabase, report.lines.map((l) => l.employeeId));
  const lines: PndLine[] = report.lines.map((l) => ({
    ...l,
    idCard: idCards.get(l.employeeId) ?? null,
    address: data.addresses.get(l.employeeId) ?? null,
  }));

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

  return { company: data.company, year, month, additionalNo: add, report, lines, pages: paginate(lines, rowsPerPageOf(kind)), warnings };
}

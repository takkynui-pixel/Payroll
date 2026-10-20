import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { toSatang, type PaidRow } from "./pnd";

export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

export interface FilingData {
  company: CompanyRow;
  rows: PaidRow[];
  addresses: Map<string, string | null>;
  /** ประเภทการจ่ายล่าสุดของพนักงาน (monthly/daily/hourly) */
  payTypes: Map<string, string>;
  /** งวดในปีที่เลือกซึ่งยังไม่อนุมัติ (ไม่ถูกนับในรายงาน) */
  pendingPeriods: number;
}

function taxableOf(snapshot: unknown): number | null {
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    const v = (snapshot as Record<string, unknown>).taxableIncome;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

const COUNTED = ["approved", "closed"];

/** อ่านผลคำนวณของงวดที่อนุมัติ/ปิดแล้วในปีที่เลือก (ผ่าน RLS ของผู้ใช้) */
export async function loadFilingData(
  supabase: SupabaseClient<Database>,
  companyId: string,
  year: number,
): Promise<FilingData | { error: string }> {
  const { data: company, error: ce } = await supabase.from("companies").select("*").eq("id", companyId).is("deleted_at", null).maybeSingle();
  if (ce) return { error: ce.message };
  if (!company) return { error: "ไม่พบบริษัท" };

  const { data: periods, error: pe } = await supabase
    .from("payroll_periods")
    .select("id,pay_date,status")
    .eq("company_id", companyId)
    .gte("pay_date", `${year}-01-01`)
    .lte("pay_date", `${year}-12-31`);
  if (pe) return { error: pe.message };

  const counted = (periods ?? []).filter((p) => COUNTED.includes(p.status));
  const payDate = new Map(counted.map((p) => [p.id, p.pay_date]));
  const rows: PaidRow[] = [];

  // ดึงทีละกลุ่มงวด เพื่อไม่ชนเพดานจำนวนแถวต่อคำขอของ API
  const ids = counted.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 4) {
    const { data, error } = await supabase
      .from("payroll_results")
      .select("payroll_period_id,employee_id,employee_name,total_earnings,tax_amount,gross_salary,input_snapshot")
      .in("payroll_period_id", ids.slice(i, i + 4))
      .limit(5000);
    if (error) return { error: error.message };
    for (const r of data ?? []) {
      rows.push({
        employeeId: r.employee_id,
        employeeName: r.employee_name,
        payDate: payDate.get(r.payroll_period_id) ?? "",
        // ภ.ง.ด.1/1ก ใช้เงินได้ที่เสียภาษี (ไม่รวมรายได้ที่ยกเว้น เช่น ค่ากะ/ค่ากิน) ถ้าไม่มี snapshot ใช้รายได้รวม
        incomeSatang: toSatang(taxableOf(r.input_snapshot) ?? r.total_earnings),
        wageSatang: toSatang(r.total_earnings),
        taxSatang: toSatang(r.tax_amount),
        grossSatang: toSatang(r.gross_salary),
      });
    }
  }

  const empIds = [...new Set(rows.map((r) => r.employeeId))];
  const addresses = new Map<string, string | null>();
  for (let i = 0; i < empIds.length; i += 100) {
    const { data, error } = await supabase.from("employees").select("id,address").in("id", empIds.slice(i, i + 100));
    if (error) return { error: error.message };
    for (const e of data ?? []) addresses.set(e.id, e.address);
  }

  const payTypes = new Map<string, string>();
  for (let i = 0; i < empIds.length; i += 100) {
    const { data, error } = await supabase
      .from("employee_salaries")
      .select("employee_id,pay_type,effective_date")
      .in("employee_id", empIds.slice(i, i + 100))
      .order("effective_date", { ascending: true })
      .limit(5000);
    if (error) return { error: error.message };
    // เรียงเก่า->ใหม่ แถวหลังสุดทับ = ประเภทการจ่ายล่าสุด
    for (const e of data ?? []) payTypes.set(e.employee_id, e.pay_type);
  }

  return { company, rows, addresses, payTypes, pendingPeriods: (periods ?? []).length - counted.length };
}

/** ถอดรหัสเลขบัตรประชาชนของพนักงานที่อยู่ในรายงาน (ทุกครั้งถูกบันทึกใน audit log โดยฐานข้อมูล) */
export async function loadIdCards(supabase: SupabaseClient<Database>, employeeIds: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const unique = [...new Set(employeeIds)];
  for (let i = 0; i < unique.length; i += 10) {
    const part = unique.slice(i, i + 10);
    const res = await Promise.all(part.map((id) => supabase.rpc("get_employee_id_card", { p_employee: id })));
    part.forEach((id, k) => out.set(id, res[k].error ? null : (res[k].data ?? null)));
  }
  return out;
}

export function companyAddressLines(c: CompanyRow) {
  return {
    building: c.addr_building ?? "",
    moo: c.addr_moo ?? "",
    soi: c.addr_soi ?? "",
    road: c.addr_road ?? "",
    subdistrict: c.addr_subdistrict ?? "",
    district: c.addr_district ?? "",
    province: c.addr_province ?? "",
    postcode: c.addr_postcode ?? "",
    phone: c.phone ?? "",
  };
}

/** ข้อมูลบริษัทที่แบบฟอร์มต้องใช้แต่ยังไม่ได้กรอก */
export function missingCompanyFields(c: CompanyRow): string[] {
  const out: string[] = [];
  if (!c.tax_id) out.push("เลขประจำตัวผู้เสียภาษี");
  if (!c.branch_no) out.push("รหัสสาขา");
  if (!c.addr_province || !c.addr_district || !c.addr_subdistrict) out.push("ที่อยู่ (ตำบล/อำเภอ/จังหวัด)");
  if (!c.addr_postcode) out.push("รหัสไปรษณีย์");
  return out;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseIsoDate, resolvePeriodContext, resolveRates } from "@payroll";
import type { Database, Json } from "@/types/database";
import { fetchAll } from "@/lib/supabase/fetch-all";
import {
  assemblePayrollInputs,
  buildSavePayload,
  runEngine,
  sumTotals,
  type CalcSummary,
  type RawPeriodData,
} from "./mapping";

type Client = SupabaseClient<Database>;

function fatal(message: string, notes: string[] = []): CalcSummary {
  return { ok: false, saved: 0, statusMoved: false, totals: null, issues: [], warnings: [], notes, fatal: message };
}

/**
 * คำนวณเงินเดือนทั้งงวดแล้วบันทึกผล ใช้สิทธิ์ของผู้ใช้ที่ล็อกอินผ่าน RLS
 * (ผู้ใช้ที่ไม่ใช่ทีม payroll จะอ่านข้อมูลไม่ได้/บันทึกไม่ได้เอง)
 *
 * ลำดับ: โหลดข้อมูล -> ประกอบ input -> engine -> ถ้ามีพนักงานคำนวณไม่ได้ "ไม่บันทึกอะไรเลย"
 *        -> save_payroll_results (atomic) -> ถ้างวดเป็น draft เปลี่ยนเป็น calculated
 */
export async function calculatePayrollPeriod(supabase: Client, periodId: string): Promise<CalcSummary> {
  const notes: string[] = [];

  try {
    const { data: period, error: periodErr } = await supabase
      .from("payroll_periods")
      .select("*")
      .eq("id", periodId)
      .maybeSingle();
    if (periodErr) return fatal(periodErr.message);
    if (!period) return fatal("ไม่พบงวดเงินเดือน หรือไม่มีสิทธิ์เข้าถึง");
    if (period.status !== "draft" && period.status !== "calculated") {
      return fatal(`งวดนี้ถูกล็อกแล้ว (สถานะ ${period.status}) คำนวณใหม่ไม่ได้`);
    }

    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("pay_cycle_type")
      .eq("id", period.company_id)
      .maybeSingle();
    if (companyErr || !company) return fatal(companyErr?.message ?? "ไม่พบบริษัท");

    // ปีภาษีและงวดที่เท่าไรของปี ยึดวันจ่ายเงิน (เงินได้พึงประเมินเมื่อได้รับ) ส่วนอัตราต่าง ๆ ยึดวันสิ้นสุดงวด
    const taxYear = parseIsoDate(period.pay_date).y;
    const periodCtx = resolvePeriodContext(company.pay_cycle_type, period.pay_date);

    const [rateRows, bracketRows] = await Promise.all([
      fetchAll((f, t) => supabase.from("statutory_rates").select("*").range(f, t)),
      fetchAll((f, t) => supabase.from("tax_brackets").select("*").range(f, t)),
    ]);
    const rates = resolveRates(rateRows, bracketRows, period.end_date);

    const cid = period.company_id;
    const [employees, salaries, timesheets, adjustments, deductions] = await Promise.all([
      fetchAll((f, t) =>
        supabase
          .from("employees")
          .select("*")
          .eq("company_id", cid)
          .is("deleted_at", null)
          .in("employment_status", ["active", "resigned"])
          .lte("hire_date", period.end_date)
          .or(`termination_date.is.null,termination_date.gte.${period.start_date}`)
          .order("employee_code")
          .range(f, t),
      ),
      fetchAll((f, t) =>
        supabase
          .from("employee_salaries")
          .select("*")
          .eq("company_id", cid)
          .lte("effective_date", period.end_date)
          .or(`end_date.is.null,end_date.gte.${period.end_date}`)
          .range(f, t),
      ),
      fetchAll((f, t) => supabase.from("employee_timesheets").select("*").eq("payroll_period_id", periodId).range(f, t)),
      fetchAll((f, t) => supabase.from("payroll_adjustments").select("*").eq("payroll_period_id", periodId).range(f, t)),
      fetchAll((f, t) =>
        supabase
          .from("employee_deductions")
          .select("*")
          .eq("company_id", cid)
          .eq("is_active", true)
          .lte("start_date", period.end_date)
          .or(`end_date.is.null,end_date.gte.${period.start_date}`)
          .range(f, t),
      ),
    ]);

    // ตาราง employee_tax_profiles มาจาก migration 003: ถ้ายังไม่ได้ apply ให้คำนวณต่อโดยไม่มีข้อมูลนี้ พร้อมแจ้ง
    let taxProfiles: RawPeriodData["taxProfiles"] = [];
    try {
      taxProfiles = await fetchAll((f, t) =>
        supabase.from("employee_tax_profiles").select("*").eq("company_id", cid).eq("tax_year", taxYear).range(f, t),
      );
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "PGRST205" || code === "42P01") {
        notes.push("ยังไม่มีตาราง employee_tax_profiles (ยังไม่ได้ apply migration 003) จึงไม่มีค่าลดหย่อนอื่นและยอดยกมา");
      } else {
        throw err;
      }
    }

    // ยอดสะสมจากงวดก่อนหน้าในปีเดียวกัน นับเฉพาะงวดที่อนุมัติ/ปิดแล้ว
    const prior = await fetchAll((f, t) =>
      supabase
        .from("payroll_periods")
        .select("id,period_name,status")
        .eq("company_id", cid)
        .gte("pay_date", `${taxYear}-01-01`)
        .lt("pay_date", period.pay_date)
        .neq("id", periodId)
        .range(f, t),
    );
    const finalIds = prior.filter((p) => p.status === "approved" || p.status === "closed").map((p) => p.id);
    const notFinal = prior.filter((p) => p.status !== "approved" && p.status !== "closed");
    if (notFinal.length > 0) {
      notes.push(
        `มีงวดก่อนหน้าในปีเดียวกันที่ยังไม่อนุมัติ/ปิดงวด (${notFinal.map((p) => p.period_name).join(", ")}) ยอดสะสมภาษีจึงยังไม่รวมงวดเหล่านี้`,
      );
    }
    const priorResults =
      finalIds.length === 0
        ? []
        : await fetchAll((f, t) =>
            supabase
              .from("payroll_results")
              .select("employee_id,social_security_amount,tax_amount,input_snapshot")
              .in("payroll_period_id", finalIds)
              .range(f, t),
          );

    const raw: RawPeriodData = { employees, salaries, timesheets, adjustments, deductions, taxProfiles, priorResults };
    const assembled = assemblePayrollInputs(raw, {
      rates,
      period: periodCtx,
      dates: { start: period.start_date, end: period.end_date },
    });
    notes.push(...assembled.notes);

    if (employees.length === 0) {
      return fatal("ไม่มีพนักงานที่ต้องคำนวณในงวดนี้", notes);
    }

    const { outputs, issues: engineIssues } = runEngine(assembled.inputs);
    const issues = [...assembled.issues, ...engineIssues];
    const warnings = outputs.flatMap((o) => o.warnings.map((message) => ({ employeeCode: o.employeeCode, message })));

    // มีรายใดคำนวณไม่ได้ -> ไม่บันทึกทั้งงวด เพื่อไม่ให้ลูกจ้างบางคนหายไปเงียบ ๆ
    if (issues.length > 0) {
      return { ok: false, saved: 0, statusMoved: false, totals: null, issues, warnings, notes };
    }

    const { error: saveErr } = await supabase.rpc("save_payroll_results", {
      p_period: periodId,
      p_results: buildSavePayload(outputs) as unknown as Json,
    });
    if (saveErr) {
      if (saveErr.code === "PGRST202") {
        return fatal("ยังไม่มีฟังก์ชัน save_payroll_results ในฐานข้อมูล (ต้อง apply migration 003 ก่อน)", notes);
      }
      return fatal(`บันทึกผลไม่สำเร็จ: ${saveErr.message}`, notes);
    }

    let statusMoved = false;
    if (period.status === "draft") {
      const { error: statusErr } = await supabase.rpc("change_payroll_period_status", {
        p_period: periodId,
        p_new_status: "calculated",
      });
      if (statusErr) {
        notes.push(`บันทึกผลแล้ว แต่เปลี่ยนสถานะเป็น calculated ไม่สำเร็จ: ${statusErr.message}`);
      } else {
        statusMoved = true;
      }
    }

    return { ok: true, saved: outputs.length, statusMoved, totals: sumTotals(outputs), issues: [], warnings, notes };
  } catch (err) {
    return fatal(err instanceof Error ? err.message : String(err), notes);
  }
}

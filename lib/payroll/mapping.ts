import {
  calculatePayroll,
  fromSatang,
  toSatang,
  type PayType,
  type PayrollInput,
  type PayrollOutput,
  type PayrollRates,
  type PeriodContext,
  type TaxDeductType,
} from "@payroll";
import type { Json, Tables, TablesInsert } from "@/types/database";

export interface EmployeeIssue {
  employeeCode: string;
  employeeName: string;
  message: string;
}

export interface RawPeriodData {
  employees: Tables<"employees">[];
  salaries: Tables<"employee_salaries">[];
  timesheets: Tables<"employee_timesheets">[];
  adjustments: Tables<"payroll_adjustments">[];
  deductions: Tables<"employee_deductions">[];
  taxProfiles: Tables<"employee_tax_profiles">[];
  /** ผลคำนวณของงวดก่อนหน้าในปีภาษีเดียวกันที่อนุมัติ/ปิดงวดแล้ว */
  priorResults: Pick<
    Tables<"payroll_results">,
    "employee_id" | "social_security_amount" | "tax_amount" | "input_snapshot"
  >[];
}

const PAY_TYPES: readonly PayType[] = ["monthly", "daily", "hourly"];
const TAX_TYPES: readonly TaxDeductType[] = ["normal", "calculate_per_month", "no_tax"];

export function employeeDisplayName(e: Pick<Tables<"employees">, "title" | "first_name" | "last_name">): string {
  return `${e.title ?? ""}${e.first_name} ${e.last_name}`.trim();
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

function snapshotTaxable(snapshot: Json | null): number | null {
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    const v = snapshot.taxableIncome;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

/**
 * แปลงข้อมูลดิบจากฐานข้อมูลเป็น input ของ engine ต่อพนักงาน (ฟังก์ชันบริสุทธิ์ ทดสอบได้ไม่ต้องใช้ DB)
 * พนักงานที่ข้อมูลไม่พร้อม (ไม่มีเงินเดือน, ค่าประเภทไม่รู้จัก) จะถูกแยกเป็น issue ไม่ถูกข้ามเงียบ ๆ
 */
export function assemblePayrollInputs(
  raw: RawPeriodData,
  ctx: {
    rates: PayrollRates;
    period: PeriodContext;
    /** วันเริ่ม/สิ้นสุดงวด ใช้ตรวจพนักงานที่เริ่มงาน/ลาออก/ปรับเงินเดือนกลางงวด (ไม่ส่ง = ไม่ตรวจ) */
    dates?: { start: string; end: string };
  },
): { inputs: PayrollInput[]; issues: EmployeeIssue[]; notes: string[] } {
  const inputs: PayrollInput[] = [];
  const issues: EmployeeIssue[] = [];
  const notes: string[] = [];
  const partialPeriod: string[] = [];

  const salaryBy = groupBy(raw.salaries, (s) => s.employee_id);
  const sheetBy = groupBy(raw.timesheets, (t) => t.employee_id);
  const adjBy = groupBy(raw.adjustments, (a) => a.employee_id);
  const dedBy = groupBy(raw.deductions, (d) => d.employee_id);
  const profileBy = new Map(raw.taxProfiles.map((p) => [p.employee_id, p]));
  const priorBy = groupBy(raw.priorResults, (r) => r.employee_id);

  let missingSnapshot = 0;

  for (const e of raw.employees) {
    const name = employeeDisplayName(e);
    const fail = (message: string) => issues.push({ employeeCode: e.employee_code, employeeName: name, message });

    const salaries = salaryBy.get(e.id) ?? [];
    if (salaries.length === 0) {
      fail("ไม่มีโครงสร้างเงินเดือนที่มีผลในงวดนี้ (employee_salaries)");
      continue;
    }
    if (salaries.length > 1) {
      fail("มีโครงสร้างเงินเดือนซ้อนกันมากกว่า 1 รายการในงวดนี้");
      continue;
    }
    const salary = salaries[0];
    if (!PAY_TYPES.includes(salary.pay_type as PayType)) {
      fail(`ประเภทการจ่าย '${salary.pay_type}' ไม่รู้จัก`);
      continue;
    }
    if (!TAX_TYPES.includes(salary.tax_deduct_type as TaxDeductType)) {
      fail(`ประเภทการหักภาษี '${salary.tax_deduct_type}' ไม่รู้จัก`);
      continue;
    }

    const sheets = sheetBy.get(e.id) ?? [];
    if (sheets.length > 1) {
      fail("มีข้อมูลเวลาทำงานซ้ำกันมากกว่า 1 แถวในงวดนี้");
      continue;
    }
    const sheet = sheets[0];

    // engine ยังไม่คิดเงินเดือนตามสัดส่วนวัน: ถ้าไม่เตือน พนักงานเริ่มงาน/ลาออก/ขึ้นเงินเดือนกลางงวดจะได้ยอดเต็มงวดแบบเงียบ ๆ
    if (ctx.dates) {
      const { start, end } = ctx.dates;
      const why: string[] = [];
      if (e.hire_date > start) why.push(`เริ่มงานวันที่ ${e.hire_date}`);
      if (e.termination_date && e.termination_date < end) why.push(`สิ้นสุดการจ้างวันที่ ${e.termination_date}`);
      if (salary.effective_date > start && e.hire_date < salary.effective_date) {
        why.push(`เงินเดือนใหม่มีผลวันที่ ${salary.effective_date}`);
      }
      if (why.length > 0) partialPeriod.push(`${e.employee_code} ${name} (${why.join(", ")})`);
    }

    // ยอดสะสมของปีภาษี = ยกมา (ถ้ามี) + งวดก่อนหน้าที่ปิดแล้ว
    const profile = profileBy.get(e.id);
    let ytdTaxable = Number(profile?.ytd_opening_taxable ?? 0);
    let ytdSs = Number(profile?.ytd_opening_social_security ?? 0);
    let ytdTax = Number(profile?.ytd_opening_tax ?? 0);
    for (const r of priorBy.get(e.id) ?? []) {
      const t = snapshotTaxable(r.input_snapshot);
      if (t === null) missingSnapshot++;
      ytdTaxable += t ?? 0;
      ytdSs += Number(r.social_security_amount);
      ytdTax += Number(r.tax_amount);
    }

    inputs.push({
      employee: {
        employeeId: e.id,
        employeeCode: e.employee_code,
        employeeName: name,
        bankCode: e.bank_code,
        bankAccountNo: e.bank_account_no,
        payType: salary.pay_type as PayType,
        baseSalary: Number(salary.base_salary),
        socialSecurityDeduct: salary.social_security_deduct,
        taxDeductType: salary.tax_deduct_type as TaxDeductType,
      },
      timesheet: sheet
        ? {
            workingDays: Number(sheet.working_days),
            otHours10: Number(sheet.ot_hours_1_0),
            otHours15: Number(sheet.ot_hours_1_5),
            otHours20: Number(sheet.ot_hours_2_0),
            otHours25: Number(sheet.ot_hours_2_5),
            otHours30: Number(sheet.ot_hours_3_0),
            lateMinutes: Number(sheet.late_minutes),
            absenceDays: Number(sheet.absence_days),
          }
        : null,
      adjustments: (adjBy.get(e.id) ?? []).map((a) => ({
        type: a.adjustment_type === "deduction" ? "deduction" : "earning",
        itemName: a.item_name,
        amount: Number(a.amount),
        isTaxable: a.is_taxable,
        isSsBase: a.is_ss_base,
      })),
      deductions: (dedBy.get(e.id) ?? []).map((d) => ({
        deductionType: d.deduction_type,
        itemName: d.item_name,
        amount: Number(d.amount),
      })),
      ytd: { taxableIncome: ytdTaxable, socialSecurity: ytdSs, taxWithheld: ytdTax },
      period: ctx.period,
      rates: ctx.rates,
      otherAllowancesAnnual: Number(profile?.other_allowances_annual ?? 0),
    });
  }

  if (partialPeriod.length > 0) {
    const shown = partialPeriod.slice(0, 10).join("; ");
    const more = partialPeriod.length > 10 ? ` และอีก ${partialPeriod.length - 10} คน` : "";
    notes.push(
      `พนักงานที่เริ่มงาน/สิ้นสุดการจ้าง/ปรับเงินเดือนกลางงวด ${partialPeriod.length} คน: ${shown}${more} ` +
        "ระบบยังไม่คิดตามสัดส่วนวัน (ใช้เงินเดือนที่มีผล ณ วันสิ้นสุดงวดเต็มจำนวน) ให้ตรวจและปรับยอดเอง",
    );
  }

  if (missingSnapshot > 0) {
    notes.push(
      `ผลคำนวณงวดก่อนหน้า ${missingSnapshot} รายการไม่มีเงินได้ที่เสียภาษีใน snapshot จึงนับเป็น 0 ยอดสะสมภาษีอาจต่ำเกินจริง`,
    );
  }
  return { inputs, issues, notes };
}

/** แถวที่ส่งให้ฟังก์ชัน save_payroll_results (company_id / payroll_period_id ฟังก์ชันใส่ให้เอง) */
export type SaveResultRow = Omit<
  TablesInsert<"payroll_results">,
  "id" | "company_id" | "payroll_period_id" | "calculated_at" | "calculated_by"
> & {
  items: { item_type: string; code: string; item_name: string; amount: number; sort_order: number }[];
};

export function buildSavePayload(outputs: PayrollOutput[]): SaveResultRow[] {
  return outputs.map((o) => ({
    employee_id: o.employeeId,
    employee_code: o.employeeCode,
    employee_name: o.employeeName,
    bank_code: o.bankCode,
    bank_account_no: o.bankAccountNo,
    base_salary_used: o.baseSalaryUsed,
    working_days: o.workingDays,
    ot_amount: o.otAmount,
    absence_deduction: o.absenceDeduction,
    late_deduction: o.lateDeduction,
    gross_salary: o.grossSalary,
    total_earnings: o.totalEarnings,
    ss_wage_base: o.ssWageBase,
    ss_rate_used: o.ssRateUsed,
    social_security_amount: o.socialSecurityAmount,
    tax_amount: o.taxAmount,
    other_deductions: o.otherDeductions,
    net_salary: o.netSalary,
    calc_version: o.calcVersion,
    input_snapshot: o.snapshot as Json,
    items: o.items.map((i) => ({
      item_type: i.itemType,
      code: i.code,
      item_name: i.itemName,
      amount: i.amount,
      sort_order: i.sortOrder,
    })),
  }));
}

export interface CalcSummary {
  ok: boolean;
  saved: number;
  statusMoved: boolean;
  totals: { gross: number; socialSecurity: number; tax: number; net: number } | null;
  issues: EmployeeIssue[];
  warnings: { employeeCode: string; message: string }[];
  notes: string[];
  fatal?: string;
}

/** รัน engine กับทุก input; แยกพนักงานที่คำนวณไม่ได้ออกเป็น issue */
export function runEngine(inputs: PayrollInput[]): {
  outputs: PayrollOutput[];
  issues: EmployeeIssue[];
} {
  const outputs: PayrollOutput[] = [];
  const issues: EmployeeIssue[] = [];
  for (const input of inputs) {
    try {
      outputs.push(calculatePayroll(input));
    } catch (err) {
      issues.push({
        employeeCode: input.employee.employeeCode,
        employeeName: input.employee.employeeName,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { outputs, issues };
}

export function sumTotals(outputs: PayrollOutput[]): NonNullable<CalcSummary["totals"]> {
  const s = (pick: (o: PayrollOutput) => number) =>
    fromSatang(outputs.reduce((acc, o) => acc + toSatang(pick(o)), 0));
  return {
    gross: s((o) => o.totalEarnings),
    socialSecurity: s((o) => o.socialSecurityAmount),
    tax: s((o) => o.taxAmount),
    net: s((o) => o.netSalary),
  };
}

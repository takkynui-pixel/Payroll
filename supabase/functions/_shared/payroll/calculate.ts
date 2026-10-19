import { fromSatang, roundHalfUp, toSatang } from "./money.ts";
import { calcSocialSecurity } from "./socialSecurity.ts";
import { calcWithholdingTax } from "./tax.ts";
import type { CalcOptions, PayrollInput, PayrollOutput, ResultItem, TimesheetInput } from "./types.ts";

export const CALC_VERSION = "2026.10.1";

export const DEFAULT_OPTIONS: CalcOptions = {
  monthlyDivisor: 30,
  hoursPerDay: 8,
  ssRounding: "baht",
};

const EMPTY_TIMESHEET: TimesheetInput = {
  workingDays: 0,
  otHours10: 0,
  otHours15: 0,
  otHours20: 0,
  otHours25: 0,
  otHours30: 0,
  lateMinutes: 0,
  absenceDays: 0,
};

function assertNonNegative(label: string, n: number): void {
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} must be a non-negative number (got ${String(n)})`);
  }
}

/**
 * คำนวณเงินเดือนของพนักงาน 1 คน ใน 1 งวด (ฟังก์ชันบริสุทธิ์ ไม่แตะฐานข้อมูล)
 *
 * สมมติฐานที่ตั้งไว้ (ทุกข้อเก็บลง snapshot และควรให้ผู้รู้ด้านบัญชีตรวจ):
 *  - รายเดือน: ค่าจ้างรายวัน = เงินเดือน / monthlyDivisor (30)  รายชั่วโมง = รายวัน / hoursPerDay (8)
 *  - รายวัน: จ่ายตามวันทำงานจริง (absence_days ไม่นำมาหักซ้ำ)  รายชั่วโมง: จ่ายตามวันทำงาน x ชั่วโมงต่อวัน
 *  - OT = ค่าจ้างรายชั่วโมง x ชั่วโมง x ตัวคูณ (1.0 / 1.5 / 2.0 / 2.5 / 3.0) ปัดเศษเป็นสตางค์ทีละรายการ
 *  - ฐานประกันสังคม = ค่าจ้างหลังหักขาด/สาย + รายรับที่ติด is_ss_base (ไม่รวม OT)
 *  - ภาษี: ฐานภาษีงวดนี้ = gross (รวม OT) + รายรับที่ is_taxable
 *  - ไม่คิดเงินเดือนตามสัดส่วนวัน กรณีเริ่มงาน/ลาออกกลางงวด (ยังไม่รองรับ)
 */
export function calculatePayroll(input: PayrollInput): PayrollOutput {
  const opts: CalcOptions = { ...DEFAULT_OPTIONS, ...input.options };
  if (!(opts.monthlyDivisor > 0) || !(opts.hoursPerDay > 0)) {
    throw new Error("monthlyDivisor and hoursPerDay must be positive");
  }

  const { employee: emp, rates } = input;
  assertNonNegative("baseSalary", emp.baseSalary);

  const warnings: string[] = [];
  const hasTimesheet = input.timesheet !== null;
  const ts = input.timesheet ?? EMPTY_TIMESHEET;
  if (!hasTimesheet) {
    warnings.push("ไม่มีข้อมูลเวลาทำงานของงวดนี้ จึงคิดเป็น 0 (ไม่มี OT ไม่มีหักขาด/สาย)");
  }
  assertNonNegative("workingDays", ts.workingDays);
  assertNonNegative("otHours10", ts.otHours10);
  assertNonNegative("otHours15", ts.otHours15);
  assertNonNegative("otHours20", ts.otHours20);
  assertNonNegative("otHours25", ts.otHours25);
  assertNonNegative("otHours30", ts.otHours30);
  assertNonNegative("lateMinutes", ts.lateMinutes);
  assertNonNegative("absenceDays", ts.absenceDays);

  // ---------- อัตราค่าจ้างต่อวัน/ชั่วโมง (หน่วยสตางค์ เป็นทศนิยมได้ ปัดตอนเป็นรายการ) ----------
  const baseSatang = toSatang(emp.baseSalary);
  let dailyRate: number;
  let hourlyRate: number;
  let basePaySatang: number;
  switch (emp.payType) {
    case "monthly":
      dailyRate = baseSatang / opts.monthlyDivisor;
      hourlyRate = dailyRate / opts.hoursPerDay;
      basePaySatang = baseSatang;
      break;
    case "daily":
      dailyRate = baseSatang;
      hourlyRate = dailyRate / opts.hoursPerDay;
      basePaySatang = roundHalfUp(baseSatang * ts.workingDays);
      break;
    case "hourly":
      hourlyRate = baseSatang;
      dailyRate = hourlyRate * opts.hoursPerDay;
      basePaySatang = roundHalfUp(baseSatang * opts.hoursPerDay * ts.workingDays);
      break;
    default:
      throw new Error(`unsupported pay type: ${String(emp.payType)}`);
  }

  // ---------- หักขาด/สาย (ไม่ให้เกินค่าจ้างที่มี) ----------
  let absenceSatang = emp.payType === "monthly" ? roundHalfUp(dailyRate * ts.absenceDays) : 0;
  absenceSatang = Math.min(absenceSatang, basePaySatang);
  let lateSatang = roundHalfUp((hourlyRate / 60) * ts.lateMinutes);
  lateSatang = Math.min(lateSatang, basePaySatang - absenceSatang);
  if (absenceSatang === basePaySatang && basePaySatang > 0 && ts.absenceDays > 0) {
    warnings.push("หักขาดงานเท่ากับค่าจ้างทั้งหมดของงวด");
  }

  // ---------- OT ----------
  const otLines = [
    { code: "ot_1_0", name: "ค่าล่วงเวลา 1.0 เท่า", hours: ts.otHours10, mult: 1.0 },
    { code: "ot_1_5", name: "ค่าล่วงเวลา 1.5 เท่า", hours: ts.otHours15, mult: 1.5 },
    { code: "ot_2_0", name: "ค่าล่วงเวลา 2.0 เท่า", hours: ts.otHours20, mult: 2.0 },
    { code: "ot_2_5", name: "ค่าล่วงเวลา 2.5 เท่า", hours: ts.otHours25, mult: 2.5 },
    { code: "ot_3_0", name: "ค่าล่วงเวลา 3.0 เท่า", hours: ts.otHours30, mult: 3.0 },
  ].map((l) => ({ ...l, satang: roundHalfUp(hourlyRate * l.hours * l.mult) }));
  const otSatang = otLines.reduce((s, l) => s + l.satang, 0);

  // ---------- เงินเดือนสุทธิก่อนรายการอื่น ----------
  const wageAfterDeductionSatang = basePaySatang - absenceSatang - lateSatang;
  const grossSatang = wageAfterDeductionSatang + otSatang;

  // ---------- รายรับ/รายหักอื่น ----------
  const earningAdjs = input.adjustments.filter((a) => a.type === "earning");
  const deductionAdjs = input.adjustments.filter((a) => a.type === "deduction");
  for (const a of input.adjustments) assertNonNegative(`adjustment '${a.itemName}'`, a.amount);
  for (const d of input.deductions) assertNonNegative(`deduction '${d.itemName}'`, d.amount);

  const earningAdjSatang = earningAdjs.reduce((s, a) => s + toSatang(a.amount), 0);
  const taxableAdjSatang = earningAdjs.filter((a) => a.isTaxable).reduce((s, a) => s + toSatang(a.amount), 0);
  const ssAdjSatang = earningAdjs.filter((a) => a.isSsBase).reduce((s, a) => s + toSatang(a.amount), 0);
  const deductionAdjSatang = deductionAdjs.reduce((s, a) => s + toSatang(a.amount), 0);
  const recurringSatang = input.deductions.reduce((s, d) => s + toSatang(d.amount), 0);
  const otherDeductionsSatang = deductionAdjSatang + recurringSatang;

  const totalEarningsSatang = grossSatang + earningAdjSatang;

  // ---------- ประกันสังคม ----------
  const ss = calcSocialSecurity(
    wageAfterDeductionSatang + ssAdjSatang,
    emp.socialSecurityDeduct,
    rates,
    opts.ssRounding,
  );

  // ---------- ภาษีหัก ณ ที่จ่าย ----------
  const taxableSatang = grossSatang + taxableAdjSatang;
  if (rates.taxSsDeductionCap === null && emp.taxDeductType !== "no_tax") {
    warnings.push(
      "ไม่มีเพดานลดหย่อนประกันสังคม (tax_ss_deduction_cap) ในตารางอัตรา จึงลดหย่อนตามยอดจริงเต็มจำนวน",
    );
  }
  const tax = calcWithholdingTax({
    taxDeductType: emp.taxDeductType,
    currentTaxableSatang: taxableSatang,
    currentSsSatang: ss.employeeSatang,
    ytdTaxableSatang: toSatang(input.ytd.taxableIncome),
    ytdSsSatang: toSatang(input.ytd.socialSecurity),
    ytdTaxWithheldSatang: toSatang(input.ytd.taxWithheld),
    periodsPerYear: input.period.periodsPerYear,
    periodNumber: input.period.periodNumber,
    otherAllowancesAnnualSatang: toSatang(input.otherAllowancesAnnual ?? 0),
    rates,
  });

  // ---------- สุทธิ ----------
  const netSatang = totalEarningsSatang - ss.employeeSatang - tax.taxSatang - otherDeductionsSatang;
  if (netSatang < 0) {
    warnings.push(`เงินได้สุทธิติดลบ (${fromSatang(netSatang).toFixed(2)}) ตรวจรายการหักของงวดนี้`);
  }

  // ---------- รายการสำหรับสลิป (earning - deduction = net) ----------
  const items: ResultItem[] = [];
  let order = 0;
  const push = (itemType: ResultItem["itemType"], code: string, itemName: string, satang: number) => {
    if (satang > 0) {
      items.push({ itemType, code, itemName, amount: fromSatang(satang), sortOrder: ++order });
    }
  };
  push("earning", "base", emp.payType === "monthly" ? "เงินเดือน" : "ค่าจ้างตามวันทำงาน", basePaySatang);
  for (const l of otLines) push("earning", l.code, l.name, l.satang);
  for (const a of earningAdjs) push("earning", "adjustment", a.itemName, toSatang(a.amount));
  push("deduction", "absence", "หักขาดงาน", absenceSatang);
  push("deduction", "late", "หักมาสาย", lateSatang);
  push("deduction", "social_security", "ประกันสังคม", ss.employeeSatang);
  push("deduction", "withholding_tax", "ภาษีหัก ณ ที่จ่าย", tax.taxSatang);
  for (const a of deductionAdjs) push("deduction", "adjustment", a.itemName, toSatang(a.amount));
  for (const d of input.deductions) push("deduction", `deduction_${d.deductionType}`, d.itemName, toSatang(d.amount));

  return {
    employeeId: emp.employeeId,
    employeeCode: emp.employeeCode,
    employeeName: emp.employeeName,
    bankCode: emp.bankCode,
    bankAccountNo: emp.bankAccountNo,

    baseSalaryUsed: fromSatang(baseSatang),
    workingDays: hasTimesheet ? ts.workingDays : null,
    otAmount: fromSatang(otSatang),
    absenceDeduction: fromSatang(absenceSatang),
    lateDeduction: fromSatang(lateSatang),

    grossSalary: fromSatang(grossSatang),
    totalEarnings: fromSatang(totalEarningsSatang),

    ssWageBase: fromSatang(ss.wageBaseSatang),
    ssRateUsed: ss.wageBaseSatang > 0 ? rates.ssEmployeeRate : 0,
    socialSecurityAmount: fromSatang(ss.employeeSatang),
    employerSocialSecurity: fromSatang(ss.employerSatang),

    taxAmount: fromSatang(tax.taxSatang),
    otherDeductions: fromSatang(otherDeductionsSatang),
    netSalary: fromSatang(netSatang),

    taxableIncome: fromSatang(taxableSatang),

    items,
    warnings,
    calcVersion: CALC_VERSION,
    snapshot: {
      calcVersion: CALC_VERSION,
      options: opts,
      payType: emp.payType,
      taxDeductType: emp.taxDeductType,
      socialSecurityDeduct: emp.socialSecurityDeduct,
      dailyRate: fromSatang(roundHalfUp(dailyRate)),
      hourlyRate: fromSatang(roundHalfUp(hourlyRate)),
      period: input.period,
      ytd: input.ytd,
      otherAllowancesAnnual: input.otherAllowancesAnnual ?? 0,
      taxableIncome: fromSatang(taxableSatang),
      employerSocialSecurity: fromSatang(ss.employerSatang),
      taxDetail: {
        annualIncome: fromSatang(tax.annualIncomeSatang),
        annualExpense: fromSatang(tax.annualExpenseSatang),
        annualDeductions: fromSatang(tax.annualDeductionsSatang),
        annualNetIncome: fromSatang(tax.annualNetIncomeSatang),
        annualTax: fromSatang(tax.annualTaxSatang),
      },
      rates,
      warnings,
    },
  };
}

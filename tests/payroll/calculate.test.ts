import { describe, expect, it } from "vitest";
import { calculatePayroll, toSatang } from "@payroll";
import type { PayrollInput, PayrollOutput } from "@payroll";
import { RATES_2026, employee, payrollInput } from "./fixtures";

const ts = (over: Partial<NonNullable<PayrollInput["timesheet"]>>) => ({
  workingDays: 0,
  otHours10: 0,
  otHours15: 0,
  otHours20: 0,
  otHours30: 0,
  lateMinutes: 0,
  absenceDays: 0,
  ...over,
});

/** ผลรวมรายการสลิป (หน่วยสตางค์) */
function slipTotals(o: PayrollOutput) {
  const earn = o.items.filter((i) => i.itemType === "earning").reduce((s, i) => s + toSatang(i.amount), 0);
  const ded = o.items.filter((i) => i.itemType === "deduction").reduce((s, i) => s + toSatang(i.amount), 0);
  return { earn, ded };
}

describe("เงินเดือนรายเดือน (คำนวณมือทีละบรรทัด)", () => {
  /**
   * เงินเดือน 30,000  -> รายวัน 1,000  รายชั่วโมง 125
   *   หักขาด 1 วัน                    = 1,000.00
   *   หักสาย 90 นาที  125/60 x 90     =   187.50
   *   OT 1.5 x 10 ชม. 125 x 10 x 1.5  = 1,875.00
   *   OT 3.0 x 8 ชม.  125 x 8 x 3     = 3,000.00
   *   gross = 30,000 - 1,000 - 187.50 + 1,875 + 3,000 = 33,687.50
   *   รายรับ: โบนัส 2,000 (ภาษี) + เบี้ยเลี้ยง 1,500 (ภาษี + ฐาน สปส.)  => totalEarnings 37,187.50
   *   ประกันสังคม: ฐาน (29,000 - 187.50 ... ) เกินเพดาน -> 17,500 x 5% = 875.00
   *   ภาษี: เงินได้งวดนี้ 37,187.50 x 12 = 446,250  ค่าใช้จ่าย 100,000  ลดหย่อน 60,000 + 9,000
   *         สุทธิ 277,250  ภาษี (277,250 - 150,000) x 5% = 6,362.50  /12 = 530.21
   *   หักอื่น: เบิกล่วงหน้า 500 + กยศ. 700 = 1,200
   *   net = 37,187.50 - 875 - 530.21 - 1,200 = 34,582.29
   */
  const full = () =>
    calculatePayroll(
      payrollInput({
        timesheet: ts({ workingDays: 26, absenceDays: 1, lateMinutes: 90, otHours15: 10, otHours30: 8 }),
        adjustments: [
          { type: "earning", itemName: "โบนัส", amount: 2000, isTaxable: true, isSsBase: false },
          { type: "earning", itemName: "เบี้ยเลี้ยง", amount: 1500, isTaxable: true, isSsBase: true },
          { type: "deduction", itemName: "เบิกล่วงหน้า", amount: 500, isTaxable: false, isSsBase: false },
        ],
        deductions: [{ deductionType: "student_loan", itemName: "กยศ.", amount: 700 }],
      }),
    );

  it("ตัวเลขทุกบรรทัดตรงกับที่คำนวณมือ", () => {
    const o = full();
    expect(o.baseSalaryUsed).toBe(30000);
    expect(o.workingDays).toBe(26);
    expect(o.absenceDeduction).toBe(1000);
    expect(o.lateDeduction).toBe(187.5);
    expect(o.otAmount).toBe(4875);
    expect(o.grossSalary).toBe(33687.5);
    expect(o.totalEarnings).toBe(37187.5);
    expect(o.ssWageBase).toBe(17500);
    expect(o.ssRateUsed).toBe(0.05);
    expect(o.socialSecurityAmount).toBe(875);
    expect(o.employerSocialSecurity).toBe(875);
    expect(o.taxableIncome).toBe(37187.5);
    expect(o.taxAmount).toBe(530.21);
    expect(o.otherDeductions).toBe(1200);
    expect(o.netSalary).toBe(34582.29);
    expect(o.warnings).toEqual([]);
  });

  it("รายการในสลิปรวมกันได้ยอดสุทธิพอดี", () => {
    const o = full();
    const { earn, ded } = slipTotals(o);
    expect(earn).toBe(3837500); // 30,000 + 1,875 + 3,000 + 2,000 + 1,500
    expect(ded).toBe(379271); // 1,000 + 187.50 + 875 + 530.21 + 500 + 700
    expect(earn - ded).toBe(toSatang(o.netSalary));
  });

  it("snapshot เก็บสิ่งที่ใช้คำนวณไว้ตรวจย้อนหลัง", () => {
    const s = full().snapshot as Record<string, unknown>;
    expect(s.calcVersion).toBe(full().calcVersion);
    expect(s.taxableIncome).toBe(37187.5);
    expect(s.dailyRate).toBe(1000);
    expect(s.hourlyRate).toBe(125);
    expect((s.rates as { ssWageCap: number }).ssWageCap).toBe(17500);
    expect((s.taxDetail as { annualTax: number }).annualTax).toBe(6362.5);
  });
});

describe("ประเภทการจ่าย", () => {
  it("รายวัน: 500/วัน x 22 วัน + OT 1.5 x 4 ชม. (ไม่หักขาดซ้ำ)", () => {
    // base 11,000  ชั่วโมงละ 62.50  OT 62.5 x 4 x 1.5 = 375  gross 11,375  สปส. 11,000 x 5% = 550
    const o = calculatePayroll(
      payrollInput({
        employee: employee({ payType: "daily", baseSalary: 500, taxDeductType: "no_tax" }),
        timesheet: ts({ workingDays: 22, otHours15: 4, absenceDays: 2 }),
      }),
    );
    expect(o.otAmount).toBe(375);
    expect(o.absenceDeduction).toBe(0);
    expect(o.grossSalary).toBe(11375);
    expect(o.ssWageBase).toBe(11000);
    expect(o.socialSecurityAmount).toBe(550);
    expect(o.netSalary).toBe(10825);
  });

  it("รายชั่วโมง: 100/ชม. x 20 วัน x 8 ชม. = 16,000", () => {
    const o = calculatePayroll(
      payrollInput({
        employee: employee({ payType: "hourly", baseSalary: 100, taxDeductType: "no_tax" }),
        timesheet: ts({ workingDays: 20, otHours20: 5 }),
      }),
    );
    // OT 100 x 5 x 2.0 = 1,000
    expect(o.otAmount).toBe(1000);
    expect(o.grossSalary).toBe(17000);
    // ฐานประกันสังคมไม่รวม OT: 16,000 x 5% = 800
    expect(o.ssWageBase).toBe(16000);
    expect(o.socialSecurityAmount).toBe(800);
  });

  it("OT ทุกตัวคูณ 1.0/1.5/2.0/3.0 (รายเดือน 24,000 -> รายชั่วโมง 100)", () => {
    const o = calculatePayroll(
      payrollInput({
        employee: employee({ baseSalary: 24000, socialSecurityDeduct: false, taxDeductType: "no_tax" }),
        timesheet: ts({ otHours10: 2, otHours15: 2, otHours20: 2, otHours30: 2 }),
      }),
    );
    // 200 + 300 + 400 + 600
    expect(o.otAmount).toBe(1500);
    expect(o.items.filter((i) => i.code.startsWith("ot_")).map((i) => i.amount)).toEqual([200, 300, 400, 600]);
  });
});

describe("กรณีขอบ", () => {
  it("ไม่มี timesheet -> คิดเป็น 0 พร้อมคำเตือน", () => {
    const o = calculatePayroll(
      payrollInput({ employee: employee({ baseSalary: 15000, taxDeductType: "no_tax" }), timesheet: null }),
    );
    expect(o.grossSalary).toBe(15000);
    expect(o.workingDays).toBeNull();
    expect(o.warnings.some((w) => w.includes("ไม่มีข้อมูลเวลาทำงาน"))).toBe(true);
    expect(o.socialSecurityAmount).toBe(750);
  });

  it("ไม่หักประกันสังคม -> สปส. 0 และฐาน 0", () => {
    const o = calculatePayroll(
      payrollInput({ employee: employee({ socialSecurityDeduct: false, taxDeductType: "no_tax" }) }),
    );
    expect(o.socialSecurityAmount).toBe(0);
    expect(o.ssWageBase).toBe(0);
    expect(o.ssRateUsed).toBe(0);
    expect(o.netSalary).toBe(30000);
  });

  it("หักขาดงานเกินจำนวนวัน -> จำกัดไม่เกินค่าจ้าง ไม่ติดลบ และไม่มี สปส./ภาษี", () => {
    const o = calculatePayroll(
      payrollInput({
        employee: employee({ baseSalary: 9000 }),
        timesheet: ts({ absenceDays: 40, lateMinutes: 600 }),
      }),
    );
    expect(o.absenceDeduction).toBe(9000);
    expect(o.lateDeduction).toBe(0);
    expect(o.grossSalary).toBe(0);
    expect(o.socialSecurityAmount).toBe(0);
    expect(o.taxAmount).toBe(0);
    expect(o.netSalary).toBe(0);
    expect(o.warnings.some((w) => w.includes("หักขาดงานเท่ากับค่าจ้างทั้งหมด"))).toBe(true);
  });

  it("รายการหักมากกว่ารายได้ -> สุทธิติดลบ พร้อมคำเตือน (ไม่ซ่อน)", () => {
    const o = calculatePayroll(
      payrollInput({
        employee: employee({ baseSalary: 10000, taxDeductType: "no_tax" }),
        adjustments: [{ type: "deduction", itemName: "หักเงินล่วงหน้า", amount: 20000, isTaxable: false, isSsBase: false }],
      }),
    );
    expect(o.netSalary).toBe(-10500); // 10,000 - 500 - 20,000
    expect(o.warnings.some((w) => w.includes("ติดลบ"))).toBe(true);
  });

  it("ไม่มีเพดานลดหย่อน สปส. ในตารางอัตรา -> เตือน (ยกเว้นกรณี no_tax)", () => {
    const rates = { ...RATES_2026, taxSsDeductionCap: null };
    const withTax = calculatePayroll(payrollInput({ rates }));
    expect(withTax.warnings.some((w) => w.includes("tax_ss_deduction_cap"))).toBe(true);
    const noTax = calculatePayroll(payrollInput({ rates, employee: employee({ taxDeductType: "no_tax" }) }));
    expect(noTax.warnings).toEqual([]);
  });

  it("ค่าจ้างต่ำกว่าขั้นต่ำ สปส. -> ฐาน 1,650 = 83 (ปัดเป็นบาทตามค่าเริ่มต้น)", () => {
    const o = calculatePayroll(
      payrollInput({ employee: employee({ baseSalary: 1000, taxDeductType: "no_tax" }) }),
    );
    expect(o.ssWageBase).toBe(1650);
    expect(o.socialSecurityAmount).toBe(83);
  });

  it("รายรับที่ไม่ใช่เงินได้ที่เสียภาษีไม่เข้าฐานภาษี แต่เข้ารายได้รวม", () => {
    const base = calculatePayroll(payrollInput({ employee: employee({ baseSalary: 50000 }) }));
    const o = calculatePayroll(
      payrollInput({
        employee: employee({ baseSalary: 50000 }),
        adjustments: [{ type: "earning", itemName: "สวัสดิการปลอดภาษี", amount: 3000, isTaxable: false, isSsBase: false }],
      }),
    );
    expect(o.totalEarnings).toBe(53000);
    expect(o.taxableIncome).toBe(50000);
    expect(o.taxAmount).toBe(base.taxAmount);
  });

  it("ค่าจ้าง OT ไม่เข้าฐานประกันสังคม แต่เข้าฐานภาษี", () => {
    const o = calculatePayroll(
      payrollInput({
        employee: employee({ baseSalary: 12000 }),
        timesheet: ts({ otHours15: 10 }),
      }),
    );
    expect(o.ssWageBase).toBe(12000);
    expect(o.otAmount).toBe(750); // 12,000/30/8 = 50 x 10 x 1.5
    expect(o.taxableIncome).toBe(12750);
  });
});

describe("ข้อมูลนำเข้าไม่ถูกต้อง", () => {
  it("ค่าติดลบ/ไม่ใช่ตัวเลข -> error", () => {
    expect(() => calculatePayroll(payrollInput({ employee: employee({ baseSalary: -1 }) }))).toThrow(/baseSalary/);
    expect(() => calculatePayroll(payrollInput({ timesheet: ts({ otHours15: -2 }) }))).toThrow(/otHours15/);
    expect(() => calculatePayroll(payrollInput({ timesheet: ts({ lateMinutes: Number.NaN }) }))).toThrow(/lateMinutes/);
    expect(() =>
      calculatePayroll(
        payrollInput({
          adjustments: [{ type: "earning", itemName: "x", amount: -5, isTaxable: true, isSsBase: false }],
        }),
      ),
    ).toThrow(/adjustment/);
  });

  it("ตัวหาร/ชั่วโมงต่อวันต้องเป็นบวก", () => {
    expect(() => calculatePayroll(payrollInput({ options: { monthlyDivisor: 0 } }))).toThrow(/positive/);
  });
});

describe("ปัดเศษประกันสังคมตามตัวเลือก", () => {
  it("12,345 -> 617.25 (สตางค์) / 617 (บาท)", () => {
    const run = (mode: "satang" | "baht") =>
      calculatePayroll(
        payrollInput({
          employee: employee({ baseSalary: 12345, taxDeductType: "no_tax" }),
          options: { ssRounding: mode },
        }),
      ).socialSecurityAmount;
    expect(run("satang")).toBe(617.25);
    expect(run("baht")).toBe(617);
  });
});

/** ตัวสุ่มแบบกำหนดผลได้ (LCG) ให้ test ซ้ำได้ทุกครั้ง */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe("คุณสมบัติที่ต้องจริงเสมอ (สุ่ม 2,000 ราย)", () => {
  it("net = รายได้รวม - สปส. - ภาษี - หักอื่น  และรายการสลิปรวมกันได้ net  และไม่มีค่าติดลบผิดที่", () => {
    const rand = rng(20261015);
    const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    const money = (max: number) => Math.round(rand() * max * 100) / 100;

    for (let n = 0; n < 2000; n++) {
      const payType = pick(["monthly", "daily", "hourly"] as const);
      const baseSalary = payType === "monthly" ? money(200000) : payType === "daily" ? money(3000) : money(500);
      const periodsPerYear = pick([12, 24]);
      const periodNumber = 1 + Math.floor(rand() * periodsPerYear);
      const input = payrollInput({
        employee: employee({
          payType,
          baseSalary,
          socialSecurityDeduct: rand() > 0.2,
          taxDeductType: pick(["normal", "calculate_per_month", "no_tax"] as const),
        }),
        timesheet: ts({
          workingDays: Math.floor(rand() * 27),
          otHours10: money(20),
          otHours15: money(40),
          otHours20: money(20),
          otHours30: money(16),
          lateMinutes: Math.floor(rand() * 300),
          absenceDays: Math.floor(rand() * 6),
        }),
        adjustments: [
          { type: "earning", itemName: "a", amount: money(5000), isTaxable: rand() > 0.5, isSsBase: rand() > 0.5 },
          { type: "deduction", itemName: "b", amount: money(3000), isTaxable: false, isSsBase: false },
        ],
        deductions: rand() > 0.5 ? [{ deductionType: "loan", itemName: "c", amount: money(2000) }] : [],
        ytd: {
          taxableIncome: money(1_000_000),
          socialSecurity: money(8000),
          taxWithheld: money(80000),
        },
        period: { periodsPerYear, periodNumber },
        options: { ssRounding: pick(["satang", "baht"] as const) },
      });

      const o = calculatePayroll(input);
      const sat = (x: number) => toSatang(x);

      // ตรงกับ CHECK constraint ของตาราง payroll_results ทุกประการ
      expect(sat(o.netSalary)).toBe(
        sat(o.totalEarnings) - sat(o.socialSecurityAmount) - sat(o.taxAmount) - sat(o.otherDeductions),
      );
      // สลิป
      const { earn, ded } = slipTotals(o);
      expect(earn - ded).toBe(sat(o.netSalary));
      // gross = base - หักขาด - หักสาย + OT (เมื่อรวมรายรับพิเศษได้ totalEarnings)
      expect(sat(o.grossSalary)).toBeGreaterThanOrEqual(0);
      expect(sat(o.absenceDeduction)).toBeGreaterThanOrEqual(0);
      expect(sat(o.lateDeduction)).toBeGreaterThanOrEqual(0);
      expect(sat(o.socialSecurityAmount)).toBeGreaterThanOrEqual(0);
      expect(sat(o.socialSecurityAmount)).toBeLessThanOrEqual(87500);
      expect(sat(o.taxAmount)).toBeGreaterThanOrEqual(0);
      // ทุกบรรทัดสลิปต้องไม่ติดลบ (ตรงกับ payroll_result_items.amount >= 0)
      expect(o.items.every((i) => i.amount > 0)).toBe(true);
      // ทศนิยมไม่เกิน 2 ตำแหน่ง
      for (const v of [o.grossSalary, o.totalEarnings, o.socialSecurityAmount, o.taxAmount, o.netSalary]) {
        expect(Math.abs(v * 100 - Math.round(v * 100))).toBeLessThan(1e-6);
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  MissingRateError,
  calcSocialSecurity,
  fromSatang,
  parseIsoDate,
  pickTaxBrackets,
  progressiveTaxSatang,
  resolvePeriodContext,
  resolveRates,
  roundHalfUp,
  toSatang,
} from "@payroll";
import { BRACKET_ROWS, RATES_2026, RATE_ROWS } from "./fixtures";

describe("money", () => {
  it("roundHalfUp ปัดครึ่งขึ้นทั้งบวกและลบ", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(2.4999)).toBe(2);
  });

  it("toSatang ไม่พลาดจาก floating point (0.285 -> 29 สตางค์)", () => {
    expect(toSatang(0.285)).toBe(29);
    expect(toSatang(1.005)).toBe(101);
    expect(toSatang("1234.56")).toBe(123456);
    expect(toSatang(null)).toBe(0);
    expect(toSatang(undefined)).toBe(0);
    expect(toSatang("")).toBe(0);
  });

  it("toSatang โยน error เมื่อไม่ใช่ตัวเลข", () => {
    expect(() => toSatang("abc")).toThrow();
    expect(() => toSatang(Number.NaN)).toThrow();
  });

  it("fromSatang แปลงกลับเป็นบาท", () => {
    expect(fromSatang(12345)).toBe(123.45);
    expect(fromSatang(0)).toBe(0);
  });

  it("parseIsoDate", () => {
    expect(parseIsoDate("2026-10-31")).toEqual({ y: 2026, m: 10, day: 31 });
    expect(() => parseIsoDate("31/10/2026")).toThrow();
  });
});

describe("ประกันสังคม ม.33", () => {
  const ss = (wage: number, deduct = true, mode: "satang" | "baht" = "satang") =>
    calcSocialSecurity(toSatang(wage), deduct, RATES_2026, mode);

  it("ค่าจ้างต่ำกว่าเพดาน: 10,000 -> 500.00", () => {
    const r = ss(10000);
    expect(fromSatang(r.employeeSatang)).toBe(500);
    expect(fromSatang(r.employerSatang)).toBe(500);
    expect(fromSatang(r.wageBaseSatang)).toBe(10000);
  });

  it("ค่าจ้างเกินเพดาน 17,500 -> หักสูงสุด 875.00", () => {
    const r = ss(20000);
    expect(fromSatang(r.wageBaseSatang)).toBe(17500);
    expect(fromSatang(r.employeeSatang)).toBe(875);
    expect(fromSatang(ss(1_000_000).employeeSatang)).toBe(875);
  });

  it("ค่าจ้างต่ำกว่าขั้นต่ำ 1,650 -> ใช้ฐาน 1,650 = 82.50", () => {
    const r = ss(1000);
    expect(fromSatang(r.wageBaseSatang)).toBe(1650);
    expect(fromSatang(r.employeeSatang)).toBe(82.5);
  });

  it("ค่าจ้างเท่าขอบเพดาน/ขั้นต่ำพอดี", () => {
    expect(fromSatang(ss(17500).employeeSatang)).toBe(875);
    expect(fromSatang(ss(1650).employeeSatang)).toBe(82.5);
  });

  it("ปัดเศษ: 12,345 -> 617.25 (สตางค์) / 617 (บาท)", () => {
    expect(fromSatang(ss(12345, true, "satang").employeeSatang)).toBe(617.25);
    expect(fromSatang(ss(12345, true, "baht").employeeSatang)).toBe(617);
  });

  it("ปัดเศษ: 12,350 -> 617.50 (สตางค์) / 618 (บาท ปัดครึ่งขึ้น)", () => {
    expect(fromSatang(ss(12350, true, "satang").employeeSatang)).toBe(617.5);
    expect(fromSatang(ss(12350, true, "baht").employeeSatang)).toBe(618);
  });

  it("ไม่ต้องหัก หรือค่าจ้างเป็นศูนย์ -> 0 ทั้งหมด", () => {
    expect(ss(30000, false)).toEqual({ wageBaseSatang: 0, employeeSatang: 0, employerSatang: 0 });
    expect(ss(0)).toEqual({ wageBaseSatang: 0, employeeSatang: 0, employerSatang: 0 });
  });
});

describe("ภาษีตามขั้นบันได", () => {
  const tax = (net: number) => fromSatang(roundHalfUp(progressiveTaxSatang(toSatang(net), RATES_2026.taxBrackets)));

  it("ตรงขอบทุกขั้น (ภาษีสะสมตามตารางกรมสรรพากร)", () => {
    expect(tax(0)).toBe(0);
    expect(tax(150000)).toBe(0);
    expect(tax(300000)).toBe(7500);
    expect(tax(500000)).toBe(27500);
    expect(tax(750000)).toBe(65000);
    expect(tax(1000000)).toBe(115000);
    expect(tax(2000000)).toBe(365000);
    expect(tax(5000000)).toBe(1265000);
  });

  it("กลางขั้น", () => {
    expect(tax(400000)).toBe(17500); // 7,500 + 100,000 x 10%
    expect(tax(6000000)).toBe(1615000); // 1,265,000 + 1,000,000 x 35%
  });
});

describe("resolvePeriodContext", () => {
  it("รายเดือน: 12 งวด งวดที่ = เดือน", () => {
    expect(resolvePeriodContext("monthly", "2026-10-31")).toEqual({ periodsPerYear: 12, periodNumber: 10 });
    expect(resolvePeriodContext("monthly", "2026-01-15")).toEqual({ periodsPerYear: 12, periodNumber: 1 });
  });

  it("ครึ่งเดือน: 24 งวด", () => {
    expect(resolvePeriodContext("semi_monthly", "2026-01-15").periodNumber).toBe(1);
    expect(resolvePeriodContext("semi_monthly", "2026-01-31").periodNumber).toBe(2);
    expect(resolvePeriodContext("semi_monthly", "2026-10-15")).toEqual({ periodsPerYear: 24, periodNumber: 19 });
    expect(resolvePeriodContext("semi_monthly", "2026-12-31").periodNumber).toBe(24);
  });

  it("รอบที่ยังไม่รองรับต้อง error ไม่ใช่คำนวณผิดเงียบ ๆ", () => {
    expect(() => resolvePeriodContext("weekly", "2026-10-31")).toThrow(/not supported/);
    expect(() => resolvePeriodContext("daily", "2026-10-31")).toThrow(/not supported/);
  });
});

describe("resolveRates", () => {
  it("แปลงค่า numeric(string) จากฐานข้อมูลเป็นตัวเลขได้ครบ", () => {
    const r = resolveRates(RATE_ROWS, BRACKET_ROWS, "2026-10-31");
    expect(r.ssEmployeeRate).toBe(0.05);
    expect(r.ssWageFloor).toBe(1650);
    expect(r.ssWageCap).toBe(17500);
    expect(r.taxPersonalAllowance).toBe(60000);
    expect(r.taxSsDeductionCap).toBe(9000);
    expect(r.taxBrackets).toHaveLength(8);
    expect(r.taxBrackets[7]).toEqual({ incomeFrom: 5000000, incomeTo: null, rate: 0.35 });
  });

  it("เพดานค่าจ้างเปลี่ยนตามช่วงวันที่ (17,500 -> 20,000 -> 23,000)", () => {
    expect(resolveRates(RATE_ROWS, BRACKET_ROWS, "2028-12-31").ssWageCap).toBe(17500);
    expect(resolveRates(RATE_ROWS, BRACKET_ROWS, "2029-01-01").ssWageCap).toBe(20000);
    expect(resolveRates(RATE_ROWS, BRACKET_ROWS, "2031-12-31").ssWageCap).toBe(20000);
    expect(resolveRates(RATE_ROWS, BRACKET_ROWS, "2032-01-01").ssWageCap).toBe(23000);
  });

  it("ก่อนวันมีผลของอัตรา -> MissingRateError", () => {
    expect(() => resolveRates(RATE_ROWS, BRACKET_ROWS, "2025-12-31")).toThrow(MissingRateError);
  });

  it("ขาดอัตราที่จำเป็น -> MissingRateError ระบุชื่อ code", () => {
    const rows = RATE_ROWS.filter((r) => r.code !== "ss_wage_floor");
    expect(() => resolveRates(rows, BRACKET_ROWS, "2026-10-31")).toThrow(/ss_wage_floor/);
  });

  it("ไม่มีเพดานลดหย่อนประกันสังคม -> null (ไม่ error)", () => {
    const rows = RATE_ROWS.filter((r) => r.code !== "tax_ss_deduction_cap");
    expect(resolveRates(rows, BRACKET_ROWS, "2026-10-31").taxSsDeductionCap).toBeNull();
  });
});

describe("pickTaxBrackets", () => {
  it("เลือกชุดที่ effective_from ล่าสุด", () => {
    const newer = BRACKET_ROWS.map((b) => ({ ...b, effective_from: "2027-01-01", rate: "0.0100" }));
    const picked = pickTaxBrackets([...BRACKET_ROWS, ...newer], "2027-06-01");
    expect(picked.every((b) => b.rate === 0.01)).toBe(true);
    expect(pickTaxBrackets([...BRACKET_ROWS, ...newer], "2026-06-01")[1].rate).toBe(0.05);
  });

  it("ขั้นไม่ต่อเนื่อง / ไม่เริ่มที่ 0 / ขั้นสุดท้ายมีเพดาน -> error", () => {
    const gap = BRACKET_ROWS.filter((b) => b.income_from !== "300000.00");
    expect(() => pickTaxBrackets(gap, "2026-10-31")).toThrow(/contiguous/);

    const noZero = BRACKET_ROWS.slice(1);
    expect(() => pickTaxBrackets(noZero, "2026-10-31")).toThrow(/start at income 0/);

    const capped = BRACKET_ROWS.map((b) => (b.income_to === null ? { ...b, income_to: "9000000.00" } : b));
    expect(() => pickTaxBrackets(capped, "2026-10-31")).toThrow(/no upper limit/);
  });

  it("ไม่มีขั้นภาษีที่มีผล -> error", () => {
    expect(() => pickTaxBrackets(BRACKET_ROWS, "2025-01-01")).toThrow(MissingRateError);
  });
});

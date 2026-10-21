import { describe, expect, it } from "vitest";
import { prorateMonthly } from "@/lib/payroll/proration";

const sal = (base: number, eff: string, end: string | null = null, pay = "monthly") => ({ base_salary: base, effective_date: eff, end_date: end, pay_type: pay });
const oct = { start: "2026-10-01", end: "2026-10-31" };

describe("prorateMonthly (ฐาน 30 วัน คิดตามวันทำงานจริง)", () => {
  it("ทำงานเต็มงวดด้วยเงินเดือนเดียว = จ่ายเต็ม ทั้งเดือน 28 และ 31 วัน", () => {
    const a = prorateMonthly({ ...oct, hireDate: "2025-01-01", terminationDate: null, salaries: [sal(50000, "2025-01-01")] });
    expect(a).toMatchObject({ amount: 50000, partial: false });
    const feb = prorateMonthly({ start: "2027-02-01", end: "2027-02-28", hireDate: "2025-01-01", terminationDate: null, salaries: [sal(50000, "2025-01-01")] });
    expect(feb).toMatchObject({ amount: 50000, partial: false });
  });
  it("เริ่มงานกลางงวด = เงินเดือน x วัน / 30", () => {
    const r = prorateMonthly({ ...oct, hireDate: "2026-10-15", terminationDate: null, salaries: [sal(50000, "2026-10-15")] });
    expect(r).toMatchObject({ amount: 28333.33, coveredDays: 17, employedDays: 17, partial: true });
  });
  it("เริ่มวันที่ 2 ของเดือน 31 วัน ได้เต็มเดือน (นับสูงสุด 30 วัน)", () => {
    const r = prorateMonthly({ ...oct, hireDate: "2026-10-02", terminationDate: null, salaries: [sal(60000, "2026-10-02")] });
    expect(r.amount).toBe(60000);
  });
  it("ลาออกกลางงวด", () => {
    const r = prorateMonthly({ ...oct, hireDate: "2025-01-01", terminationDate: "2026-10-20", salaries: [sal(50000, "2025-01-01")] });
    expect(r).toMatchObject({ amount: 33333.33, coveredDays: 20, partial: true });
  });
  it("กุมภาพันธ์ เริ่มงานวันที่ 15 = 14 วัน / 30", () => {
    const r = prorateMonthly({ start: "2027-02-01", end: "2027-02-28", hireDate: "2027-02-15", terminationDate: null, salaries: [sal(50000, "2027-02-15")] });
    expect(r.amount).toBe(23333.33);
  });
  it("ขึ้นเงินเดือนกลางงวด (ทำงานครบงวด) ถ่วงน้ำหนักตามวัน", () => {
    const r = prorateMonthly({
      ...oct,
      hireDate: "2025-01-01",
      terminationDate: null,
      salaries: [sal(40000, "2025-01-01", "2026-10-15"), sal(50000, "2026-10-16")],
    });
    expect(r).toMatchObject({ amount: 45161.29, partial: true, coveredDays: 31 });
  });
  it("มีช่วงเป็นรายวันปนอยู่ -> mixedPayType", () => {
    const r = prorateMonthly({ ...oct, hireDate: "2025-01-01", terminationDate: null, salaries: [sal(380, "2025-01-01", "2026-10-15", "daily"), sal(50000, "2026-10-16")] });
    expect(r.mixedPayType).toBe(true);
  });
});

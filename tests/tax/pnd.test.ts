import { describe, expect, it } from "vitest";
import { buildAnnual, buildMonthly, paginate, splitSatang, toSatang, type PaidRow } from "@/lib/tax/pnd";

const row = (id: string, name: string, payDate: string, income: number, tax: number): PaidRow => ({
  employeeId: id,
  employeeName: name,
  payDate,
  incomeSatang: toSatang(income),
  taxSatang: toSatang(tax),
});

const rows: PaidRow[] = [
  row("a", "ก", "2026-09-30", 20000, 100),
  row("a", "ก", "2026-10-31", 20000, 100.5),
  row("b", "ข", "2026-10-31", 16600, 0),
  row("c", "ค", "2026-10-15", 8000, 0),
  row("c", "ค", "2026-10-31", 8000, 0),
  row("a", "ก", "2025-12-31", 99999, 999),
];

describe("buildMonthly (ภ.ง.ด.1)", () => {
  it("รวมทุกคนที่จ่ายในเดือนนั้น เมื่อ includeZeroTax = true", () => {
    const r = buildMonthly(rows, 2026, 10, true);
    expect(r.payeeCount).toBe(3);
    expect(r.lines).toHaveLength(4); // c จ่าย 2 ครั้ง
    expect(r.incomeSatang).toBe(toSatang(20000 + 16600 + 8000 + 8000));
    expect(r.taxSatang).toBe(10050);
  });
  it("เฉพาะคนที่ถูกหักภาษี เมื่อ includeZeroTax = false", () => {
    const r = buildMonthly(rows, 2026, 10, false);
    expect(r.payeeCount).toBe(1);
    expect(r.lines.map((l) => l.employeeId)).toEqual(["a"]);
  });
  it("ไม่ปนเดือน/ปีอื่น", () => {
    expect(buildMonthly(rows, 2026, 9, true).incomeSatang).toBe(2000000);
    expect(buildMonthly(rows, 2026, 11, true).lines).toEqual([]);
  });
  it("รวมยอดแม่นยำเป็นสตางค์ (ไม่มีเศษ float)", () => {
    const r = buildMonthly([row("a", "ก", "2026-10-31", 0.1, 0.1), row("b", "ข", "2026-10-31", 0.2, 0.2)], 2026, 10, true);
    expect(r.incomeSatang).toBe(30);
    expect(r.taxSatang).toBe(30);
  });
});

describe("buildAnnual (ภ.ง.ด.1ก)", () => {
  it("รวมทั้งปีต่อคน รวมคนที่ภาษี 0", () => {
    const r = buildAnnual(rows, 2026);
    expect(r.payeeCount).toBe(3);
    expect(r.lines.find((l) => l.employeeId === "a")!.incomeSatang).toBe(4000000);
    expect(r.lines.find((l) => l.employeeId === "c")!.taxSatang).toBe(0);
    expect(r.incomeSatang).toBe(toSatang(40000 + 16600 + 16000));
  });
});

describe("helpers", () => {
  it("paginate แบ่งหน้าและมีอย่างน้อย 1 หน้า", () => {
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(paginate([], 6)).toEqual([[]]);
  });
  it("splitSatang แยกบาท/สตางค์", () => {
    expect(splitSatang(123456789)).toEqual({ baht: "1,234,567", satang: "89" });
    expect(splitSatang(5)).toEqual({ baht: "0", satang: "05" });
  });
});

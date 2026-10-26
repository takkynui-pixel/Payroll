import { describe, expect, it } from "vitest";
import { normalizeBankCode } from "@/lib/bank/banks";
import { buildBankFile, encodeTis620, satangToDecimal, type BankRowInput } from "@/lib/bank/transfer";

const row = (o: Partial<BankRowInput> = {}): BankRowInput => ({
  employeeCode: "E001",
  employeeName: "สมชาย ใจดี",
  bankCode: "KBANK",
  bankAccountNo: "123-4-56789-0",
  netSalary: 15000.5,
  ...o,
});
const source = { bankCode: "SCB", accountNo: "1112223334", accountName: "บริษัท ทดสอบ จำกัด", customerId: "CUST01" };
const base = { source, payDate: "2026-10-31", reference: "ต.ค. 2569" };

describe("normalizeBankCode", () => {
  it.each([
    ["KBANK", "004"], ["kbank", "004"], ["กสิกร", "004"], ["ธนาคารกสิกรไทย", "004"], ["004", "004"],
    ["SCB", "014"], ["ไทยพาณิชย์", "014"], ["BBL", "002"], ["Bangkok Bank", "002"], ["TMB", "011"], ["ttb", "011"],
    ["ธกส", "034"], ["ธ.ก.ส.", "034"], ["กรุงศรี", "025"], ["ออมสิน", "030"],
  ])("%s -> %s", (input, code) => expect(normalizeBankCode(input)).toBe(code));
  it("ไม่รู้จัก/ว่าง = null", () => {
    expect(normalizeBankCode("XYZ")).toBeNull();
    expect(normalizeBankCode("999")).toBeNull();
    expect(normalizeBankCode("")).toBeNull();
    expect(normalizeBankCode(null)).toBeNull();
  });
});

describe("satangToDecimal / TIS-620", () => {
  it("ไม่มีเศษ float", () => {
    expect(satangToDecimal(1500050)).toBe("15000.50");
    expect(satangToDecimal(5)).toBe("0.05");
    expect(satangToDecimal(100)).toBe("1.00");
  });
  it("เข้ารหัสไทยเป็น TIS-620 ถูกต้อง", () => {
    expect([...encodeTis620("กฮ").bytes]).toEqual([0xa1, 0xce]);
    expect([...encodeTis620("ฯ๛").bytes]).toEqual([0xcf, 0xfb]);
    expect([...encodeTis620("฿").bytes]).toEqual([0xdf]);
    const bad = encodeTis620("A😀");
    expect([...bad.bytes]).toEqual([0x41, 0x3f]);
    expect(bad.unmappable).toBe(1);
  });
});

describe("buildBankFile", () => {
  it("แยกรายที่ออกไฟล์ไม่ได้พร้อมเหตุผล และรวมยอดเป็นสตางค์", () => {
    const r = buildBankFile({
      ...base,
      format: "csv",
      rows: [
        row(),
        row({ employeeCode: "E002", bankCode: null, bankAccountNo: null }),
        row({ employeeCode: "E003", bankCode: "ABC", bankAccountNo: "1234567890" }),
        row({ employeeCode: "E004", bankAccountNo: "12345" }),
        row({ employeeCode: "E005", netSalary: 0 }),
        row({ employeeCode: "E006", netSalary: -10 }),
        row({ employeeCode: "E007", bankCode: "SCB", bankAccountNo: "9876543210", netSalary: 0.1 + 0.2 }),
      ],
    });
    expect(r.count).toBe(2);
    expect(r.totalSatang).toBe(1500050 + 30);
    expect(r.skipped.map((s) => s.employeeCode)).toEqual(["E002", "E003", "E004", "E005", "E006"]);
    expect(r.byBank).toEqual([
      { bankCode: "004", count: 1, totalSatang: 1500050 },
      { bankCode: "014", count: 1, totalSatang: 30 },
    ]);
  });

  it("CSV: มี BOM, หัวคอลัมน์, บรรทัดข้อมูลถูกต้อง และ quote เมื่อมีจุลภาค", () => {
    const r = buildBankFile({ ...base, format: "csv", rows: [row({ employeeName: 'สมชาย, "เอ" ใจดี' })] });
    expect([...r.content.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = r.text.trimEnd().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('1,004,KBANK,1234567890,"สมชาย, ""เอ"" ใจดี",15000.50,E001,2026-10-31,ต.ค. 2569');
  });

  it("Fixed: ความยาวบรรทัดคงที่ ยอดรวม H = T = ผลรวม D และเป็น TIS-620 ล้วน", () => {
    const r = buildBankFile({
      ...base,
      format: "fixed_tis620",
      rows: [row(), row({ employeeCode: "E002", employeeName: "สมหญิง รักดี", bankCode: "014", bankAccountNo: "9876543210", netSalary: 20000 })],
    });
    const lines = r.text.trimEnd().split("\r\n");
    expect(lines).toHaveLength(4);
    const [h, d1, d2, t] = lines;
    expect(h).toHaveLength(1 + 6 + 3 + 15 + 15 + 8 + 6 + 15);
    expect(d1).toHaveLength(1 + 6 + 3 + 15 + 15 + 50 + 20 + 30);
    expect(d2).toHaveLength(d1.length);
    expect(h.slice(0, 10)).toBe("H000001014");
    expect(h.slice(10, 25).trim()).toBe("1112223334");
    expect(h.slice(40, 48)).toBe("20261031");
    expect(h.slice(48)).toBe("000002" + "000000003500050");
    expect(d1.slice(0, 10)).toBe("D000001004");
    expect(d1.slice(25, 40)).toBe("000000001500050");
    expect(t).toBe("T000002000000003500050");
    // ทุกไบต์เป็น ASCII หรือ TIS-620 (ไม่มีไบต์ของ UTF-8 หลายไบต์)
    expect(r.content.length).toBe(r.text.length);
  });

  it("กรองตามธนาคารปลายทาง", () => {
    const rows = [row(), row({ employeeCode: "E002", bankCode: "SCB", bankAccountNo: "9876543210" })];
    const r = buildBankFile({ ...base, format: "csv", rows, onlyBank: "014" });
    expect(r.lines.map((l) => l.employeeCode)).toEqual(["E002"]);
    expect(r.skipped).toHaveLength(0);
  });

  it("เตือนเมื่อไม่มีบัญชีต้นทาง และเมื่อเลขบัญชีซ้ำ", () => {
    const r = buildBankFile({
      ...base,
      source: { bankCode: null, accountNo: null, accountName: null, customerId: null },
      format: "csv",
      rows: [row(), row({ employeeCode: "E002" })],
    });
    expect(r.warnings.some((w) => w.includes("บัญชีต้นทาง"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("ซ้ำ"))).toBe(true);
  });

  it("ไม่มีรายการ = ไฟล์ว่างแต่ไม่ error", () => {
    const r = buildBankFile({ ...base, format: "fixed_tis620", rows: [] });
    expect(r.count).toBe(0);
    expect(r.text.trimEnd().split("\r\n")).toHaveLength(2);
  });
});

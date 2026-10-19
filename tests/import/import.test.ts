import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseDate, parseNumber, parseYesNo } from "@/lib/import/common";
import { parseEmployeeWorkbook } from "@/lib/import/employees";
import { buildTemplate } from "@/lib/import/template";
import { isValidThaiId } from "@/lib/import/thai-id";
import { parseTimesheetWorkbook } from "@/lib/import/timesheets";

// เลขบัตรทดสอบที่ผ่าน checksum (สร้างจากสูตร ไม่ใช่เลขของบุคคลจริง)
function makeId(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (13 - i);
  return first12 + String((11 - (sum % 11)) % 10);
}
const GOOD_ID = makeId("110000000001");

async function roundTrip(wb: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const buf = await wb.xlsx.writeBuffer();
  const out = new ExcelJS.Workbook();
  await out.xlsx.load(buf as ArrayBuffer);
  return out;
}

describe("thai id", () => {
  it("ตรวจ checksum", () => {
    expect(isValidThaiId(GOOD_ID)).toBe(true);
    expect(isValidThaiId(GOOD_ID.slice(0, 12) + ((Number(GOOD_ID[12]) + 1) % 10))).toBe(false);
    expect(isValidThaiId("123")).toBe(false);
    expect(isValidThaiId("abcdefghijklm")).toBe(false);
  });
});

describe("parseDate", () => {
  it("รับ ค.ศ./พ.ศ./Date/serial", () => {
    expect(parseDate("2026-10-01")).toBe("2026-10-01");
    expect(parseDate("01/10/2026")).toBe("2026-10-01");
    expect(parseDate("01/10/2569")).toBe("2026-10-01");
    expect(parseDate(new Date(Date.UTC(2026, 9, 1)))).toBe("2026-10-01");
    expect(parseDate(46296)).toBe("2026-10-01");
    expect(parseDate(null)).toBeNull();
  });
  it("ปฏิเสธวันที่ที่ไม่มีจริง/รูปแบบแปลก", () => {
    expect(() => parseDate("31/02/2026")).toThrow();
    expect(() => parseDate("ตุลาคม")).toThrow();
    expect(() => parseDate("01/10/1800")).toThrow();
  });
});

describe("parseNumber / parseYesNo", () => {
  it("แปลงตัวเลข", () => {
    expect(parseNumber("1,234.50")).toBe(1234.5);
    expect(parseNumber(null)).toBeNull();
    expect(() => parseNumber("abc")).toThrow();
    expect(() => parseNumber(-1, { min: 0 })).toThrow();
    expect(() => parseNumber(1.5, { integer: true })).toThrow();
  });
  it("ใช่/ไม่ใช่", () => {
    expect(parseYesNo("ใช่", false)).toBe(true);
    expect(parseYesNo("ไม่ใช่", true)).toBe(false);
    expect(parseYesNo(null, true)).toBe(true);
    expect(() => parseYesNo("อาจจะ", true)).toThrow();
  });
});

describe("แม่แบบ", () => {
  it("แม่แบบเปล่าผ่านการอ่านโดยแจ้งว่าไม่มีข้อมูล (ตัวอย่างไม่ถูกนำเข้า)", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildTemplate("employees")) as unknown as ArrayBuffer);
    const r = parseEmployeeWorkbook(wb);
    expect(r.rows).toHaveLength(0);
    expect(r.issues.map((i) => i.message)).toContain("ไม่พบข้อมูลพนักงานในชีต");

    const wt = new ExcelJS.Workbook();
    await wt.xlsx.load((await buildTemplate("timesheets")) as unknown as ArrayBuffer);
    const t = parseTimesheetWorkbook(wt);
    expect(t.timesheets).toHaveLength(0);
    expect(t.adjustments).toEqual([]);
  });
});

describe("parseEmployeeWorkbook", () => {
  async function build(rows: (string | number | Date | null)[][]) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("พนักงาน");
    ws.addRow([
      "รหัสพนักงาน *", "คำนำหน้า", "ชื่อ *", "นามสกุล *", "วันที่เริ่มงาน *", "เลขบัตรประชาชน", "ธนาคาร", "เลขบัญชี",
      "อีเมล", "โทรศัพท์", "ประเภทการจ่าย *", "เงินเดือน/ค่าจ้าง *", "หักประกันสังคม", "วิธีหักภาษี", "เงินเดือนมีผลตั้งแต่",
    ]);
    rows.forEach((r) => ws.addRow(r));
    return roundTrip(wb);
  }

  it("อ่านแถวที่ถูกต้องและใส่ค่าเริ่มต้น", async () => {
    const wb = await build([
      ["E1", "นาย", "ก", "ข", new Date(Date.UTC(2026, 9, 1)), GOOD_ID, "KBANK", "0123456789", null, null, "รายวัน", 400, null, null, null],
    ]);
    const r = parseEmployeeWorkbook(wb);
    expect(r.issues).toEqual([]);
    expect(r.rows[0]).toMatchObject({
      employee_code: "E1",
      hire_date: "2026-10-01",
      effective_date: "2026-10-01",
      pay_type: "daily",
      base_salary: 400,
      social_security_deduct: true,
      tax_deduct_type: "normal",
      id_card: GOOD_ID,
      bank_account_no: "0123456789",
    });
  });

  it("รายงานทุกข้อผิดพร้อมเลขแถว และไม่ปล่อยแถวผิดผ่าน", async () => {
    const wb = await build([
      ["E1", null, "ก", "ข", "01/10/2026", "1234567890123", null, null, null, null, "รายวัน", 400, null, null, null],
      ["E1", null, "ค", "ง", "99/99/2026", null, null, null, "bad", null, "ครึ่งวัน", -5, "อาจจะ", null, null],
      ["E3", null, "จ", "ฉ", "01/10/2026", null, null, null, null, null, "รายเดือน", 15000, null, null, "01/09/2026"],
    ]);
    const r = parseEmployeeWorkbook(wb);
    expect(r.rows).toHaveLength(0);
    const byRow = (n: number) => r.issues.filter((i) => i.row === n).map((i) => i.message).join(" | ");
    expect(byRow(2)).toContain("เลขบัตรประชาชนไม่ถูกต้อง");
    expect(byRow(3)).toContain("รหัสพนักงาน: ซ้ำกับแถว 2");
    expect(byRow(3)).toContain("วันที่เริ่มงาน");
    expect(byRow(3)).toContain("ประเภทการจ่าย");
    expect(byRow(3)).toContain("เงินเดือน/ค่าจ้าง");
    expect(byRow(3)).toContain("อีเมล");
    expect(byRow(3)).toContain("หักประกันสังคม");
    expect(byRow(4)).toContain("ต้องไม่ก่อนวันที่เริ่มงาน");
  });

  it("ข้ามแถวว่างและเตือนเลขบัญชีที่เป็นตัวเลข", async () => {
    const wb = await build([
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      ["E1", null, "ก", "ข", "01/10/2026", null, "SCB", 1234567890, null, null, "รายเดือน", 15000, null, null, null],
    ]);
    const r = parseEmployeeWorkbook(wb);
    expect(r.rows).toHaveLength(1);
    expect(r.warnings.join(" ")).toContain("เลขบัญชี");
  });

  it("ไฟล์ที่ไม่ใช่แม่แบบ: แจ้งชีต/คอลัมน์ที่ขาด", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Sheet1").addRow(["a"]);
    expect(parseEmployeeWorkbook(wb).issues[0].message).toContain('ไม่พบชีต "พนักงาน"');
    const wb2 = new ExcelJS.Workbook();
    wb2.addWorksheet("พนักงาน").addRow(["รหัสพนักงาน"]);
    expect(parseEmployeeWorkbook(wb2).issues[0].message).toContain("ไม่พบคอลัมน์");
  });
});

describe("parseTimesheetWorkbook", () => {
  async function build(ts: (string | number | null)[][], adj?: (string | number | null)[][]) {
    const wb = new ExcelJS.Workbook();
    const a = wb.addWorksheet("เวลาทำงาน");
    a.addRow(["รหัสพนักงาน *", "วันทำงาน", "OT 1.0", "OT 1.5", "OT 2.0", "OT 2.5", "OT 3.0", "สาย (นาที)", "ขาด/ลาไม่รับค่าจ้าง (วัน)"]);
    ts.forEach((r) => a.addRow(r));
    if (adj) {
      const b = wb.addWorksheet("รายการเพิ่ม-หัก");
      b.addRow(["รหัสพนักงาน *", "ประเภท *", "ชื่อรายการ *", "จำนวนเงิน *", "เสียภาษี", "เป็นฐานประกันสังคม"]);
      adj.forEach((r) => b.addRow(r));
    }
    return roundTrip(wb);
  }

  it("อ่านเวลาทำงานและรายการเพิ่ม-หัก ค่าว่างเป็น 0", async () => {
    const wb = await build(
      [["E1", 26, null, 10.5, null, 3, null, 15, 1]],
      [
        ["E1", "รายได้", "ค่ากะ", 70, "ใช่", "ใช่"],
        ["E1", "รายการหัก", "ค่าชุด", 200, "ใช่", "ใช่"],
      ],
    );
    const r = parseTimesheetWorkbook(wb);
    expect(r.issues).toEqual([]);
    expect(r.timesheets[0]).toEqual({
      employee_code: "E1", working_days: 26, ot_hours_1_0: 0, ot_hours_1_5: 10.5, ot_hours_2_0: 0, ot_hours_2_5: 3, ot_hours_3_0: 0,
      late_minutes: 15, absence_days: 1,
    });
    expect(r.adjustments).toHaveLength(2);
    expect(r.adjustments![0]).toMatchObject({ adjustment_type: "earning", is_taxable: true, is_ss_base: true });
    // รายการหักไม่เป็นฐานภาษี/ประกันสังคมเสมอ
    expect(r.adjustments![1]).toMatchObject({ adjustment_type: "deduction", is_taxable: false, is_ss_base: false });
  });

  it("ไม่มีชีตรายการเพิ่ม-หัก = null (ไม่แตะของเดิม)", async () => {
    const r = parseTimesheetWorkbook(await build([["E1", 20, 0, 0, 0, 0, 0, 0]]));
    expect(r.adjustments).toBeNull();
  });

  it("ปฏิเสธรหัสซ้ำ ค่าติดลบ นาทีสายทศนิยม และจำนวนเงิน <= 0", async () => {
    const r = parseTimesheetWorkbook(
      await build(
        [
          ["E1", 20, 0, 0, 0, 0, 0, 0, 0],
          ["E1", -1, 0, 0, 0, 0, 0, 1.5, 0],
        ],
        [["E1", "รายได้", "ค่ากะ", 0, null, null]],
      ),
    );
    const msgs = r.issues.map((i) => `${i.sheet}:${i.row}:${i.message}`).join("\n");
    expect(msgs).toContain("เวลาทำงาน:3:รหัสพนักงาน: ซ้ำกับแถว 2");
    expect(msgs).toContain("เวลาทำงาน:3:วันทำงาน");
    expect(msgs).toContain("เวลาทำงาน:3:สาย (นาที): ต้องเป็นจำนวนเต็ม");
    expect(msgs).toContain("รายการเพิ่ม-หัก:2:จำนวนเงิน");
  });

  it("เซลล์สูตรที่เป็น #N/A ถูกรายงานเป็นข้อผิดพลาดของแถวนั้น", async () => {
    const wb = new ExcelJS.Workbook();
    const a = wb.addWorksheet("เวลาทำงาน");
    a.addRow(["รหัสพนักงาน *", "วันทำงาน", "OT 1.0", "OT 1.5", "OT 2.0", "OT 2.5", "OT 3.0", "สาย (นาที)", "ขาด/ลาไม่รับค่าจ้าง (วัน)"]);
    a.addRow(["E1", { error: "#N/A" } as unknown as ExcelJS.CellValue, 0, 0, 0, 0, 0, 0, 0]);
    const r = parseTimesheetWorkbook(await roundTrip(wb));
    expect(r.timesheets).toHaveLength(0);
    expect(r.issues.some((i) => i.row === 2 && i.message.includes("#N/A"))).toBe(true);
  });
});

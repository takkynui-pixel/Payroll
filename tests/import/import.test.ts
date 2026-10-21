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

  it("อีเมล: แปลงเป็นตัวพิมพ์เล็ก และปฏิเสธอีเมลซ้ำในไฟล์ (1 อีเมลต่อ 1 พนักงาน)", async () => {
    const ok = parseEmployeeWorkbook(await build([["E1", null, "ก", "ข", "01/10/2026", null, null, null, "Somchai@Example.COM", null, "รายเดือน", 15000, null, null, null]]));
    expect(ok.issues).toEqual([]);
    expect(ok.rows[0].email).toBe("somchai@example.com");
    const dup = parseEmployeeWorkbook(
      await build([
        ["E1", null, "ก", "ข", "01/10/2026", null, null, null, "a@x.com", null, "รายเดือน", 15000, null, null, null],
        ["E2", null, "ค", "ง", "01/10/2026", null, null, null, "A@X.com", null, "รายเดือน", 15000, null, null, null],
      ]),
    );
    expect(dup.issues.some((i) => i.row === 3 && i.message.includes("อีเมล: ซ้ำกับแถว 2"))).toBe(true);
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
      employee_code: "E1", working_minutes: 26 * 480, absence_minutes: 480, leave_unpaid_minutes: 0, late_minutes: 15, early_leave_minutes: 0,
      ot_minutes_1_0: 0, ot_minutes_1_5: 630, ot_minutes_2_0: 0, ot_minutes_2_5: 180, ot_minutes_3_0: 0,
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

describe("parseTimesheetWorkbook แบบ วัน/ชั่วโมง/นาที (2 แถวหัวตาราง)", () => {
  // โครงสร้างหัวตารางเหมือนไฟล์จากระบบเวลา (ข้อมูลสมมติ)
  const HEAD1 = ["ID Emp", "จำนวนวันทำงาน", null, null, null, "ขาดงาน", null, null, null, "ลาหักเงิน", null, null, null, "สาย", null, null, "ออกก่อน", null, null, "ค่า", "ค่า", "OT1.0", null, null, "OT1.5", null, null, "OT2.0", null, null, "OT2.5", null, null, "OT3.0", null, null, "OT4", null, null];
  const HEAD2 = [null, "Day", "Hr", "min", "Baht", "Day", "Hr", "min", "เงินบาท", "Day", "Hr", "min", "เงินบาท", "Hr", "min", "Baht", "Hr", "min", "Baht", "กะ", "กิน", "Hr", "min", "Baht", "Hr", "min", "Baht", "Hr", "min", "Baht", "Hr", "min", "Baht", "Hr", "min", "Baht", "Hr", "min", "Baht"];

  /** แถวข้อมูลที่เติมค่า 0 แล้วแทนค่าเฉพาะตำแหน่งที่ต้องการ */
  function dataRow(code: string, set: Record<number, number>): (string | number)[] {
    const r: (string | number)[] = [code, ...Array<number>(HEAD2.length - 1).fill(0)];
    for (const [i, v] of Object.entries(set)) r[Number(i)] = v;
    return r;
  }
  async function build(rows: (string | number)[][]) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow(HEAD1);
    ws.addRow(HEAD2);
    rows.forEach((r) => ws.addRow(r));
    return roundTrip(wb);
  }

  it("แปลง วัน/ชั่วโมง/นาที เป็นนาที และค่ากะ/ค่ากินเป็นรายได้ที่เสียภาษี ไม่เป็นฐานประกันสังคม", async () => {
    // 15 วัน 7 ชม., OT1.5 = 47 ชม. 30 นาที, OT2.0 = 16 ชม., OT3.0 = 2 ชม. 30 นาที, ค่ากะ 530
    const wb = await build([dataRow("T1", { 1: 15, 2: 7, 24: 47, 25: 30, 27: 16, 33: 2, 34: 30, 19: 530 })]);
    const r = parseTimesheetWorkbook(wb);
    expect(r.issues).toEqual([]);
    expect(r.timesheets[0]).toEqual({
      employee_code: "T1", working_minutes: 15 * 480 + 7 * 60, absence_minutes: 0, leave_unpaid_minutes: 0, late_minutes: 0, early_leave_minutes: 0,
      ot_minutes_1_0: 0, ot_minutes_1_5: 47 * 60 + 30, ot_minutes_2_0: 960, ot_minutes_2_5: 0, ot_minutes_3_0: 150,
    });
    expect(r.adjustments).toEqual([
      { employee_code: "T1", adjustment_type: "earning", item_name: "ค่ากะ", amount: 530, is_taxable: true, is_ss_base: false },
    ]);
    expect(r.timesheetRows).toEqual([3]);
  });

  it("ลาหักเงิน ออกก่อน สาย แยกเก็บ", async () => {
    const r = parseTimesheetWorkbook(await build([dataRow("T1", { 1: 20, 9: 1, 10: 2, 11: 15, 13: 0, 14: 10, 16: 1, 17: 5, 20: 40 })]));
    expect(r.issues).toEqual([]);
    expect(r.timesheets[0]).toMatchObject({ leave_unpaid_minutes: 480 + 120 + 15, late_minutes: 10, early_leave_minutes: 65 });
    expect(r.adjustments?.map((a) => a.item_name)).toEqual(["ค่ากิน"]);
  });

  it("ปฏิเสธเลขทศนิยมในช่องชั่วโมง (เช่น 47.02) และ OT4 ที่ยังไม่รองรับ", async () => {
    const r = parseTimesheetWorkbook(await build([dataRow("T1", { 1: 20, 24: 47.02, 36: 3 })]));
    const msgs = r.issues.map((i) => `${i.row}:${i.message}`).join("\n");
    expect(msgs).toContain("3:OT1.5 (Hr): ต้องเป็นจำนวนเต็ม");
    expect(msgs).toContain("3:OT4");
    expect(r.timesheets).toHaveLength(0);
  });

  it("ข้ามคอลัมน์ Baht และเตือนเมื่อมีค่า, ปฏิเสธรหัสซ้ำ", async () => {
    const r = parseTimesheetWorkbook(await build([dataRow("T1", { 1: 20, 4: 999 }), dataRow("T1", { 1: 20 })]));
    expect(r.warnings.some((w) => w.includes("Baht"))).toBe(true);
    expect(r.issues.some((i) => i.row === 4 && i.message.includes("ซ้ำกับแถว 3"))).toBe(true);
  });

  it("แม่แบบที่ระบบสร้างอ่านกลับได้ และตัวอย่างไม่ถูกนำเข้า", async () => {
    const wt = new ExcelJS.Workbook();
    await wt.xlsx.load((await buildTemplate("timesheets")) as unknown as ArrayBuffer);
    const t = parseTimesheetWorkbook(wt);
    expect(t.timesheets).toHaveLength(0);
    expect(t.issues.map((i) => i.message)).toEqual(["ไม่พบข้อมูลเวลาทำงานในชีต"]);
  });
});

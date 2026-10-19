import ExcelJS from "exceljs";
import { EMPLOYEE_SHEET } from "./employees";
import { ADJUSTMENT_SHEET, TIMESHEET_SHEET } from "./timesheets";

export type TemplateKind = "employees" | "timesheets";

const HEADER_FILL = "FF1565C0";

function styleHeader(ws: ExcelJS.Worksheet, widths: number[], textCols: number[] = []) {
  const row = ws.getRow(1);
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  // คอลัมน์ที่เป็นรหัส/เลขบัญชี ตั้งเป็นข้อความเพื่อไม่ให้เลข 0 นำหน้าหาย
  for (const c of textCols) ws.getColumn(c).numFmt = "@";
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function listValidation(ws: ExcelJS.Worksheet, col: number, options: string[]) {
  for (let r = 2; r <= 1001; r++) {
    ws.getCell(r, col).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${options.join(",")}"`],
      showErrorMessage: true,
      errorTitle: "ค่าไม่ถูกต้อง",
      error: `เลือกจาก: ${options.join(", ")}`,
    };
  }
}

function addNotes(wb: ExcelJS.Workbook, lines: string[]) {
  const ws = wb.addWorksheet("คำอธิบาย");
  ws.getColumn(1).width = 110;
  lines.forEach((l, i) => {
    const c = ws.getCell(i + 1, 1);
    c.value = l;
    c.alignment = { wrapText: true, vertical: "top" };
    if (i === 0) c.font = { bold: true, size: 14 };
  });
}

function employeesTemplate(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(EMPLOYEE_SHEET);
  ws.addRow([
    "รหัสพนักงาน *", "คำนำหน้า", "ชื่อ *", "นามสกุล *", "วันที่เริ่มงาน *", "เลขบัตรประชาชน", "ธนาคาร", "เลขบัญชี",
    "อีเมล", "โทรศัพท์", "ประเภทการจ่าย *", "เงินเดือน/ค่าจ้าง *", "หักประกันสังคม", "วิธีหักภาษี", "เงินเดือนมีผลตั้งแต่",
  ]);
  styleHeader(ws, [16, 12, 18, 18, 16, 20, 12, 18, 24, 14, 16, 18, 14, 18, 18], [1, 6, 8, 10]);
  ws.getColumn(5).numFmt = "dd/mm/yyyy";
  ws.getColumn(15).numFmt = "dd/mm/yyyy";
  ws.getColumn(12).numFmt = "#,##0.00";
  listValidation(ws, 11, ["รายเดือน", "รายวัน", "รายชั่วโมง"]);
  listValidation(ws, 13, ["ใช่", "ไม่ใช่"]);
  listValidation(ws, 14, ["ปกติ", "คำนวณรายเดือน", "ไม่หัก"]);

  const ex = wb.addWorksheet("ตัวอย่าง");
  ex.addRow(ws.getRow(1).values as string[]);
  ex.addRow(["EN00001", "นาย", "สมชาย", "ใจดี", "01/10/2026", "(เลขบัตรจริง 13 หลัก)", "KBANK", "1234567890", "", "", "รายวัน", 400, "ใช่", "ปกติ", ""]);
  ex.addRow(["EN00002", "นางสาว", "สมหญิง", "รักงาน", "16/10/2026", "", "SCB", "9876543210", "", "", "รายเดือน", 18000, "ใช่", "ปกติ", ""]);
  styleHeader(ex, [16, 12, 18, 18, 16, 24, 12, 18, 24, 14, 16, 18, 14, 18, 18]);
  ex.getRow(2).font = { color: { argb: "FF6B7A90" } };
  ex.getRow(3).font = { color: { argb: "FF6B7A90" } };

  addNotes(wb, [
    "แม่แบบนำเข้าพนักงาน",
    "1. กรอกข้อมูลที่ชีต “พนักงาน” แถวละ 1 คน (ดูรูปแบบที่ชีต “ตัวอย่าง” ข้อมูลในชีตตัวอย่างจะไม่ถูกนำเข้า)",
    "2. คอลัมน์ที่มี * ต้องกรอก ส่วนที่เหลือเว้นว่างได้",
    "3. ใช้เพิ่ม “พนักงานใหม่” เท่านั้น รหัสพนักงานที่มีอยู่แล้วในบริษัทจะถูกปฏิเสธ (แก้ข้อมูลคนเดิมที่หน้าพนักงาน)",
    "4. วันที่ใช้ วว/ดด/ปปปป ได้ทั้ง ค.ศ. และ พ.ศ.",
    "5. ประเภทการจ่าย: รายเดือน / รายวัน / รายชั่วโมง  (เงินเดือน/ค่าจ้าง = เงินเดือนต่อเดือน หรือค่าจ้างต่อวัน/ชั่วโมงตามประเภท)",
    "6. หักประกันสังคม: ใช่ / ไม่ใช่ (ไม่กรอก = ใช่)   วิธีหักภาษี: ปกติ / คำนวณรายเดือน / ไม่หัก (ไม่กรอก = ปกติ)",
    "7. เลขบัตรประชาชนต้องถูกต้องตามหลักตรวจสอบ ระบบเก็บแบบเข้ารหัส และแสดงเฉพาะ 4 ตัวท้าย",
    "8. คอลัมน์ รหัสพนักงาน / เลขบัตร / เลขบัญชี / โทรศัพท์ ตั้งเป็นข้อความไว้แล้ว เพื่อไม่ให้เลข 0 นำหน้าหาย",
    "9. ถ้ามีแถวใดผิด ระบบจะไม่นำเข้าเลยแม้แต่แถวเดียว แก้ไขแล้วอัปโหลดใหม่ได้",
  ]);
  return wb;
}

function timesheetsTemplate(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(TIMESHEET_SHEET);
  ws.addRow(["รหัสพนักงาน *", "วันทำงาน", "OT 1.0", "OT 1.5", "OT 2.0", "OT 2.5", "OT 3.0", "สาย (นาที)", "ขาด/ลาไม่รับค่าจ้าง (วัน)"]);
  styleHeader(ws, [16, 12, 10, 10, 10, 10, 10, 12, 22], [1]);

  const wa = wb.addWorksheet(ADJUSTMENT_SHEET);
  wa.addRow(["รหัสพนักงาน *", "ประเภท *", "ชื่อรายการ *", "จำนวนเงิน *", "เสียภาษี", "เป็นฐานประกันสังคม"]);
  styleHeader(wa, [16, 14, 28, 16, 12, 20], [1]);
  wa.getColumn(4).numFmt = "#,##0.00";
  listValidation(wa, 2, ["รายได้", "รายการหัก"]);
  listValidation(wa, 5, ["ใช่", "ไม่ใช่"]);
  listValidation(wa, 6, ["ใช่", "ไม่ใช่"]);

  const ex = wb.addWorksheet("ตัวอย่าง");
  ex.addRow(["ชีต: รายการเพิ่ม-หัก"]);
  ex.addRow(["รหัสพนักงาน", "ประเภท", "ชื่อรายการ", "จำนวนเงิน", "เสียภาษี", "เป็นฐานประกันสังคม"]);
  ex.addRow(["EN00001", "รายได้", "ค่ากะ", 70, "ใช่", "ใช่"]);
  ex.addRow(["EN00001", "รายได้", "ค่าอาหาร", 30, "ใช่", "ไม่ใช่"]);
  ex.addRow(["EN00002", "รายการหัก", "หักค่าชุดพนักงาน", 200, "", ""]);
  ex.getColumn(1).width = 16;
  ex.getColumn(3).width = 28;
  ex.getRow(1).font = { bold: true };
  ex.getRow(2).font = { bold: true };

  addNotes(wb, [
    "แม่แบบนำเข้าเวลาทำงานของงวด",
    "1. ชีต “เวลาทำงาน”: 1 แถวต่อพนักงานต่องวด (วันทำงาน, ชั่วโมง OT แต่ละอัตรา, นาทีที่สาย, วันที่ขาด/ลาไม่รับค่าจ้าง) ช่องที่เว้นว่างถือเป็น 0",
    "2. ชีต “รายการเพิ่ม-หัก” (ไม่บังคับ): ค่ากะ ค่าอาหาร ค่ายานพาหนะ เบี้ยขยัน หรือรายการหักต่าง ๆ คนละหลายแถวได้",
    "   • ประเภท: รายได้ / รายการหัก   • จำนวนเงินต้องมากกว่า 0",
    "   • เสียภาษี และ เป็นฐานประกันสังคม ต้องกำหนดทีละรายการให้ตรงนโยบายของบริษัทและตามที่ผู้ทำบัญชียืนยัน (ไม่กรอก: เสียภาษี = ใช่, ฐานประกันสังคม = ไม่ใช่)",
    "3. นำเข้าซ้ำได้: เวลาทำงานของพนักงานที่อยู่ในไฟล์จะถูกเขียนทับ และถ้าไฟล์มีชีตรายการเพิ่ม-หัก รายการที่นำเข้าไว้ก่อนหน้านี้ของงวดจะถูกแทนที่ทั้งหมด (รายการที่คีย์เองไม่ถูกลบ)",
    "4. นำเข้าได้เฉพาะงวดที่ยังเป็น “ร่าง” หรือ “คำนวณแล้ว” และรหัสพนักงานต้องมีอยู่ในบริษัทของงวดนั้น",
    "5. ถ้ามีแถวใดผิด ระบบจะไม่นำเข้าเลยแม้แต่แถวเดียว แก้ไขแล้วอัปโหลดใหม่ได้",
  ]);
  return wb;
}

export async function buildTemplate(kind: TemplateKind): Promise<Buffer> {
  const wb = kind === "employees" ? employeesTemplate() : timesheetsTemplate();
  return Buffer.from(await wb.xlsx.writeBuffer());
}

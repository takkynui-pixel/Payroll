/**
 * รายงานนำส่งธนาคาร: สร้างไฟล์ text สำหรับโอนเงินเดือนเข้าบัญชีพนักงาน
 * ฟังก์ชันล้วน (ไม่แตะฐานข้อมูล) คำนวณเป็นสตางค์จำนวนเต็มทั้งหมด
 *
 * รูปแบบที่รองรับ (ทั้งสองเป็นรูปแบบกลางของระบบ ไม่ใช่สเปกทางการของธนาคารใดโดยเฉพาะ
 * ก่อนใช้จริงให้เทียบกับคู่มือ bulk payment ของธนาคารที่บริษัทใช้ หรือเพิ่มรูปแบบเฉพาะธนาคารที่ FORMATS):
 *  - csv           : UTF-8 (มี BOM) คั่นด้วยจุลภาค มีบรรทัดหัวคอลัมน์ เปิดด้วย Excel/โหลดเข้า template ของธนาคารได้
 *  - fixed_tis620  : ความยาวคงที่ แถว H/D/T เข้ารหัส TIS-620 (windows-874) ขึ้นบรรทัดแบบ CRLF
 */
import { bankByCode, normalizeBankCode } from "./banks";

export type BankFileFormat = "csv" | "fixed_tis620";

export const FORMAT_LABEL: Record<BankFileFormat, string> = {
  csv: "CSV (UTF-8) — เปิดด้วย Excel ได้",
  fixed_tis620: "Fixed-width (TIS-620) — แถว H / D / T",
};

export interface BankRowInput {
  employeeCode: string;
  employeeName: string;
  bankCode: string | null;
  bankAccountNo: string | null;
  /** เงินได้สุทธิ (บาท) จาก payroll_results.net_salary */
  netSalary: number;
}

export interface BankSource {
  bankCode: string | null;
  accountNo: string | null;
  accountName: string | null;
  customerId: string | null;
}

export interface BankFileInput {
  rows: BankRowInput[];
  source: BankSource;
  /** วันที่โอน YYYY-MM-DD (ใช้ pay_date ของงวด) */
  payDate: string;
  format: BankFileFormat;
  /** ออกเฉพาะธนาคารปลายทางนี้ (รหัส 3 หลัก) ไม่ส่ง = ทุกธนาคาร */
  onlyBank?: string | null;
  /** ข้อความอ้างอิง/หมายเหตุ เช่น ชื่องวด */
  reference?: string;
}

export interface BankLine {
  seq: number;
  employeeCode: string;
  name: string;
  bankCode: string;
  account: string;
  amountSatang: number;
}

export interface BankIssue {
  employeeCode: string;
  employeeName: string;
  reason: string;
}

export interface BankFileResult {
  lines: BankLine[];
  /** รายที่ไม่ถูกใส่ในไฟล์ (ข้อมูลบัญชีไม่ครบ/ไม่ถูกต้อง หรือยอดโอนเป็น 0) */
  skipped: BankIssue[];
  warnings: string[];
  count: number;
  totalSatang: number;
  /** ยอดรวมแยกตามธนาคารปลายทาง (รหัส 3 หลัก) */
  byBank: { bankCode: string; count: number; totalSatang: number }[];
  content: Uint8Array;
  /** ข้อความก่อนเข้ารหัส (ไว้แสดงตัวอย่างบนหน้าจอ) */
  text: string;
}

export const toSatang = (baht: number | string): number => Math.round(Number(baht) * 100);

/** จำนวนเงินสตางค์ -> "1234.56" (ไม่ผ่านทศนิยม float) */
export function satangToDecimal(satang: number): string {
  const s = Math.abs(satang);
  return `${satang < 0 ? "-" : ""}${Math.floor(s / 100)}.${String(s % 100).padStart(2, "0")}`;
}

export function normalizeAccount(no: string | null | undefined): string {
  return (no ?? "").replace(/[\s-]/g, "");
}

/** ลบอักขระควบคุมและตัวคั่นที่ทำให้ไฟล์เพี้ยน */
function clean(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

/** เข้ารหัส TIS-620: อักขระที่ไม่มีใน TIS-620 แทนด้วย "?" และนับไว้ใน unmappable */
export function encodeTis620(text: string): { bytes: Uint8Array; unmappable: number } {
  const out: number[] = [];
  let unmappable = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c >= 0x0e01 && c <= 0x0e3a) out.push(c - 0x0e01 + 0xa1);
    else if (c >= 0x0e3f && c <= 0x0e5b) out.push(c - 0x0e3f + 0xdf);
    else {
      out.push(0x3f);
      unmappable += 1;
    }
  }
  return { bytes: Uint8Array.from(out), unmappable };
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const ymd = (iso: string) => iso.replace(/-/g, "");
const padR = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));
const padNum = (n: number, w: number) => String(n).padStart(w, "0");

/** ตรวจและแยกแถวที่ออกไฟล์ได้ / ออกไม่ได้ */
export function classifyRows(rows: BankRowInput[], onlyBank?: string | null) {
  const lines: Omit<BankLine, "seq">[] = [];
  const skipped: BankIssue[] = [];
  for (const r of rows) {
    const issue = (reason: string) => skipped.push({ employeeCode: r.employeeCode, employeeName: r.employeeName, reason });
    const bank = normalizeBankCode(r.bankCode);
    const account = normalizeAccount(r.bankAccountNo);
    if (onlyBank && bank !== onlyBank) {
      // ไม่ใช่ธนาคารที่เลือก: ถ้าข้อมูลธนาคารเสียก็ยังต้องแจ้ง ไม่เช่นนั้นข้ามเงียบ ๆ
      if (!bank && r.bankCode?.trim()) issue(`ไม่รู้จักธนาคาร "${r.bankCode}"`);
      continue;
    }
    const satang = toSatang(r.netSalary);
    if (!r.bankCode?.trim() && !account) {
      issue("ไม่มีข้อมูลบัญชีธนาคาร");
      continue;
    }
    if (!bank) {
      issue(r.bankCode?.trim() ? `ไม่รู้จักธนาคาร "${r.bankCode}"` : "ไม่ได้ระบุธนาคาร");
      continue;
    }
    if (!/^\d{10,15}$/.test(account)) {
      issue(account ? `เลขบัญชีไม่ถูกต้อง (ต้องเป็นตัวเลข 10-15 หลัก): ${account}` : "ไม่ได้ระบุเลขบัญชี");
      continue;
    }
    if (satang <= 0) {
      issue(satang === 0 ? "เงินได้สุทธิเป็น 0 ไม่ต้องโอน" : "เงินได้สุทธิติดลบ ตรวจรายการหัก");
      continue;
    }
    lines.push({ employeeCode: r.employeeCode, name: clean(r.employeeName), bankCode: bank, account, amountSatang: satang });
  }
  return { lines, skipped };
}

export function buildBankFile(input: BankFileInput): BankFileResult {
  const { source } = input;
  const { lines: raw, skipped } = classifyRows(input.rows, input.onlyBank);
  const lines: BankLine[] = raw.map((l, i) => ({ ...l, seq: i + 1 }));
  const totalSatang = lines.reduce((s, l) => s + l.amountSatang, 0);

  const warnings: string[] = [];
  const srcBank = normalizeBankCode(source.bankCode);
  const srcAccount = normalizeAccount(source.accountNo);
  if (!srcBank || !/^\d{10,15}$/.test(srcAccount)) {
    warnings.push("ยังไม่ได้ตั้งค่าบัญชีต้นทางของบริษัท (ธนาคารและเลขบัญชีที่ตัดเงิน) ช่องนี้ในไฟล์จะว่าง ตั้งค่าได้ที่ บริษัทลูกค้า > ชื่อบริษัท");
  }
  const seen = new Map<string, string>();
  for (const l of lines) {
    const key = `${l.bankCode}|${l.account}`;
    const prev = seen.get(key);
    if (prev) warnings.push(`เลขบัญชีซ้ำกัน: ${prev} และ ${l.employeeCode} (${l.bankCode} ${l.account}) ตรวจว่าไม่ได้กรอกผิด`);
    else seen.set(key, l.employeeCode);
  }
  const names = lines.map((l) => l.name).join("");
  if (input.format === "fixed_tis620" && encodeTis620(names).unmappable > 0) {
    warnings.push("มีอักขระในชื่อที่ TIS-620 ไม่รองรับ (จะถูกแทนด้วย ?) ตรวจชื่อพนักงานก่อนส่งธนาคาร");
  }

  const byBankMap = new Map<string, { count: number; totalSatang: number }>();
  for (const l of lines) {
    const cur = byBankMap.get(l.bankCode) ?? { count: 0, totalSatang: 0 };
    cur.count += 1;
    cur.totalSatang += l.amountSatang;
    byBankMap.set(l.bankCode, cur);
  }
  const byBank = [...byBankMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([bankCode, v]) => ({ bankCode, ...v }));

  let text: string;
  let content: Uint8Array;
  if (input.format === "csv") {
    const header = ["ลำดับ", "รหัสธนาคาร", "ธนาคาร", "เลขที่บัญชี", "ชื่อบัญชี", "จำนวนเงิน", "รหัสพนักงาน", "วันที่โอน", "อ้างอิง"];
    const body = lines.map((l) =>
      [l.seq, l.bankCode, bankByCode(l.bankCode)?.short ?? "", l.account, l.name, satangToDecimal(l.amountSatang), l.employeeCode, input.payDate, clean(input.reference ?? "")]
        .map(csvCell)
        .join(","),
    );
    text = [header.map(csvCell).join(","), ...body].join("\r\n") + "\r\n";
    const enc = new TextEncoder().encode(text);
    content = new Uint8Array(enc.length + 3);
    content.set([0xef, 0xbb, 0xbf]);
    content.set(enc, 3);
  } else {
    // H: ชนิด(1) ลำดับชุด(6) ธนาคารต้นทาง(3) บัญชีต้นทาง(15) รหัสลูกค้า(15) วันที่โอน YYYYMMDD(8) จำนวนราย(6) ยอดรวมสตางค์(15)
    const head =
      "H" + "000001" + padR(srcBank ?? "", 3) + padR(srcAccount, 15) + padR(clean(source.customerId ?? ""), 15) +
      ymd(input.payDate) + padNum(lines.length, 6) + padNum(totalSatang, 15);
    // D: ชนิด(1) ลำดับ(6) ธนาคารปลายทาง(3) บัญชี(15) จำนวนเงินสตางค์(15) ชื่อบัญชี(50) รหัสพนักงาน(20) อ้างอิง(30)
    const detail = lines.map(
      (l) =>
        "D" + padNum(l.seq, 6) + l.bankCode + padR(l.account, 15) + padNum(l.amountSatang, 15) + padR(l.name, 50) +
        padR(l.employeeCode, 20) + padR(clean(input.reference ?? ""), 30),
    );
    // T: ชนิด(1) จำนวนราย(6) ยอดรวมสตางค์(15)
    const trail = "T" + padNum(lines.length, 6) + padNum(totalSatang, 15);
    text = [head, ...detail, trail].join("\r\n") + "\r\n";
    content = encodeTis620(text).bytes;
  }

  return { lines, skipped, warnings, count: lines.length, totalSatang, byBank, content, text };
}

export function bankFileName(opts: { payDate: string; format: BankFileFormat; onlyBank?: string | null }): string {
  const base = `BANK_${ymd(opts.payDate)}${opts.onlyBank ? `_${opts.onlyBank}` : ""}`;
  return `${base}.${opts.format === "csv" ? "csv" : "txt"}`;
}

/**
 * สร้างไฟล์ PDF ภ.ง.ด.1 / ภ.ง.ด.1ก โดยพิมพ์ข้อมูลทับลงบนไฟล์แบบฟอร์มของกรมสรรพากรโดยตรง
 * (lib/tax/pdf/templates/*.pdf) จึงได้หน้าปะหน้าและคำชี้แจงด้านหลังเหมือนต้นฉบับทุกจุด
 * ตำแหน่งช่องทั้งหมดอ่านจากฟอร์มฟิลด์ของไฟล์ต้นฉบับ (หน่วย pt, ต้นทางมุมซ้ายล่าง)
 *
 * ข้อมูลทั้งหมดเป็นสตางค์ (จำนวนเต็ม) แปลงเป็นข้อความเฉพาะตอนพิมพ์
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFArray, PDFDict, PDFDocument, PDFEmbeddedPage, PDFFont, PDFName, PDFPage, rgb } from "pdf-lib";
import type { PndReport } from "@/lib/tax/pnd";
import { ATTACH_LAYOUTS, headerIdCenters, ID_CENTERS, MONEY_COLS } from "./attach-layout";

export type PndKind = "pnd1" | "pnd1k";

export interface PdfCompany {
  name: string;
  tax_id: string | null;
  branch_no: string | null;
  phone: string | null;
  addr_building: string | null;
  addr_moo: string | null;
  addr_soi: string | null;
  addr_road: string | null;
  addr_subdistrict: string | null;
  addr_district: string | null;
  addr_province: string | null;
  addr_postcode: string | null;
  signer_name: string | null;
  signer_position: string | null;
}

export interface PdfLine {
  employeeName: string;
  idCard: string | null;
  address: string | null;
  /** YYYY-MM-DD (เฉพาะ ภ.ง.ด.1) */
  payDate: string | null;
  incomeSatang: number;
  taxSatang: number;
}

export interface BuildPndPdfInput {
  kind: PndKind;
  company: PdfCompany;
  /** ปี ค.ศ. */
  year: number;
  /** 1-12 (เฉพาะ ภ.ง.ด.1) */
  month?: number;
  report: Pick<PndReport, "payeeCount" | "incomeSatang" | "taxSatang">;
  lines: PdfLine[];
  /** ยื่นเพิ่มเติมครั้งที่ */
  additionalNo?: number;
}

type Rect = readonly [number, number, number, number];

interface Layout {
  template: string;
  taxId: Rect;
  branch: Rect;
  name: Rect;
  building: Rect;
  room: Rect;
  floor: Rect;
  village: Rect;
  houseNo: Rect;
  moo: Rect;
  soi: Rect;
  junction: Rect;
  road: Rect;
  subdistrict: Rect;
  district: Rect;
  province: Rect;
  postcode: Rect;
  phone?: Rect;
  year: Rect;
  normal: Rect;
  additional: Rect;
  additionalNo: Rect;
  attachCheck: Rect;
  attachCount: Rect;
  /** ช่องติ๊กเดือน (index 0 = มกราคม) เฉพาะ ภ.ง.ด.1 */
  months?: Rect[];
  /** แถวที่ 1 (ทั่วไป) และ 6 (รวม): จำนวนราย / เงินได้ / ภาษี */
  row1: { count: Rect; income: Rect; tax: Rect };
  row6: { count: Rect; income: Rect; tax: Rect };
  /** แถว 8 รวมยอดภาษีและเงินเพิ่ม เฉพาะ ภ.ง.ด.1 */
  row8Tax?: Rect;
  signName: Rect;
  signPosition: Rect;
}

const MONTH_BOXES_PND1: Rect[] = [
  [338.3, 690.4, 348.2, 702.7],
  [338.5, 666.6, 348.4, 678.9],
  [338.3, 642.5, 348.2, 654.8],
  [395.2, 689.8, 405.1, 702.2],
  [395.5, 666.2, 405.4, 678.5],
  [395.3, 642.5, 405.2, 654.9],
  [453.6, 689.9, 463.5, 702.3],
  [453.8, 666.3, 463.7, 678.6],
  [453.7, 642.2, 463.6, 654.5],
  [508.3, 690.0, 518.2, 702.3],
  [508.1, 666.3, 518.0, 678.7],
  [507.9, 642.3, 517.8, 654.7],
];

const LAYOUTS: Record<PndKind, Layout> = {
  pnd1: {
    template: "pnd1.pdf",
    taxId: [160.3, 733.6, 331.2, 749.4],
    branch: [274.7, 703.1, 333.2, 718.8],
    name: [38.8, 687.6, 333.2, 701.9],
    building: [88.9, 672.3, 152.8, 686.7],
    room: [188.0, 672.3, 207.4, 686.7],
    floor: [224.6, 672.3, 237.3, 686.7],
    village: [264.8, 672.5, 333.2, 686.8],
    houseNo: [58.9, 656.5, 137.2, 670.8],
    moo: [155.3, 655.7, 168.9, 670.1],
    soi: [210.4, 656.4, 275.7, 670.7],
    junction: [293.3, 656.1, 333.0, 670.5],
    road: [56.9, 640.1, 169.7, 654.5],
    subdistrict: [213.9, 640.3, 333.1, 654.6],
    district: [79.9, 624.3, 187.4, 638.6],
    province: [214.9, 624.0, 332.7, 638.4],
    postcode: [89.6, 607.8, 144.5, 623.5],
    phone: [150.4, 608.1, 332.5, 622.4],
    year: [524.7, 715.0, 561.2, 729.3],
    normal: [83.1, 565.0, 96.2, 578.3],
    additional: [179.2, 565.5, 192.3, 578.7],
    additionalNo: [279.6, 566.3, 298.1, 580.6],
    attachCheck: [263.3, 519.7, 276.3, 532.9],
    attachCount: [504.9, 520.9, 532.0, 535.3],
    months: MONTH_BOXES_PND1,
    row1: { count: [319.4, 416.2, 370.7, 429.7], income: [376.0, 416.6, 456.0, 429.3], tax: [463.0, 416.6, 542.9, 429.3] },
    row6: { count: [319.5, 275.8, 370.8, 288.9], income: [376.1, 275.7, 456.1, 289.4], tax: [463.1, 275.7, 543.1, 289.4] },
    row8Tax: [463.2, 239.7, 543.2, 253.4],
    signName: [229.7, 138.6, 380.4, 152.9],
    signPosition: [244.4, 121.7, 383.3, 136.0],
  },
  pnd1k: {
    template: "pnd1k.pdf",
    taxId: [164.8, 716.0, 328.0, 731.9],
    branch: [275.6, 687.4, 330.9, 703.1],
    name: [52.7, 671.9, 331.4, 686.2],
    building: [102.8, 657.0, 160.4, 671.4],
    room: [195.6, 657.0, 213.2, 671.4],
    floor: [230.0, 657.0, 242.7, 671.4],
    village: [269.8, 657.2, 331.4, 671.6],
    houseNo: [73.3, 642.1, 143.0, 656.5],
    moo: [160.7, 641.8, 174.3, 656.2],
    soi: [214.0, 642.0, 281.1, 656.4],
    junction: [299.2, 642.2, 332.1, 656.5],
    road: [71.2, 627.1, 172.9, 641.4],
    subdistrict: [217.1, 627.2, 332.2, 641.6],
    district: [93.3, 611.7, 190.5, 626.1],
    province: [217.6, 612.3, 331.8, 626.7],
    postcode: [103.5, 597.0, 158.4, 611.4],
    year: [509.0, 696.6, 541.9, 710.9],
    normal: [347.3, 633.3, 360.3, 646.6],
    additional: [431.7, 632.9, 444.8, 646.1],
    additionalNo: [524.5, 633.7, 542.5, 648.0],
    attachCheck: [259.2, 495.8, 272.3, 509.1],
    attachCount: [504.0, 497.1, 531.1, 511.4],
    row1: { count: [314.0, 391.5, 365.3, 405.0], income: [372.9, 391.9, 451.1, 404.6], tax: [464.3, 391.9, 541.6, 404.6] },
    row6: { count: [314.1, 255.6, 365.4, 269.1], income: [373.9, 255.5, 451.2, 269.2], tax: [464.0, 255.5, 541.7, 269.2] },
    signName: [222.6, 164.2, 378.1, 178.5],
    signPosition: [236.3, 147.3, 406.7, 161.6],
  },
};

const INK = rgb(0.05, 0.08, 0.2);

/** กลุ่มหลักของเลขประจำตัวผู้เสียภาษี 1-4-5-2-1 */

/** ศูนย์กลางช่องตัวเลข 13 หลักของฟอร์ม ภ.ง.ด.1 (วัดจากต้นฉบับ) ปรับตามสัดส่วนความกว้างของฟิลด์ */
const PND1_ID_CENTERS = [166.6, 183.4, 194.6, 205.9, 217.4, 234.2, 245.5, 256.9, 268.6, 279.8, 296.6, 308.2, 325.0];
const PND1_ID_RECT: Rect = [160.3, 733.6, 331.2, 749.4];

const fileCache = new Map<string, Promise<Uint8Array>>();
function readAsset(rel: string): Promise<Uint8Array> {
  let p = fileCache.get(rel);
  if (!p) {
    p = readFile(path.join(process.cwd(), "lib", "tax", "pdf", rel));
    fileCache.set(rel, p);
  }
  return p;
}

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export const baht = (satang: number) => Math.floor(Math.abs(satang) / 100).toLocaleString("en-US");
export const satangPart = (satang: number) => String(Math.abs(satang) % 100).padStart(2, "0");

const MONTH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function beDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${MONTH_ABBR[Number(m[2]) - 1]} ${Number(m[1]) + 543}` : iso;
}

interface Ctx {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
}

/** ตัดข้อความให้พอดีความกว้าง (ต่อท้ายด้วย … ถ้าเกิน) */
function fitText(font: PDFFont, text: string, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let s = text;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

/** พิมพ์ข้อความชิดซ้ายในฟิลด์ (ลดขนาดตัวอักษรลงได้ถึง minSize ก่อนจะตัดข้อความ) */
function putText(c: Ctx, rect: Rect, value: string | null | undefined, opts: { size?: number; minSize?: number; align?: "left" | "center" | "right"; dy?: number; bold?: boolean } = {}) {
  const text = (value ?? "").trim();
  if (!text) return;
  const font = opts.bold ? c.bold : c.font;
  let size = opts.size ?? 11;
  const minSize = opts.minSize ?? 7.5;
  const maxW = rect[2] - rect[0] - 2;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxW) size -= 0.25;
  const out = fitText(font, text, size, maxW);
  const w = font.widthOfTextAtSize(out, size);
  const x = opts.align === "right" ? rect[2] - 1 - w : opts.align === "center" ? rect[0] + (rect[2] - rect[0] - w) / 2 : rect[0] + 1;
  c.page.drawText(out, { x, y: rect[1] + (opts.dy ?? 3.4), size, font, color: INK });
}

/** พิมพ์ตัวเลขทีละหลักลงช่องที่กำหนดศูนย์กลาง x */
function putDigits(c: Ctx, value: string, centers: number[], y: number, size = 11) {
  const d = value.slice(0, centers.length);
  for (let i = 0; i < d.length; i++) {
    const w = c.font.widthOfTextAtSize(d[i], size);
    c.page.drawText(d[i], { x: centers[i] - w / 2, y, size, font: c.font, color: INK });
  }
}

/** ศูนย์กลางช่อง n ช่องเท่า ๆ กันในช่วง [x0, x1] */
function evenCenters(x0: number, x1: number, n: number): number[] {
  const w = (x1 - x0) / n;
  return Array.from({ length: n }, (_, i) => x0 + w * (i + 0.5));
}

function drawCheck(c: Ctx, rect: Rect) {
  const [x0, y0, x1, y1] = rect;
  const w = x1 - x0;
  const h = y1 - y0;
  const o = { thickness: 1.3, color: INK } as const;
  c.page.drawLine({ start: { x: x0 + w * 0.22, y: y0 + h * 0.5 }, end: { x: x0 + w * 0.42, y: y0 + h * 0.22 }, ...o });
  c.page.drawLine({ start: { x: x0 + w * 0.42, y: y0 + h * 0.22 }, end: { x: x0 + w * 0.82, y: y0 + h * 0.84 }, ...o });
}

/**
 * ช่องเงินแบบ "บาท | สต." ของฟอร์ม: ช่องสตางค์กว้างราว 17pt ชิดขอบขวาของกล่อง
 * ขอบกล่อง = ขอบขวาของฟิลด์ + 1pt (วัดจากต้นฉบับ)
 */
const SATANG_W = 17;
function putMoney(c: Ctx, rect: Rect, satang: number, size = 10.5) {
  const edge = rect[2] + 1;
  const baseline = rect[1] + 3.6;
  const sat = satangPart(satang);
  const sw = c.font.widthOfTextAtSize(sat, size);
  c.page.drawText(sat, { x: edge - SATANG_W / 2 - sw / 2, y: baseline, size, font: c.font, color: INK });
  const b = baht(satang);
  const bw = c.font.widthOfTextAtSize(b, size);
  c.page.drawText(b, { x: edge - SATANG_W - 3 - bw, y: baseline, size, font: c.font, color: INK });
}

function putCount(c: Ctx, rect: Rect, n: number, size = 10.5) {
  const s = String(n);
  const w = c.font.widthOfTextAtSize(s, size);
  c.page.drawText(s, { x: rect[0] + (rect[2] - rect[0] - w) / 2, y: rect[1] + 3.6, size, font: c.font, color: INK });
}

function fillCover(c: Ctx, lay: Layout, input: BuildPndPdfInput, attachPages: number) {
  const { company, kind, year } = input;

  // เลขประจำตัวผู้เสียภาษี 13 หลัก ลงช่อง 1-4-5-2-1
  const taxDigits = digits(company.tax_id);
  const scale = (lay.taxId[2] - lay.taxId[0]) / (PND1_ID_RECT[2] - PND1_ID_RECT[0]);
  const centers = PND1_ID_CENTERS.map((x) => lay.taxId[0] + (x - PND1_ID_RECT[0]) * scale);
  putDigits(c, taxDigits, centers, lay.taxId[1] + 4.2, 11.5);

  putDigits(c, digits(company.branch_no).padStart(company.branch_no ? 5 : 0, "0"), evenCenters(lay.branch[0] + 1.3, lay.branch[2] - 1.5, 5), lay.branch[1] + 4.2, 11);
  putText(c, lay.name, company.name, { size: 12 });

  // ที่อยู่: "อาคาร / เลขที่" ในระบบเป็นช่องเดียว ถ้าเป็นเลขที่บ้าน (ตัวเลข/เครื่องหมาย) ให้ลงช่อง "เลขที่" มิฉะนั้นลงช่อง "อาคาร"
  const bld = (company.addr_building ?? "").trim();
  const isHouseNo = /^[\d\s/\-,]+$/.test(bld);
  if (isHouseNo) putText(c, lay.houseNo, bld);
  else putText(c, lay.building, bld, { size: 10.5 });
  putText(c, lay.moo, company.addr_moo, { align: "center" });
  putText(c, lay.soi, company.addr_soi, { size: 10.5 });
  putText(c, lay.road, company.addr_road);
  putText(c, lay.subdistrict, company.addr_subdistrict);
  putText(c, lay.district, company.addr_district);
  putText(c, lay.province, company.addr_province);
  putDigits(c, digits(company.addr_postcode), evenCenters(lay.postcode[0] + 1.6, lay.postcode[2], 5), lay.postcode[1] + 4.2, 11);
  if (lay.phone && company.phone) putText(c, lay.phone, `โทร. ${company.phone}`, { size: 10.5 });

  // ปีภาษี / เดือน
  const be = String(year + 543);
  const yw = c.font.widthOfTextAtSize(be, 11);
  c.page.drawText(be, { x: lay.year[0] + (lay.year[2] - lay.year[0] - yw) / 2, y: lay.year[1] + 3.6, size: 11, font: c.font, color: INK });
  if (kind === "pnd1" && input.month && lay.months) drawCheck(c, lay.months[input.month - 1]);

  // ยื่นปกติ / เพิ่มเติม
  if (input.additionalNo) {
    drawCheck(c, lay.additional);
    putCount(c, lay.additionalNo, input.additionalNo);
  } else {
    drawCheck(c, lay.normal);
  }

  // ใบแนบ
  drawCheck(c, lay.attachCheck);
  putCount(c, lay.attachCount, attachPages);

  // สรุปรายการที่นำส่ง
  const r = input.report;
  if (r.payeeCount > 0) {
    putCount(c, lay.row1.count, r.payeeCount);
    putMoney(c, lay.row1.income, r.incomeSatang);
    putMoney(c, lay.row1.tax, r.taxSatang);
    putCount(c, lay.row6.count, r.payeeCount);
    putMoney(c, lay.row6.income, r.incomeSatang);
    putMoney(c, lay.row6.tax, r.taxSatang);
    if (lay.row8Tax) putMoney(c, lay.row8Tax, r.taxSatang);
  }

  // ผู้ลงนาม (ลายเซ็นและวันที่ ปล่อยว่างให้เซ็นเอง)
  putText(c, lay.signName, company.signer_name, { size: 11, align: "center" });
  putText(c, lay.signPosition, company.signer_position, { size: 11 });
}

/* ------------------------------ ใบแนบ (แนวนอน) ------------------------------ */

/**
 * ใบแนบใช้ไฟล์แบบทางการของกรมสรรพากร (templates/pnd1_attach.pdf, pnd1k_attach.pdf) พิมพ์ข้อมูลทับตรงช่อง
 * ภ.ง.ด.1 = 8 รายต่อแผ่น (มีวันที่จ่าย)  ภ.ง.ด.1ก = 7 รายต่อแผ่น (มีที่อยู่ผู้มีเงินได้)
 * แผ่นสุดท้ายพิมพ์ยอดรวมของแผ่นนั้น ตามคำแนะนำในแบบ ("นำไปรวมกับใบแนบแผ่นอื่น") ยอดรวมทั้งหมดอยู่ที่ใบปะหน้า
 */
export const ATTACH_ROWS: Record<PndKind, number> = { pnd1: 8, pnd1k: 7 };

/** แยกชื่อกับสกุล: ชื่อ (รวมคำนำหน้า) = คำแรก ส่วนที่เหลือ = สกุล */
export function splitName(full: string): { name: string; surname: string } {
  const t = full.trim().replace(/\s+/g, " ");
  const i = t.indexOf(" ");
  return i < 0 ? { name: t, surname: "" } : { name: t.slice(0, i), surname: t.slice(i + 1) };
}

/** เลขประจำตัว 13 หลัก ใส่ลงกล่องตามกลุ่ม 1-4-5-2-1 ของแบบ (centers = ศูนย์กลางกล่องแต่ละหลัก) */
function putIdDigits(c: Ctx, value: string | null | undefined, rect: Rect, centers: readonly number[], size = 11) {
  putDigits(c, digits(value), [...centers], rect[1] + 3.5, size);
}

/** ช่องเงินแบบ บาท | สต. ตามเส้นแบ่งของแบบ */
function putAttachMoney(c: Ctx, col: { left: number; divider: number; right: number }, y: number, satang: number, size = 10.5, bold = false) {
  const f = bold ? c.bold : c.font;
  const b = baht(satang);
  c.page.drawText(b, { x: col.divider - 3 - f.widthOfTextAtSize(b, size), y, size, font: f, color: INK });
  const sat = satangPart(satang);
  c.page.drawText(sat, { x: (col.divider + col.right) / 2 - f.widthOfTextAtSize(sat, size) / 2, y, size, font: f, color: INK });
}

function attachSheet(
  doc: PDFDocument,
  template: PDFEmbeddedPage,
  fonts: { font: PDFFont; bold: PDFFont },
  input: BuildPndPdfInput,
  pageLines: PdfLine[],
  pageNo: number,
  pageCount: number,
  startIndex: number,
) {
  const lay = ATTACH_LAYOUTS[input.kind];
  const page = doc.addPage([template.width, template.height]);
  page.drawPage(template);
  const c: Ctx = { page, ...fonts };
  const { company } = input;
  const k1 = input.kind === "pnd1";

  // หัวแผ่น
  putIdDigits(c, company.tax_id, lay.taxId, headerIdCenters(lay.taxIdLeft));
  const branch = digits(company.branch_no);
  if (branch) {
    const centers = evenCenters(lay.branch[0] + 1, lay.branch[2] - 1, 5);
    putDigits(c, branch.padStart(5, "0"), centers, lay.branch[1] + 3.5, 11);
  }
  putText(c, lay.pageNo, String(pageNo), { size: 10.5, align: "center" });
  putText(c, lay.pageTotal, String(pageCount), { size: 10.5, align: "center" });
  // ประเภทเงินได้: (1) เงินได้ 40(1) กรณีทั่วไป
  drawCheck(c, lay.typeBoxes[0]);

  lay.rows.forEach((row, r) => {
    const l = pageLines[r];
    if (!l) return;
    putText(c, row.no, String(startIndex + r + 1), { size: 10.5, align: "center" });
    putIdDigits(c, l.idCard, row.id, ID_CENTERS);
    const { name, surname } = splitName(l.employeeName);
    putText(c, row.name, name, { size: 11, minSize: 8 });
    putText(c, row.surname, surname, { size: 11, minSize: 8 });
    if (k1 && row.date && l.payDate) putText(c, row.date, beDate(l.payDate), { size: 10.5, minSize: 8, align: "center" });
    if (!k1 && row.address) putText(c, row.address, l.address, { size: 10, minSize: 7.5 });
    putAttachMoney(c, MONEY_COLS.income, row.income[1] + 3.5, l.incomeSatang);
    putAttachMoney(c, MONEY_COLS.tax, row.tax[1] + 3.5, l.taxSatang);
    // เงื่อนไขการหักภาษี: 1 = หัก ณ ที่จ่าย
    putText(c, row.cond, "1", { size: 10.5, align: "center" });
  });

  const sumIncome = pageLines.reduce((s, l) => s + l.incomeSatang, 0);
  const sumTax = pageLines.reduce((s, l) => s + l.taxSatang, 0);
  putAttachMoney(c, MONEY_COLS.income, lay.totalIncome[1] + 3.5, sumIncome, 10.5, true);
  putAttachMoney(c, MONEY_COLS.tax, lay.totalTax[1] + 3.5, sumTax, 10.5, true);

  putText(c, lay.signName, company.signer_name ? `${company.signer_name}` : null, { size: 10.5, align: "center" });
  putText(c, lay.signPosition, company.signer_position, { size: 10.5 });
}

/** ลบ widget (ช่องกรอก/ปุ่ม) ทุกตัวออกจากทุกหน้า และถอด AcroForm ออกจากไฟล์ */
function stripFormFields(doc: PDFDocument) {
  for (const page of doc.getPages()) {
    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (!annots) continue;
    for (let i = annots.size() - 1; i >= 0; i--) {
      const a = annots.lookupMaybe(i, PDFDict);
      if (a && a.get(PDFName.of("Subtype")) === PDFName.of("Widget")) annots.remove(i);
    }
    if (annots.size() === 0) page.node.delete(PDFName.of("Annots"));
  }
  doc.catalog.delete(PDFName.of("AcroForm"));
}

/* ---------------------------------- main ---------------------------------- */

export async function buildPndPdf(input: BuildPndPdfInput): Promise<Uint8Array> {
  const lay = LAYOUTS[input.kind];
  const rowsPerPage = ATTACH_ROWS[input.kind];

  const doc = await PDFDocument.load(await readAsset(path.join("templates", lay.template)));
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await readAsset("fonts/Sarabun-Regular.ttf"), { subset: true });
  const bold = await doc.embedFont(await readAsset("fonts/Sarabun-Bold.ttf"), { subset: true });

  // เอาช่องกรอกของไฟล์ต้นฉบับ (รวมปุ่ม "ล้างข้อมูล") ออก แล้วพิมพ์ทับตำแหน่งเดิม ผลลัพธ์จึงเป็น PDF แบบพิมพ์ได้ทันที
  stripFormFields(doc);

  // ใบแนบแบบทางการ (แนวนอน) ฝังเป็นหน้าแม่แบบ ใช้ซ้ำทุกแผ่น
  const attachDoc = await PDFDocument.load(await readAsset(path.join("templates", ATTACH_LAYOUTS[input.kind].template)));
  stripFormFields(attachDoc);
  const [attachTemplate] = await doc.embedPdf(attachDoc, [0]);

  const pageChunks: PdfLine[][] = [];
  for (let i = 0; i < input.lines.length; i += rowsPerPage) pageChunks.push(input.lines.slice(i, i + rowsPerPage));
  if (pageChunks.length === 0) pageChunks.push([]);

  const cover = doc.getPage(0);
  fillCover({ page: cover, font, bold }, lay, input, pageChunks.length);

  pageChunks.forEach((chunk, i) => {
    attachSheet(doc, attachTemplate, { font, bold }, input, chunk, i + 1, pageChunks.length, i * rowsPerPage);
  });

  doc.setTitle(input.kind === "pnd1" ? "ภ.ง.ด.1" : "ภ.ง.ด.1ก");
  doc.setProducer("Payroll VTA");
  return doc.save();
}

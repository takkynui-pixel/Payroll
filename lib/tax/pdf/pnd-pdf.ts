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
import { PDFArray, PDFDict, PDFDocument, PDFFont, PDFName, PDFPage, rgb } from "pdf-lib";
import type { PndReport } from "@/lib/tax/pnd";

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
  rowsPerPage?: number;
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
const BLACK = rgb(0, 0, 0);

/** กลุ่มหลักของเลขประจำตัวผู้เสียภาษี 1-4-5-2-1 */
const ID_GROUPS = [1, 4, 5, 2, 1];

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

const A4_W = 841.89;
const A4_H = 595.276;

function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, t = 0.6) {
  c.page.drawLine({ start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, thickness: t, color: BLACK });
}

function box(c: Ctx, x: number, y: number, w: number, h: number, t = 0.6) {
  c.page.drawRectangle({ x, y, width: w, height: h, borderColor: BLACK, borderWidth: t });
}

function text(c: Ctx, s: string, x: number, y: number, size = 10, bold = false) {
  c.page.drawText(s, { x, y, size, font: bold ? c.bold : c.font, color: BLACK });
}

function textR(c: Ctx, s: string, xRight: number, y: number, size = 10, bold = false) {
  const f = bold ? c.bold : c.font;
  c.page.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y, size, font: f, color: BLACK });
}

function textC(c: Ctx, s: string, xCenter: number, y: number, size = 10, bold = false) {
  const f = bold ? c.bold : c.font;
  c.page.drawText(s, { x: xCenter - f.widthOfTextAtSize(s, size) / 2, y, size, font: f, color: BLACK });
}

/** ช่องตัวเลข 13 หลักแบบแบ่งกลุ่ม 1-4-5-2-1 วาดกรอบเอง คืนความกว้างรวม */
function idBoxes(c: Ctx, value: string | null, x: number, y: number, cell: number, h: number, size: number): number {
  const d = digits(value);
  let cx = x;
  let k = 0;
  ID_GROUPS.forEach((g, gi) => {
    if (gi > 0) {
      line(c, cx, y + h / 2, cx + 3, y + h / 2, 0.5);
      cx += 3;
    }
    for (let i = 0; i < g; i++) {
      box(c, cx, y, cell, h, 0.5);
      if (d[k]) textC(c, d[k], cx + cell / 2, y + (h - size * 0.7) / 2, size);
      cx += cell;
      k++;
    }
  });
  return cx - x;
}

function drawCbSmall(c: Ctx, x: number, y: number, checked: boolean) {
  box(c, x, y, 8, 8, 0.6);
  if (checked) drawCheck(c, [x, y, x + 8, y + 8]);
}

function attachSheet(
  doc: PDFDocument,
  fonts: { font: PDFFont; bold: PDFFont },
  input: BuildPndPdfInput,
  pageLines: PdfLine[],
  pageNo: number,
  pageCount: number,
  startIndex: number,
  rowsPerPage: number,
  totals: { page: { income: number; tax: number }; grand?: { income: number; tax: number } },
) {
  const page = doc.addPage([A4_W, A4_H]);
  const c: Ctx = { page, ...fonts };
  const { kind, company } = input;
  const M = 28;
  const right = A4_W - M;
  const k1 = kind === "pnd1";

  // หัวแผ่น
  text(c, `ใบแนบ ${k1 ? "ภ.ง.ด.1" : "ภ.ง.ด.1ก"}`, M, A4_H - 40, 18, true);
  text(c, "เลขประจำตัวผู้เสียภาษีอากร (13 หลัก) ของผู้มีหน้าที่หักภาษี ณ ที่จ่าย", 162, A4_H - 36, 9);
  idBoxes(c, company.tax_id, 432, A4_H - 44, 12, 16, 10);
  text(c, "สาขาที่", 650, A4_H - 36, 9);
  const bd = digits(company.branch_no).padStart(company.branch_no ? 5 : 0, "0");
  for (let i = 0; i < 5; i++) {
    box(c, 686 + i * 12, A4_H - 44, 12, 16, 0.5);
    if (bd[i]) textC(c, bd[i], 686 + i * 12 + 6, A4_H - 44 + 4.5, 10);
  }
  text(c, `แผ่นที่ ${pageNo} ในจำนวน ${pageCount} แผ่น`, right - 120, A4_H - 66, 10);

  // ประเภทเงินได้
  const ty = A4_H - 66;
  text(c, "ประเภทเงินได้", M, ty, 9, true);
  const types = [
    "(1) เงินได้ตามมาตรา 40(1) เงินเดือน ค่าจ้าง ฯลฯ กรณีทั่วไป",
    "(2) มาตรา 40(1) กรณีได้รับอนุมัติจากกรมสรรพากรให้หักอัตราร้อยละ 3",
    "(3) มาตรา 40(1)(2) กรณีนายจ้างจ่ายให้ครั้งเดียวเพราะเหตุออกจากงาน",
    "(4) มาตรา 40(2) กรณีผู้รับเงินได้เป็นผู้อยู่ในประเทศไทย",
    "(5) มาตรา 40(2) กรณีผู้รับเงินได้มิได้เป็นผู้อยู่ในประเทศไทย",
  ];
  types.forEach((t, i) => {
    const yy = ty - i * 11;
    drawCbSmall(c, 100, yy - 1.5, i === 0);
    text(c, t, 112, yy, 8.5);
  });

  // ตาราง
  const top = ty - 5 * 11 - 4;
  const headH = 40;
  const rowH = k1 ? 44 : 52;
  const colW = k1
    ? { no: 26, id: 188, name: 250, date: 66, inc: 82, incS: 26, tax: 62, taxS: 26 }
    : { no: 26, id: 188, name: 316, date: 0, inc: 84, incS: 26, tax: 62, taxS: 26 };
  const cond = right - M - Object.values(colW).reduce((s, v) => s + v, 0);
  const xs: number[] = [];
  let x = M;
  for (const w of [colW.no, colW.id, colW.name, colW.date, colW.inc, colW.incS, colW.tax, colW.taxS, cond]) {
    xs.push(x);
    x += w;
  }
  xs.push(x);
  const bodyTop = top - headH;
  const bodyBottom = bodyTop - rowH * rowsPerPage;
  const totH = 18;
  const tableBottom = bodyBottom - totH * 2;

  box(c, M, tableBottom, right - M, top - tableBottom, 0.9);
  // หัวคอลัมน์
  line(c, M, bodyTop, right, bodyTop, 0.9);
  const heads: [number, number, string, string?][] = [
    [0, 1, "ลำดับ", "ที่"],
    [1, 2, "เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)", "ของผู้มีเงินได้"],
    [2, 3, k1 ? "ชื่อผู้มีเงินได้ (ให้ระบุเป็น นาย นาง นางสาว หรือยศ)" : "ชื่อผู้มีเงินได้ และที่อยู่", k1 ? undefined : "(ให้ระบุเป็น นาย นาง นางสาว หรือยศ)"],
  ];
  heads.forEach(([a, b, l1, l2]) => {
    const cx = (xs[a] + xs[b]) / 2;
    textC(c, l1, cx, top - (l2 ? 16 : 23), 8.5, true);
    if (l2) textC(c, l2, cx, top - 28, 8.5, true);
  });
  let ci = 3;
  if (k1) {
    textC(c, "วัน เดือน ปี", (xs[3] + xs[4]) / 2, top - 16, 8.5, true);
    textC(c, "ที่จ่าย", (xs[3] + xs[4]) / 2, top - 28, 8.5, true);
  }
  ci = 4;
  textC(c, k1 ? "จำนวนเงินที่จ่าย" : "จำนวนเงินได้", (xs[ci] + xs[ci + 2]) / 2, top - 9, 8.5, true);
  textC(c, k1 ? "ในครั้งนี้" : "ทั้งปี", (xs[ci] + xs[ci + 2]) / 2, top - 19, 8.5, true);
  textC(c, "บาท", (xs[ci] + xs[ci + 1]) / 2, top - 34, 8.5, true);
  textC(c, "สต.", (xs[ci + 1] + xs[ci + 2]) / 2, top - 34, 8.5, true);
  textC(c, "ภาษีที่หักและนำส่ง", (xs[6] + xs[8]) / 2, top - 9, 8.5, true);
  textC(c, k1 ? "ในครั้งนี้" : "ทั้งปี", (xs[6] + xs[8]) / 2, top - 19, 8.5, true);
  textC(c, "บาท", (xs[6] + xs[7]) / 2, top - 34, 8.5, true);
  textC(c, "สต.", (xs[7] + xs[8]) / 2, top - 34, 8.5, true);
  textC(c, "เงื่อนไข", (xs[8] + xs[9]) / 2, top - 16, 8.5, true);
  textC(c, "การหักภาษี", (xs[8] + xs[9]) / 2, top - 28, 8.5, true);
  // เส้นแนวตั้ง
  for (let i = 1; i < xs.length - 1; i++) {
    const skip = (!k1 && i === 3) || i === 5 || i === 7;
    const yTop = skip ? top - 24 : top;
    // คอลัมน์ซ้าย (ลำดับ/เลขประจำตัว/ชื่อ/วันที่) หยุดที่ท้ายแถวข้อมูล เพื่อให้ข้อความแถวรวมพาดผ่านได้
    line(c, xs[i], i <= 3 ? bodyBottom : tableBottom, xs[i], yTop, 0.6);
  }
  line(c, xs[4], top - 24, xs[6], top - 24, 0.6);
  line(c, xs[6], top - 24, xs[8], top - 24, 0.6);

  // แถวข้อมูล
  for (let r = 0; r < rowsPerPage; r++) {
    const yBottom = bodyTop - rowH * (r + 1);
    line(c, M, yBottom, right, yBottom, 0.5);
    const l = pageLines[r];
    textC(c, String(startIndex + r + 1), (xs[0] + xs[1]) / 2, yBottom + rowH / 2 - 3, 10);
    if (!l) continue;
    idBoxes(c, l.idCard, xs[1] + 6, yBottom + rowH / 2 - 8, 11.2, 16, 9.5);
    const nameW = xs[3] - xs[2] - 8;
    text(c, fitText(c.font, l.employeeName, 10.5, nameW), xs[2] + 4, yBottom + rowH - 17, 10.5);
    if (!k1) {
      const addr = l.address ? `ที่อยู่ ${l.address}` : "ที่อยู่ -";
      const a1 = fitText(c.font, addr, 8.5, nameW);
      text(c, a1, xs[2] + 4, yBottom + rowH - 30, 8.5);
    }
    if (k1 && l.payDate) textC(c, beDate(l.payDate), (xs[3] + xs[4]) / 2, yBottom + rowH / 2 - 3, 9.5);
    textR(c, baht(l.incomeSatang), xs[5] - 4, yBottom + rowH / 2 - 3, 10.5);
    textC(c, satangPart(l.incomeSatang), (xs[5] + xs[6]) / 2, yBottom + rowH / 2 - 3, 10.5);
    textR(c, baht(l.taxSatang), xs[7] - 4, yBottom + rowH / 2 - 3, 10.5);
    textC(c, satangPart(l.taxSatang), (xs[7] + xs[8]) / 2, yBottom + rowH / 2 - 3, 10.5);
    textC(c, "[ 1 ]", (xs[8] + xs[9]) / 2, yBottom + rowH / 2 - 3, 10);
  }

  // แถวรวม
  const t1 = bodyBottom - totH;
  line(c, M, t1, right, t1, 0.6);
  textR(c, "รวมยอดเงินได้และภาษีที่นำส่งในหน้านี้ (นำไปรวมกับใบต่อ ถ้ามี)", xs[4] - 6, t1 + 5.5, 9, true);
  const money = (rowY: number, v?: { income: number; tax: number }) => {
    if (!v) return;
    textR(c, baht(v.income), xs[5] - 4, rowY, 10.5, true);
    textC(c, satangPart(v.income), (xs[5] + xs[6]) / 2, rowY, 10.5, true);
    textR(c, baht(v.tax), xs[7] - 4, rowY, 10.5, true);
    textC(c, satangPart(v.tax), (xs[7] + xs[8]) / 2, rowY, 10.5, true);
  };
  money(t1 + 5.5, totals.page);
  textR(c, "รวมยอดเงินได้และภาษีที่นำส่ง (นำไปกรอกในแบบแสดงรายการภาษี)", xs[4] - 6, tableBottom + 5.5, 9, true);
  money(tableBottom + 5.5, totals.grand);

  // ท้ายแผ่น: หมายเหตุ + ลายเซ็น
  const fy = tableBottom - 16;
  text(c, "หมายเหตุ", M, fy, 8.5, true);
  text(c, "เงื่อนไขการหักภาษีให้กรอกตามนี้ (1) หัก ณ ที่จ่าย  (2) ออกให้ตลอดไป  (3) ออกให้ครั้งเดียว  (4) อื่น ๆ (ระบุ)", M + 40, fy, 8.5);
  text(c, "(ให้กรอกเลขประจำตัวผู้เสียภาษีอากรของผู้มีเงินได้ให้ครบถ้วน หากไม่มีให้ระบุเลขประจำตัวประชาชน)", M, fy - 11, 8);
  const sx = 560;
  text(c, "ลงชื่อ", sx, fy - 4, 10);
  line(c, sx + 28, fy - 5, sx + 190, fy - 5, 0.4);
  text(c, "ผู้จ่ายเงิน", sx + 194, fy - 4, 10);
  if (company.signer_name) textC(c, `(${company.signer_name})`, sx + 109, fy - 18, 10);
  if (company.signer_position) textC(c, company.signer_position, sx + 109, fy - 31, 10);
  text(c, "ตำแหน่ง", sx - 14, fy - 31, 10);
  text(c, "วันที่ยื่น ........ เดือน ................. พ.ศ. ........", sx - 14, fy - 44, 10);
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
  const rowsPerPage = input.rowsPerPage ?? 6;

  const doc = await PDFDocument.load(await readAsset(path.join("templates", lay.template)));
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await readAsset("fonts/Sarabun-Regular.ttf"), { subset: true });
  const bold = await doc.embedFont(await readAsset("fonts/Sarabun-Bold.ttf"), { subset: true });

  // เอาช่องกรอกของไฟล์ต้นฉบับ (รวมปุ่ม "ล้างข้อมูล") ออก แล้วพิมพ์ทับตำแหน่งเดิม ผลลัพธ์จึงเป็น PDF แบบพิมพ์ได้ทันที
  stripFormFields(doc);

  const pageChunks: PdfLine[][] = [];
  for (let i = 0; i < input.lines.length; i += rowsPerPage) pageChunks.push(input.lines.slice(i, i + rowsPerPage));
  if (pageChunks.length === 0) pageChunks.push([]);

  const cover = doc.getPage(0);
  fillCover({ page: cover, font, bold }, lay, input, pageChunks.length);

  pageChunks.forEach((chunk, i) => {
    attachSheet(
      doc,
      { font, bold },
      input,
      chunk,
      i + 1,
      pageChunks.length,
      i * rowsPerPage,
      rowsPerPage,
      {
        page: {
          income: chunk.reduce((s, l) => s + l.incomeSatang, 0),
          tax: chunk.reduce((s, l) => s + l.taxSatang, 0),
        },
        grand: i === pageChunks.length - 1 ? { income: input.report.incomeSatang, tax: input.report.taxSatang } : undefined,
      },
    );
  });

  doc.setTitle(input.kind === "pnd1" ? "ภ.ง.ด.1" : "ภ.ง.ด.1ก");
  doc.setProducer("Payroll VTA");
  return doc.save();
}

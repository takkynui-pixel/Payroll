import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { ATTACH_LAYOUTS, ID_CENTERS } from "@/lib/tax/pdf/attach-layout";
import { baht, beDate, buildPndPdf, satangPart, splitName, type PdfCompany, type PdfLine } from "@/lib/tax/pdf/pnd-pdf";

const company: PdfCompany = {
  name: "บริษัท ตัวอย่าง จำกัด",
  tax_id: "0105512345678",
  branch_no: "00000",
  phone: "02-123-4567",
  addr_building: "99/9",
  addr_moo: "5",
  addr_soi: "สุขุมวิท 21",
  addr_road: "สุขุมวิท",
  addr_subdistrict: "คลองเตยเหนือ",
  addr_district: "วัฒนา",
  addr_province: "กรุงเทพมหานคร",
  addr_postcode: "10110",
  signer_name: "นายสมชาย ใจดี",
  signer_position: "กรรมการผู้จัดการ",
};

const mk = (i: number): PdfLine => ({
  employeeName: `นายทดสอบ ${i}`,
  idCard: "1234567890123",
  address: "1 ถนนตัวอย่าง",
  payDate: "2026-10-25",
  incomeSatang: 1_000_000 + i,
  taxSatang: 10_000 + i,
});

describe("buildPndPdf", () => {
  it("ภ.ง.ด.1: ปะหน้า + คำชี้แจง + ใบแนบแบบทางการแนวนอน 8 รายต่อแผ่น และไม่เหลือช่องกรอกของต้นฉบับ", async () => {
    const lines = Array.from({ length: 9 }, (_, i) => mk(i));
    const report = { payeeCount: 9, incomeSatang: lines.reduce((s, l) => s + l.incomeSatang, 0), taxSatang: lines.reduce((s, l) => s + l.taxSatang, 0) };
    const bytes = await buildPndPdf({ kind: "pnd1", company, year: 2026, month: 10, report, lines });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(4); // 2 หน้าต้นฉบับ + ใบแนบ 2 แผ่น
    expect(doc.getPage(0).getSize().width).toBeCloseTo(595.28, 0);
    expect(doc.getPage(2).getSize().width).toBeGreaterThan(doc.getPage(2).getSize().height);
    expect(doc.getForm().getFields()).toHaveLength(0);
  });

  it("ภ.ง.ด.1ก: ไม่มีข้อมูลก็ยังสร้างไฟล์ได้ (ใบแนบว่าง 1 แผ่น)", async () => {
    const bytes = await buildPndPdf({ kind: "pnd1k", company, year: 2026, report: { payeeCount: 0, incomeSatang: 0, taxSatang: 0 }, lines: [] });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
  });

  it("จัดรูปแบบเงินและวันที่", () => {
    expect(baht(123456789)).toBe("1,234,567");
    expect(satangPart(123456789)).toBe("89");
    expect(satangPart(5)).toBe("05");
    expect(beDate("2026-10-25")).toBe("25 ต.ค. 2569");
  });
});

describe("ใบแนบแบบทางการ", () => {
  it("splitName แยกชื่อ (รวมคำนำหน้า) กับสกุล", () => {
    expect(splitName("นายสมชาย ใจดี")).toEqual({ name: "นายสมชาย", surname: "ใจดี" });
    expect(splitName("นางสาวสมหญิง  รักดี  ศรีสุข")).toEqual({ name: "นางสาวสมหญิง", surname: "รักดี ศรีสุข" });
    expect(splitName("สมชาย")).toEqual({ name: "สมชาย", surname: "" });
  });

  it("ภ.ง.ด.1: 8 รายพอดี = 1 แผ่น, 9 ราย = 2 แผ่น / ภ.ง.ด.1ก: 7 รายพอดี = 1 แผ่น, 8 ราย = 2 แผ่น", async () => {
    const run = async (kind: "pnd1" | "pnd1k", n: number) => {
      const lines = Array.from({ length: n }, (_, i) => mk(i));
      const report = { payeeCount: n, incomeSatang: lines.reduce((s, l) => s + l.incomeSatang, 0), taxSatang: lines.reduce((s, l) => s + l.taxSatang, 0) };
      const doc = await PDFDocument.load(await buildPndPdf({ kind, company, year: 2026, month: 10, report, lines }));
      return doc.getPageCount() - (kind === "pnd1" ? 2 : 1); // หน้าต้นฉบับ: ภ.ง.ด.1 = 2, ภ.ง.ด.1ก = 1 ... ตรวจจากจำนวนแผ่นใบแนบ
    };
    const base1 = await run("pnd1", 8);
    expect(await run("pnd1", 9)).toBe(base1 + 1);
    const base1k = await run("pnd1k", 7);
    expect(await run("pnd1k", 8)).toBe(base1k + 1);
  });

  it("ตำแหน่งช่องในแบบอยู่ในหน้า A4 แนวนอนและเรียงจากบนลงล่าง", () => {
    for (const lay of Object.values(ATTACH_LAYOUTS)) {
      let prevY = Infinity;
      for (const r of lay.rows) {
        expect(r.id[0]).toBeGreaterThan(0);
        expect(r.cond[2]).toBeLessThanOrEqual(841.89);
        expect(r.id[1]).toBeLessThan(prevY);
        prevY = r.id[1];
      }
      expect(lay.totalIncome[1]).toBeLessThan(prevY);
    }
    expect(ATTACH_LAYOUTS.pnd1.rows).toHaveLength(8);
    expect(ATTACH_LAYOUTS.pnd1k.rows).toHaveLength(7);
    expect(ID_CENTERS).toHaveLength(13);
  });
});

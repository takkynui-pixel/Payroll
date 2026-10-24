import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { baht, beDate, buildPndPdf, satangPart, type PdfCompany, type PdfLine } from "@/lib/tax/pdf/pnd-pdf";

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
  it("ภ.ง.ด.1: ปะหน้า + คำชี้แจง + ใบแนบแนวนอน 1 แผ่นต่อ 6 ราย และไม่เหลือช่องกรอกของต้นฉบับ", async () => {
    const lines = Array.from({ length: 7 }, (_, i) => mk(i));
    const report = { payeeCount: 7, incomeSatang: lines.reduce((s, l) => s + l.incomeSatang, 0), taxSatang: lines.reduce((s, l) => s + l.taxSatang, 0) };
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

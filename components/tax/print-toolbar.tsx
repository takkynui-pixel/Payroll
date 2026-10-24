"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

/** แถบปุ่มบนหน้าตัวอย่างก่อนพิมพ์ (ซ่อนตอนพิมพ์) ใช้ "บันทึกเป็น PDF" ในหน้าต่างพิมพ์ของเบราว์เซอร์ */
export function PrintToolbar({ backHref, title, pdfHref }: { backHref: string; title: string; pdfHref?: string }) {
  return (
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-deep">{title}</h1>
        <p className="text-sm text-muted">
          {pdfHref
            ? "ดาวน์โหลด PDF ที่พิมพ์ข้อมูลทับบนแบบฟอร์มของกรมสรรพากร (หน้าปะหน้า + คำชี้แจง + ใบแนบ) พร้อมพิมพ์ยื่นได้ทันที (ด้านล่างคือไฟล์เดียวกัน)"
            : "กด “พิมพ์ / บันทึกเป็น PDF” แล้วเลือกปลายทาง “บันทึกเป็น PDF” ตั้งค่ากระดาษ A4 และปิดส่วนหัว/ท้ายกระดาษ"}
        </p>
      </div>
      <div className="flex gap-2">
        <Link href={backHref} className={buttonClass({ variant: "secondary" })}>
          กลับ
        </Link>
        {pdfHref ? (
          <a href={pdfHref} className={buttonClass({ variant: "dark" })}>
            ดาวน์โหลด PDF (แบบสรรพากร)
          </a>
        ) : null}
        {pdfHref ? null : (
          <button type="button" onClick={() => window.print()} className={buttonClass({ variant: "dark" })}>
            พิมพ์ / บันทึกเป็น PDF
          </button>
        )}
      </div>
    </div>
  );
}

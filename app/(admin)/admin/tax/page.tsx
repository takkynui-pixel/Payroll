import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, inputClass } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ภ.ง.ด.1 / 1ก / กท.20 ก" };

const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/** วันนี้ตามเวลากรุงเทพ (ปี ค.ศ./เดือน) */
function bangkokNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return { year: Number(parts.find((p) => p.type === "year")?.value), month: Number(parts.find((p) => p.type === "month")?.value) };
}

export default async function TaxPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const now = bangkokNow();
  const year = Number(sp.year) || now.year;
  const month = Number(sp.month) || now.month;
  const all = sp.all !== "0";

  const supabase = await createClient();
  const { data: companies, error } = await supabase.from("companies").select("id,name").is("deleted_at", null).order("name");
  const company = sp.company ?? companies?.[0]?.id ?? "";

  const q = new URLSearchParams({ company, year: String(year) });
  const monthly = new URLSearchParams(q);
  monthly.set("month", String(month));
  if (all) monthly.set("all", "1");

  return (
    <>
      <PageHeader
        title="ภ.ง.ด.1 / ภ.ง.ด.1ก / กท.20 ก"
        description="ออกแบบยื่นภาษีเงินได้หัก ณ ที่จ่ายจากผลคำนวณที่อนุมัติหรือปิดงวดแล้ว พิมพ์หรือบันทึกเป็น PDF ได้จากหน้าตัวอย่าง"
      />
      <FormError message={error?.message} />
      <Card title="เลือกบริษัทและช่วงเวลา" className="mb-6 max-w-3xl">
        <form method="get" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Field label="บริษัท (ผู้จ่ายเงิน)" htmlFor="t-company">
              <select id="t-company" name="company" defaultValue={company} className={inputClass}>
                {(companies ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="ปี (พ.ศ.)" htmlFor="t-year">
            <select id="t-year" name="year" defaultValue={String(year)} className={inputClass}>
              {Array.from({ length: 6 }, (_, i) => now.year - 4 + i).map((y) => (
                <option key={y} value={y}>
                  {y + 543}
                </option>
              ))}
            </select>
          </Field>
          <Field label="เดือน (สำหรับ ภ.ง.ด.1)" htmlFor="t-month">
            <select id="t-month" name="month" defaultValue={String(month)} className={inputClass}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-ink">
            <input type="hidden" name="all" value="0" />
            <input type="checkbox" name="all" value="1" defaultChecked={all} className="size-4" />
            รวมพนักงานที่ภาษี 0
          </label>
          <div className="sm:col-span-3">
            <button type="submit" className={buttonClass({ variant: "secondary" })}>
              อัปเดตตัวเลือก
            </button>
          </div>
        </form>
      </Card>

      <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title="ภ.ง.ด.1 (รายเดือน)">
          <p className="mb-4 text-sm text-muted">
            รายการภาษีหัก ณ ที่จ่ายของเดือน {MONTHS[month - 1]} {year + 543} ตามวันที่จ่ายเงินของแต่ละงวด
            {all ? " รวมพนักงานที่ไม่ถูกหักภาษี (ตามแบบที่ยื่นจริงในไฟล์ตัวอย่าง)" : " เฉพาะพนักงานที่ถูกหักภาษีในเดือนนั้น"}
          </p>
          <Link href={`/admin/tax/pnd1?${monthly.toString()}`} className={buttonClass({ variant: "dark" })}>
            เปิดตัวอย่างและพิมพ์
          </Link>
        </Card>
        <Card title="ภ.ง.ด.1ก (รายปี)">
          <p className="mb-4 text-sm text-muted">
            สรุปเงินได้และภาษีของพนักงานทุกคนทั้งปี {year + 543} รวมคนที่ไม่ถึงเกณฑ์เสียภาษี ยื่นภายในเดือนกุมภาพันธ์ {year + 544}
          </p>
          <Link href={`/admin/tax/pnd1k?${q.toString()}`} className={buttonClass({ variant: "dark" })}>
            เปิดตัวอย่างและพิมพ์
          </Link>
        </Card>
        <Card title="กท.20 ก (กองทุนเงินทดแทน)">
          <p className="mb-4 text-sm text-muted">
            แบบคำนวณค่าจ้างประจำปี {year + 543} แยกรายเดือน เงินเดือน ค่าจ้างรายวัน ค่าล่วงเวลา และส่วนที่เกิน 20,000 บาท/เดือน/คน ยื่นภายในเดือนมกราคม {year + 544}
          </p>
          <Link href={`/admin/tax/wcf20k?${q.toString()}`} className={buttonClass({ variant: "dark" })}>
            เปิดตัวอย่างและพิมพ์
          </Link>
        </Card>
      </div>
      <p className="mt-4 max-w-3xl text-xs text-muted">
        หมายเหตุ: การเปิดแบบ ภ.ง.ด.1/1ก จะถอดรหัสเลขบัตรประชาชนของพนักงานที่อยู่ในรายงาน และฐานข้อมูลบันทึกทุกครั้งใน audit log
        ตัวเลขเงินได้ใช้ “รายได้รวม” ของแต่ละงวด ก่อนตรวจกับนักบัญชีว่าตรงกับการแสดงรายการของบริษัทก่อนยื่นจริง
      </p>
    </>
  );
}

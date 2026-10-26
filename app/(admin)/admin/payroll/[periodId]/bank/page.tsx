import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FormError, inputClass } from "@/components/ui/field";
import { tableClass, tableWrap, tdClass, thClass, trClass } from "@/components/ui/table-styles";
import { BANKS, bankByCode } from "@/lib/bank/banks";
import { prepareBankFile } from "@/lib/bank/prepare";
import { FORMAT_LABEL, satangToDecimal } from "@/lib/bank/transfer";
import { formatBaht, formatDateTh, maskAccount } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "รายงานนำส่งธนาคาร" };

export default async function BankReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ periodId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const id = z.uuid().safeParse((await params).periodId);
  if (!id.success) notFound();
  const sp = await searchParams;

  const supabase = await createClient();
  const p = await prepareBankFile(supabase, id.data, sp);
  const back = (
    <Link href={`/admin/payroll/${id.data}`} className={buttonClass({ variant: "secondary" })}>
      กลับไปรายละเอียดงวด
    </Link>
  );
  if ("error" in p) {
    if (p.status === 404) notFound();
    return (
      <>
        <PageHeader title="รายงานนำส่งธนาคาร" action={back} />
        <FormError message={p.error} />
      </>
    );
  }

  const { result, company } = p;
  const q = new URLSearchParams({ format: p.format });
  if (p.onlyBank) q.set("bank", p.onlyBank);
  const total = satangToDecimal(result.totalSatang);

  return (
    <>
      <PageHeader
        title="รายงานนำส่งธนาคาร"
        description={`${company.name} · ${p.period.period_name} · วันที่โอน ${formatDateTh(p.period.pay_date)}`}
        action={back}
      />
      <div className="space-y-6">
        <Card title="ตัวเลือกไฟล์" className="max-w-3xl">
          <form method="get" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="รูปแบบไฟล์" htmlFor="b-format">
              <select id="b-format" name="format" defaultValue={p.format} className={inputClass}>
                {Object.entries(FORMAT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ธนาคารปลายทาง" htmlFor="b-bank" hint="ธนาคารบางแห่งแยกไฟล์ในธนาคารเดียวกัน / ต่างธนาคาร">
              <select id="b-bank" name="bank" defaultValue={p.onlyBank ?? ""} className={inputClass}>
                <option value="">ทุกธนาคาร</option>
                {BANKS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.short} · {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <button type="submit" className={buttonClass({ variant: "secondary" })}>
                อัปเดตตัวอย่าง
              </button>
            </div>
          </form>
        </Card>

        {result.warnings.length > 0 ? (
          <ul role="alert" className="max-w-3xl list-disc space-y-1 rounded-md border border-amber-300 bg-amber-50 py-3 pl-8 pr-4 text-sm text-ink">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}

        <section aria-labelledby="bank-sum" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="bank-sum" className="font-semibold text-ink">
              รายการโอน {result.count.toLocaleString("th-TH")} ราย · รวม {formatBaht(total)} บาท
            </h2>
            {result.count > 0 ? (
              <a href={`/admin/payroll/${id.data}/bank/file?${q.toString()}`} className={buttonClass({ variant: "dark" })}>
                ดาวน์โหลดไฟล์ {p.format === "csv" ? ".csv" : ".txt"}
              </a>
            ) : null}
          </div>
          {result.byBank.length > 0 ? (
            <p className="text-sm text-muted">
              แยกตามธนาคาร:{" "}
              {result.byBank.map((b) => `${bankByCode(b.bankCode)?.short ?? b.bankCode} ${b.count} ราย ${formatBaht(satangToDecimal(b.totalSatang))}`).join(" · ")}
            </p>
          ) : null}
          <div className={tableWrap}>
            <table className={tableClass}>
              <caption className="sr-only">รายการโอนเงินเดือน</caption>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>รหัส</th>
                  <th scope="col" className={thClass}>ชื่อบัญชี</th>
                  <th scope="col" className={thClass}>ธนาคาร</th>
                  <th scope="col" className={thClass}>เลขบัญชี</th>
                  <th scope="col" className={`${thClass} text-right`}>จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map((l) => (
                  <tr key={l.seq} className={trClass}>
                    <td className={tdClass}>{l.employeeCode}</td>
                    <td className={tdClass}>{l.name}</td>
                    <td className={tdClass}>{bankByCode(l.bankCode)?.short ?? l.bankCode}</td>
                    <td className={tdClass}>{maskAccount(l.account)}</td>
                    <td className={`${tdClass} num`}>{formatBaht(satangToDecimal(l.amountSatang))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {result.skipped.length > 0 ? (
          <section aria-labelledby="bank-skip" className="space-y-3">
            <h2 id="bank-skip" className="font-semibold text-danger">
              ไม่ถูกใส่ในไฟล์ {result.skipped.length} ราย — แก้ข้อมูลที่หน้าพนักงานแล้วคำนวณงวดใหม่
            </h2>
            <div className={tableWrap}>
              <table className={tableClass}>
                <caption className="sr-only">รายชื่อที่ออกไฟล์ไม่ได้</caption>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>รหัส</th>
                    <th scope="col" className={thClass}>ชื่อ</th>
                    <th scope="col" className={thClass}>สาเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {result.skipped.map((s) => (
                    <tr key={s.employeeCode} className={trClass}>
                      <td className={tdClass}>{s.employeeCode}</td>
                      <td className={tdClass}>{s.employeeName}</td>
                      <td className={tdClass}>{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <p className="max-w-3xl text-xs text-muted">
          เลขบัญชีในตารางนี้ถูกซ่อนบางส่วน ไฟล์ที่ดาวน์โหลดมีเลขบัญชีเต็ม และทุกการดาวน์โหลดถูกบันทึกใน audit log
          ไฟล์เป็นรูปแบบกลางของระบบ ก่อนส่งธนาคารจริงให้เทียบกับรูปแบบที่ธนาคารกำหนด (ดูรายละเอียดใน README)
        </p>
      </div>
    </>
  );
}

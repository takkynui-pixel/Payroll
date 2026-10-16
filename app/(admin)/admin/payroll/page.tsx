import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { tableClass, tableWrap, tdClass, thClass, trClass } from "@/components/ui/table-styles";
import { formatDateRangeTh, formatDateTh } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "งวดเงินเดือน" };

export default async function PayrollListPage() {
  const supabase = await createClient();
  const [{ data: companies }, { data, error }] = await Promise.all([
    supabase.from("companies").select("id,name"),
    supabase
      .from("payroll_periods")
      .select("id,company_id,period_name,start_date,end_date,pay_date,status")
      .order("pay_date", { ascending: false })
      .limit(100),
  ]);

  const nameOf = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const periods = data ?? [];

  return (
    <>
      <PageHeader
        title="งวดเงินเดือน"
        description="แสดง 100 งวดล่าสุด เรียงตามวันจ่ายเงิน"
        action={
          <Link href="/admin/payroll/new" className={buttonClass()}>
            สร้างงวดเงินเดือน
          </Link>
        }
      />
      <FormError message={error?.message} />
      {periods.length === 0 ? (
        <EmptyState title="ยังไม่มีงวดเงินเดือน">สร้างงวดแรกเพื่อเริ่มคำนวณเงินเดือน</EmptyState>
      ) : (
        <div className={tableWrap}>
          <table className={tableClass}>
            <caption className="sr-only">งวดเงินเดือนทั้งหมด</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>
                  งวด
                </th>
                <th scope="col" className={thClass}>
                  บริษัท
                </th>
                <th scope="col" className={thClass}>
                  ช่วงเวลาทำงาน
                </th>
                <th scope="col" className={thClass}>
                  วันจ่ายเงิน
                </th>
                <th scope="col" className={thClass}>
                  สถานะ
                </th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className={trClass}>
                  <td className={tdClass}>
                    <Link href={`/admin/payroll/${p.id}`} className="font-medium text-brand hover:underline">
                      {p.period_name}
                    </Link>
                  </td>
                  <td className={tdClass}>{nameOf.get(p.company_id) ?? "-"}</td>
                  <td className={`${tdClass} text-muted`}>{formatDateRangeTh(p.start_date, p.end_date)}</td>
                  <td className={tdClass}>{formatDateTh(p.pay_date)}</td>
                  <td className={tdClass}>
                    <StatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

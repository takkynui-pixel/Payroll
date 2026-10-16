import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";
import { FormError } from "@/components/ui/field";
import { tableClass, tableWrap, tdClass, thClass, thNumClass, trClass } from "@/components/ui/table-styles";
import { formatBaht, formatDateTh } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "สลิปเงินเดือน" };

export default async function PayslipsPage() {
  const supabase = await createClient();
  // RLS ให้เห็นเฉพาะผลของตัวเอง และเฉพาะงวดที่อนุมัติ/ปิดแล้ว
  const { data, error } = await supabase
    .from("payroll_results")
    .select("id,payroll_period_id,net_salary")
    .order("calculated_at", { ascending: false })
    .limit(60);
  const results = data ?? [];

  const ids = [...new Set(results.map((r) => r.payroll_period_id))];
  const { data: periods } =
    ids.length === 0
      ? { data: [] }
      : await supabase.from("payroll_periods").select("id,period_name,pay_date").in("id", ids);
  const periodOf = new Map((periods ?? []).map((p) => [p.id, p]));

  const rows = results
    .map((r) => ({ ...r, period: periodOf.get(r.payroll_period_id) }))
    .sort((a, b) => (b.period?.pay_date ?? "").localeCompare(a.period?.pay_date ?? ""));

  return (
    <>
      <PageHeader title="สลิปเงินเดือน" description="แสดงสลิปของงวดที่ลูกค้าอนุมัติแล้วเท่านั้น" />
      <FormError message={error?.message} />
      {rows.length === 0 ? (
        <EmptyState title="ยังไม่มีสลิปเงินเดือน">เมื่องวดเงินเดือนได้รับการอนุมัติ สลิปจะแสดงที่นี่</EmptyState>
      ) : (
        <div className={tableWrap}>
          <table className={tableClass}>
            <caption className="sr-only">สลิปเงินเดือนของคุณ</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>
                  งวด
                </th>
                <th scope="col" className={thClass}>
                  วันจ่ายเงิน
                </th>
                <th scope="col" className={thNumClass}>
                  เงินสุทธิ
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={trClass}>
                  <td className={tdClass}>
                    <Link href={`/payslips/${r.id}`} className="font-medium text-brand hover:underline">
                      {r.period?.period_name ?? "งวดเงินเดือน"}
                    </Link>
                  </td>
                  <td className={tdClass}>{formatDateTh(r.period?.pay_date)}</td>
                  <td className="num px-3 py-2 font-semibold">{formatBaht(r.net_salary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { tableClass, tableWrap, tdClass, thClass, trClass } from "@/components/ui/table-styles";
import { formatDateTh } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ภาพรวม" };

export default async function AdminHome() {
  const supabase = await createClient();

  const [companies, employees, openPeriods] = await Promise.all([
    supabase.from("companies").select("id,name").is("deleted_at", null).order("name"),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("employment_status", "active"),
    supabase
      .from("payroll_periods")
      .select("id,company_id,period_name,status,pay_date")
      .in("status", ["draft", "calculated", "client_reviewing", "approved"])
      .order("pay_date", { ascending: true })
      .limit(30),
  ]);

  const error = companies.error ?? employees.error ?? openPeriods.error;
  const nameOf = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const periods = openPeriods.data ?? [];

  const stats = [
    { label: "บริษัทลูกค้า", value: (companies.data?.length ?? 0).toLocaleString("th-TH") },
    { label: "พนักงานที่ทำงานอยู่", value: (employees.count ?? 0).toLocaleString("th-TH") },
    { label: "งวดที่ยังไม่ปิด", value: periods.length.toLocaleString("th-TH") },
  ];

  return (
    <>
      <PageHeader
        title="ภาพรวม"
        description="งวดเงินเดือนที่ยังดำเนินการไม่เสร็จ เรียงตามวันจ่ายเงินที่ใกล้ที่สุดก่อน"
        action={
          <Link href="/admin/payroll/new" className={buttonClass()}>
            สร้างงวดเงินเดือน
          </Link>
        }
      />

      <FormError message={error?.message} />

      <dl className="mb-8 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="num mt-0.5 !text-left text-2xl font-semibold text-navy">{s.value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mb-3 font-semibold text-navy">งวดที่ต้องติดตาม</h2>
      {periods.length === 0 ? (
        <EmptyState
          title="ยังไม่มีงวดที่ค้างอยู่"
          action={
            <Link href="/admin/payroll/new" className={buttonClass({ variant: "secondary" })}>
              สร้างงวดเงินเดือน
            </Link>
          }
        >
          เมื่อสร้างงวดเงินเดือน งวดที่ยังไม่ปิดจะแสดงที่นี่
        </EmptyState>
      ) : (
        <div className={tableWrap}>
          <table className={tableClass}>
            <caption className="sr-only">งวดเงินเดือนที่ยังไม่ปิด</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>
                  งวด
                </th>
                <th scope="col" className={thClass}>
                  บริษัท
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

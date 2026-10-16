import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page-header";
import { FormError } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { tableClass, tableWrap, tdClass, thClass, trClass } from "@/components/ui/table-styles";
import { formatDateRangeTh, formatDateTh } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "งวดเงินเดือน" };

export default async function ClientHome() {
  const supabase = await createClient();
  // ลูกค้าเห็นเฉพาะงวดที่ส่งมาให้ตรวจสอบแล้ว (งวดร่าง/ที่ทีม payroll ยังคำนวณอยู่ไม่แสดง)
  const { data, error } = await supabase
    .from("payroll_periods")
    .select("id,period_name,start_date,end_date,pay_date,status")
    .in("status", ["client_reviewing", "approved", "closed"])
    .order("pay_date", { ascending: false })
    .limit(100);

  const periods = data ?? [];
  const waiting = periods.filter((p) => p.status === "client_reviewing");

  return (
    <>
      <PageHeader
        title="งวดเงินเดือน"
        description={
          waiting.length > 0
            ? `มี ${waiting.length.toLocaleString("th-TH")} งวดรอให้คุณตรวจสอบและอนุมัติ`
            : "งวดที่ทีม Payroll ส่งมาให้ตรวจสอบจะแสดงที่นี่"
        }
      />
      <FormError message={error?.message} />
      {periods.length === 0 ? (
        <EmptyState title="ยังไม่มีงวดที่ส่งมาให้ตรวจสอบ">เมื่อทีม Payroll ส่งงวดให้ตรวจสอบ จะแสดงในรายการนี้</EmptyState>
      ) : (
        <div className={tableWrap}>
          <table className={tableClass}>
            <caption className="sr-only">งวดเงินเดือนของบริษัท</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>
                  งวด
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
                    <Link href={`/client/${p.id}`} className="font-medium text-brand hover:underline">
                      {p.period_name}
                    </Link>
                  </td>
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

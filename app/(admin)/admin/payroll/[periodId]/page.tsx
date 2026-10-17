import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { CalculatePanel } from "@/components/calculate-panel";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ResultsTable } from "@/components/results-table";
import { StatusPanel } from "@/components/status-panel";
import { TotalsStrip } from "@/components/totals-strip";
import { buttonClass } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { tableClass, tableWrap, tdClass, thClass, trClass } from "@/components/ui/table-styles";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { APPROVAL_ACTION, formatDateRangeTh, formatDateTh, formatDateTimeTh } from "@/lib/format";
import { totalsOf } from "@/lib/results";
import { createClient } from "@/lib/supabase/server";
import { isEditable, staffActions, staffHint } from "@/lib/workflow";

export const metadata: Metadata = { title: "รายละเอียดงวด" };

export default async function PeriodDetailPage({ params }: { params: Promise<{ periodId: string }> }) {
  const parsed = z.uuid().safeParse((await params).periodId);
  if (!parsed.success) notFound();
  const periodId = parsed.data;

  const supabase = await createClient();
  const { data: period, error: periodError } = await supabase
    .from("payroll_periods")
    .select("*")
    .eq("id", periodId)
    .maybeSingle();
  if (periodError) return <FormError message={periodError.message} />;
  if (!period) notFound();

  const [company, results, approvals, sheets, adjustments] = await Promise.all([
    supabase.from("companies").select("name").eq("id", period.company_id).maybeSingle(),
    supabase
      .from("payroll_results")
      .select("id,employee_code,employee_name,total_earnings,social_security_amount,tax_amount,other_deductions,net_salary")
      .eq("payroll_period_id", periodId)
      .order("employee_code")
      .limit(2000),
    supabase
      .from("payroll_period_approvals")
      .select("id,action,from_status,to_status,note,acted_at")
      .eq("payroll_period_id", periodId)
      .order("acted_at", { ascending: false })
      .limit(50),
    supabase.from("employee_timesheets").select("id", { count: "exact", head: true }).eq("payroll_period_id", periodId),
    supabase.from("payroll_adjustments").select("id", { count: "exact", head: true }).eq("payroll_period_id", periodId),
  ]);

  const rows = results.data ?? [];
  const history = approvals.data ?? [];
  const loadError = results.error ?? approvals.error;
  const editable = isEditable(period.status);

  return (
    <>
      <PageHeader
        title={period.period_name}
        description={`${company.data?.name ?? "-"} · ${formatDateRangeTh(period.start_date, period.end_date)} · จ่ายเงิน ${formatDateTh(period.pay_date)}`}
        action={
          <Link href="/admin/payroll" className={buttonClass({ variant: "secondary" })}>
            กลับไปรายการงวด
          </Link>
        }
      />
      <FormError message={loadError?.message} />

      <div className="space-y-6">
        <section aria-label="สถานะงวด" className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={period.status} />
            <p className="text-sm text-muted">{staffHint(period.status)}</p>
          </div>
          <WorkflowStepper status={period.status} />
        </section>

        {editable ? (
          <>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:max-w-md">
              <div className="bg-surface px-4 py-3">
                <dt className="text-xs text-muted">แถวเวลาทำงานในงวดนี้</dt>
                <dd className="num mt-0.5 !text-left text-lg font-medium">{(sheets.count ?? 0).toLocaleString("th-TH")}</dd>
              </div>
              <div className="bg-surface px-4 py-3">
                <dt className="text-xs text-muted">รายการเพิ่ม/หักของงวด</dt>
                <dd className="num mt-0.5 !text-left text-lg font-medium">{(adjustments.count ?? 0).toLocaleString("th-TH")}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/admin/import?period=${periodId}`} className={buttonClass({ variant: "secondary" })}>
                นำเข้าเวลาทำงานจาก Excel
              </Link>
              <p className="max-w-2xl text-sm text-muted">
                พนักงานรายเดือนที่ไม่มีแถวเวลาทำงานจะคิดเต็มงวดไม่มี OT ส่วนรายวัน/รายชั่วโมงที่ไม่มีแถวจะได้ค่าจ้างฐาน 0 ระบบแจ้งเป็นคำเตือนตอนคำนวณ
              </p>
            </div>
            <CalculatePanel periodId={periodId} hasResults={rows.length > 0} />
          </>
        ) : null}

        <StatusPanel periodId={periodId} actions={staffActions(period.status)} />

        <section aria-labelledby="results-title" className="space-y-3">
          <h2 id="results-title" className="font-semibold text-navy">
            ผลคำนวณ
          </h2>
          {rows.length === 0 ? (
            <EmptyState title="ยังไม่มีผลคำนวณ">กดคำนวณเงินเดือนเมื่อข้อมูลของงวดนี้พร้อมแล้ว</EmptyState>
          ) : (
            <>
              <TotalsStrip totals={totalsOf(rows)} />
              <ResultsTable rows={rows} totals={totalsOf(rows)} />
            </>
          )}
        </section>

        <section aria-labelledby="history-title" className="space-y-3">
          <h2 id="history-title" className="font-semibold text-navy">
            ประวัติการดำเนินการ
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted">ยังไม่มีประวัติ</p>
          ) : (
            <div className={tableWrap}>
              <table className={tableClass}>
                <caption className="sr-only">ประวัติการเปลี่ยนสถานะของงวด</caption>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>
                      เวลา
                    </th>
                    <th scope="col" className={thClass}>
                      การดำเนินการ
                    </th>
                    <th scope="col" className={thClass}>
                      หมายเหตุ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className={trClass}>
                      <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatDateTimeTh(h.acted_at)}</td>
                      <td className={tdClass}>{APPROVAL_ACTION[h.action] ?? h.action}</td>
                      <td className={tdClass}>{h.note ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

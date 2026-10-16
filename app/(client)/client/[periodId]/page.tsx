import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ResultsTable } from "@/components/results-table";
import { StatusPanel } from "@/components/status-panel";
import { TotalsStrip } from "@/components/totals-strip";
import { buttonClass } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { formatDateRangeTh, formatDateTh } from "@/lib/format";
import { totalsOf } from "@/lib/results";
import { createClient } from "@/lib/supabase/server";
import { clientActions } from "@/lib/workflow";

export const metadata: Metadata = { title: "ตรวจสอบงวดเงินเดือน" };

const HINT: Record<string, string> = {
  client_reviewing: "ตรวจสอบรายชื่อและยอดเงินด้านล่าง ถ้าถูกต้องให้อนุมัติ ถ้ามีรายการต้องแก้ให้ส่งกลับพร้อมระบุเหตุผล",
  approved: "คุณอนุมัติงวดนี้แล้ว ทีม Payroll จะดำเนินการจ่ายเงินและออกสลิปต่อ",
  closed: "งวดนี้ปิดแล้ว",
};

export default async function ClientPeriodPage({ params }: { params: Promise<{ periodId: string }> }) {
  const parsed = z.uuid().safeParse((await params).periodId);
  if (!parsed.success) notFound();
  const periodId = parsed.data;

  const supabase = await createClient();
  const { data: period, error: periodError } = await supabase
    .from("payroll_periods")
    .select("*")
    .eq("id", periodId)
    .in("status", ["client_reviewing", "approved", "closed"])
    .maybeSingle();
  if (periodError) return <FormError message={periodError.message} />;
  if (!period) notFound();

  const { data, error } = await supabase
    .from("payroll_results")
    .select("id,employee_code,employee_name,total_earnings,social_security_amount,tax_amount,other_deductions,net_salary")
    .eq("payroll_period_id", periodId)
    .order("employee_code")
    .limit(2000);
  const rows = data ?? [];

  return (
    <>
      <PageHeader
        title={period.period_name}
        description={`${formatDateRangeTh(period.start_date, period.end_date)} · จ่ายเงิน ${formatDateTh(period.pay_date)}`}
        action={
          <Link href="/client" className={buttonClass({ variant: "secondary" })}>
            กลับไปรายการงวด
          </Link>
        }
      />
      <FormError message={error?.message} />

      <div className="space-y-6">
        <section aria-label="สถานะงวด" className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={period.status} />
            <p className="text-sm text-muted">{HINT[period.status] ?? ""}</p>
          </div>
          <WorkflowStepper status={period.status} />
        </section>

        <StatusPanel periodId={periodId} actions={clientActions(period.status)} />

        <section aria-labelledby="results-title" className="space-y-3">
          <h2 id="results-title" className="font-semibold text-navy">
            รายการเงินเดือน
          </h2>
          {rows.length === 0 ? (
            <EmptyState title="ไม่พบรายการเงินเดือนในงวดนี้" />
          ) : (
            <>
              <TotalsStrip totals={totalsOf(rows)} />
              <ResultsTable rows={rows} totals={totalsOf(rows)} />
            </>
          )}
        </section>
      </div>
    </>
  );
}

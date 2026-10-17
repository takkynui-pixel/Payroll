import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { buttonClass } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { formatBaht, formatDateRangeTh, formatDateTh, maskAccount } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "สลิปเงินเดือน" };

interface Line {
  id: string;
  item_name: string;
  amount: number;
}

function Section({ title, lines, total, totalLabel }: { title: string; lines: Line[]; total: number; totalLabel: string }) {
  return (
    <section className="rounded-xl border border-line/60 bg-surface shadow-card">
      <h2 className="border-b border-line px-4 py-2.5 font-semibold text-navy">{title}</h2>
      <dl className="divide-y divide-line/70">
        {lines.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">ไม่มีรายการ</p>
        ) : (
          lines.map((l) => (
            <div key={l.id} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
              <dt>{l.item_name}</dt>
              <dd className="num">{formatBaht(l.amount)}</dd>
            </div>
          ))
        )}
        <div className="flex items-baseline justify-between gap-4 bg-mist px-4 py-2.5 text-sm font-medium">
          <dt>{totalLabel}</dt>
          <dd className="num">{formatBaht(total)}</dd>
        </div>
      </dl>
    </section>
  );
}

export default async function PayslipDetailPage({ params }: { params: Promise<{ resultId: string }> }) {
  const parsed = z.uuid().safeParse((await params).resultId);
  if (!parsed.success) notFound();
  const resultId = parsed.data;

  const supabase = await createClient();
  const { data: result, error } = await supabase.from("payroll_results").select("*").eq("id", resultId).maybeSingle();
  if (error) return <FormError message={error.message} />;
  if (!result) notFound();

  const [{ data: period }, { data: items, error: itemsError }] = await Promise.all([
    supabase
      .from("payroll_periods")
      .select("period_name,start_date,end_date,pay_date")
      .eq("id", result.payroll_period_id)
      .maybeSingle(),
    supabase
      .from("payroll_result_items")
      .select("id,item_type,item_name,amount,sort_order")
      .eq("payroll_result_id", resultId)
      .order("sort_order"),
  ]);

  const earnings = (items ?? []).filter((i) => i.item_type === "earning");
  const deductions = (items ?? []).filter((i) => i.item_type === "deduction");
  const sum = (lines: Line[]) => lines.reduce((acc, l) => acc + Math.round(Number(l.amount) * 100), 0) / 100;

  return (
    <>
      <PageHeader
        title={period?.period_name ?? "สลิปเงินเดือน"}
        description={period ? `${formatDateRangeTh(period.start_date, period.end_date)} · จ่ายเงิน ${formatDateTh(period.pay_date)}` : undefined}
        action={
          <div className="no-print flex gap-2">
            <Link href="/payslips" className={buttonClass({ variant: "secondary" })}>
              กลับ
            </Link>
            <PrintButton />
          </div>
        }
      />
      <FormError message={itemsError?.message} />

      <div className="max-w-2xl space-y-4">
        <div className="rounded-xl border border-line/60 bg-surface shadow-card px-4 py-3 text-sm">
          <p className="font-medium">
            {result.employee_code} · {result.employee_name}
          </p>
          <p className="text-muted">
            บัญชีรับเงิน {result.bank_code ? `${result.bank_code} ` : ""}
            {maskAccount(result.bank_account_no)}
          </p>
        </div>

        <Section title="รายได้" lines={earnings} total={sum(earnings)} totalLabel="รวมรายได้" />
        <Section title="รายการหัก" lines={deductions} total={sum(deductions)} totalLabel="รวมรายการหัก" />

        <div className="flex items-baseline justify-between rounded-md border border-brand bg-surface px-4 py-3">
          <span className="font-semibold text-navy">เงินได้สุทธิ</span>
          <span className="num text-2xl font-semibold text-brand">{formatBaht(result.net_salary)}</span>
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { HalfDonut, TrendChart } from "@/components/charts";
import { Money } from "@/components/money";
import { NavIcon } from "@/components/nav-icons";
import { EmptyState, PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTh } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ภาพรวม" };

const OPEN = ["draft", "calculated", "client_reviewing", "approved"];
const round2 = (n: number) => Math.round(n * 100) / 100;

interface Totals {
  earnings: number;
  deductions: number;
  net: number;
}

export default async function AdminHome() {
  const supabase = await createClient();

  const [companies, recent] = await Promise.all([
    supabase.from("companies").select("id,name").is("deleted_at", null),
    supabase
      .from("payroll_periods")
      .select("id,company_id,period_name,status,pay_date")
      .order("pay_date", { ascending: false })
      .limit(12),
  ]);
  const periods = recent.data ?? [];
  const ids = periods.map((p) => p.id);
  const results = ids.length
    ? await supabase
        .from("payroll_results")
        .select("payroll_period_id,total_earnings,social_security_amount,tax_amount,other_deductions,net_salary")
        .in("payroll_period_id", ids)
    : { data: [], error: null };

  const error = companies.error ?? recent.error ?? results.error;
  const nameOf = new Map((companies.data ?? []).map((c) => [c.id, c.name]));

  const totals = new Map<string, Totals>();
  for (const r of results.data ?? []) {
    const t = totals.get(r.payroll_period_id) ?? { earnings: 0, deductions: 0, net: 0 };
    t.earnings = round2(t.earnings + Number(r.total_earnings));
    t.deductions = round2(
      t.deductions + Number(r.social_security_amount) + Number(r.tax_amount) + Number(r.other_deductions),
    );
    t.net = round2(t.net + Number(r.net_salary));
    totals.set(r.payroll_period_id, t);
  }

  const withData = periods.filter((p) => totals.has(p.id)); // เรียงใหม่ -> เก่า
  const latest = withData[0];
  const previous = withData[1];
  const latestT = latest ? totals.get(latest.id) : undefined;
  const delta =
    latestT && previous && totals.get(previous.id)!.net > 0
      ? ((latestT.net - totals.get(previous.id)!.net) / totals.get(previous.id)!.net) * 100
      : null;
  const trend = [...withData].reverse().map((p) => ({ label: p.period_name, value: totals.get(p.id)!.net }));

  const lastDone = periods.find((p) => p.status === "closed");
  const upcoming = [...periods]
    .filter((p) => OPEN.includes(p.status))
    .sort((a, b) => a.pay_date.localeCompare(b.pay_date))[0];
  const upcomingT = upcoming ? totals.get(upcoming.id) : undefined;
  const lastDoneT = lastDone ? totals.get(lastDone.id) : undefined;
  const pct = latestT && latestT.earnings > 0 ? Math.round((latestT.net / latestT.earnings) * 100) : 0;

  return (
    <>
      <PageHeader
        title="ภาพรวม"
        action={
          <Link href="/admin/payroll/new" className={buttonClass({ variant: "dark" })}>
            สร้างงวดเงินเดือน
            <span aria-hidden className="grid size-6 place-items-center rounded-full bg-white text-ink">
              <NavIcon name="plus" className="size-4" />
            </span>
          </Link>
        }
      />
      <FormError message={error?.message} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid min-w-0 gap-4 lg:col-span-2">
          <Card title="ยอดจ่ายสุทธิงวดล่าสุด">
            {latestT ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Money value={latestT.net} className="text-3xl font-semibold tracking-tight text-ink" decimalClassName="text-muted/60" />
                {delta != null ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                      delta >= 0 ? "bg-[#e0f5ea] text-ok" : "bg-[#fde8e6] text-danger"
                    }`}
                  >
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)}% <span className="font-normal text-muted">เทียบงวดก่อน</span>
                  </span>
                ) : null}
              </div>
            ) : null}
            <TrendChart data={trend} />
          </Card>

          <Card
            title="งวดล่าสุด"
            action={
              <Link href="/admin/payroll" className="text-sm text-accent hover:underline">
                ดูทั้งหมด
              </Link>
            }
          >
            {periods.length === 0 ? (
              <EmptyState title="ยังไม่มีงวดเงินเดือน">เมื่อสร้างงวดเงินเดือน รายการจะแสดงที่นี่</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {periods.slice(0, 5).map((p) => {
                  const name = nameOf.get(p.company_id) ?? "-";
                  const t = totals.get(p.id);
                  return (
                    <li key={p.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 py-3 sm:grid-cols-[auto_1.4fr_1fr_1fr_auto]">
                      <span aria-hidden className="grid size-10 place-items-center rounded-full bg-[#e6f0ff] font-semibold text-accent">
                        {name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{name}</p>
                        <p className="truncate text-xs text-muted">{p.period_name}</p>
                      </div>
                      <div className="hidden text-sm sm:block">
                        <p className="text-ink">{formatDateTh(p.pay_date)}</p>
                        <p className="text-xs text-muted">วันจ่ายเงิน</p>
                      </div>
                      <div className="hidden sm:block">{t ? <Money value={t.net} className="text-sm font-semibold text-ink" /> : <span className="text-sm text-muted">ยังไม่คำนวณ</span>}</div>
                      <Link href={`/admin/payroll/${p.id}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
                        เปิด
                      </Link>
                      <div className="col-span-3 flex items-center justify-between gap-2 sm:hidden">
                        <StatusBadge status={p.status} />
                        {t ? <Money value={t.net} className="text-sm font-semibold text-ink" /> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <Card
            title="สรุปเงินเดือน"
            action={
              latest ? (
                <Link href={`/admin/payroll/${latest.id}`} className="text-sm text-accent hover:underline">
                  ดูรายงาน
                </Link>
              ) : null
            }
          >
            <p className="mb-4 text-sm text-muted">{latest ? `${latest.period_name} · ${nameOf.get(latest.company_id) ?? ""}` : "ยังไม่มีผลคำนวณ"}</p>
            <dl className="mb-4 grid grid-cols-3 gap-3">
              {[
                { l: "รายได้รวม", v: latestT?.earnings ?? 0, c: "border-accent" },
                { l: "รายการหัก", v: latestT?.deductions ?? 0, c: "border-brand-deep" },
                { l: "จ่ายสุทธิ", v: latestT?.net ?? 0, c: "border-sky" },
              ].map((x) => (
                <div key={x.l} className={`min-w-0 border-l-2 pl-2 ${x.c}`}>
                  <dt className="truncate text-xs text-muted">{x.l}</dt>
                  <dd className="mt-0.5 break-words text-sm font-semibold text-ink">
                    <Money value={x.v} decimalClassName="text-muted/60" />
                  </dd>
                </div>
              ))}
            </dl>
            <HalfDonut
              legend={false}
              center={`${pct}%`}
              centerLabel="จ่ายสุทธิต่อรายได้"
              slices={[
                { label: "จ่ายสุทธิ", value: latestT?.net ?? 0, color: "#1565c0" },
                { label: "รายการหัก", value: latestT?.deductions ?? 0, color: "#084a94" },
              ]}
            />
          </Card>

          <Card className="!p-5">
            <div className="flex items-center justify-between gap-2 text-sm text-muted">
              <span className="flex items-center gap-2">
                <NavIcon name="wallet" className="size-5 text-accent" />
                งวดที่ปิดล่าสุด
              </span>
              <span>{lastDone ? formatDateTh(lastDone.pay_date) : "-"}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {lastDoneT ? <Money value={lastDoneT.net} className="text-2xl font-semibold text-ink" /> : <span className="text-muted">-</span>}
              {lastDone ? <StatusBadge status={lastDone.status} /> : null}
            </div>
          </Card>

          <Card className="!p-5">
            <div className="flex items-center justify-between gap-2 text-sm text-muted">
              <span className="flex items-center gap-2">
                <NavIcon name="calendar" className="size-5 text-accent" />
                งวดถัดไป
              </span>
              <span className="text-accent">{upcoming ? formatDateTh(upcoming.pay_date) : "-"}</span>
            </div>
            {upcoming ? (
              <>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {upcomingT ? <Money value={upcomingT.net} className="text-2xl font-semibold text-ink" /> : <span className="text-sm text-muted">ยังไม่คำนวณ</span>}
                  <StatusBadge status={upcoming.status} />
                </div>
                <div className="mt-4 rounded-xl border border-line p-3">
                  <p className="text-xs text-muted">บริษัทลูกค้า</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e6f0ff] font-semibold text-accent">
                        {(nameOf.get(upcoming.company_id) ?? "-").charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{nameOf.get(upcoming.company_id) ?? "-"}</p>
                        <p className="truncate text-xs text-muted">{upcoming.period_name}</p>
                      </div>
                    </div>
                    <Link href={`/admin/payroll/${upcoming.id}`} className={buttonClass({ variant: "dark", size: "sm" })}>
                      เปิดงวด
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">ไม่มีงวดที่ค้างอยู่</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

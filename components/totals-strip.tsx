import { formatBaht } from "@/lib/format";
import type { ResultTotals } from "@/lib/results";

/** สรุปยอดรวมของงวด เส้นคั่นระหว่างช่องเป็นช่องว่างบาง ๆ สีเส้น ไม่ใช้เงา */
export function TotalsStrip({ totals }: { totals: ResultTotals }) {
  const cells = [
    { label: "จำนวนพนักงาน", value: `${totals.headcount.toLocaleString("th-TH")} คน` },
    { label: "รายได้รวม", value: formatBaht(totals.earnings) },
    { label: "ประกันสังคม", value: formatBaht(totals.socialSecurity) },
    { label: "ภาษีหัก ณ ที่จ่าย", value: formatBaht(totals.tax) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-5">
      {cells.map((c) => (
        <div key={c.label} className="bg-surface px-4 py-3">
          <dt className="text-xs text-muted">{c.label}</dt>
          <dd className="num mt-0.5 !text-left text-base font-medium">{c.value}</dd>
        </div>
      ))}
      <div className="col-span-2 bg-surface px-4 py-3 sm:col-span-1">
        <dt className="text-xs text-muted">เงินเดือนสุทธิรวม</dt>
        <dd className="num mt-0.5 !text-left text-xl font-semibold text-brand">{formatBaht(totals.net)}</dd>
      </div>
    </dl>
  );
}

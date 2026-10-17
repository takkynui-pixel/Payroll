import { StatCard } from "@/components/stat-card";
import { formatBaht } from "@/lib/format";
import type { ResultTotals } from "@/lib/results";

/** สรุปยอดรวมของงวดเป็นการ์ดแยกช่อง ยอดสุทธิเน้นด้วยสีหลัก */
export function TotalsStrip({ totals }: { totals: ResultTotals }) {
  return (
    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard label="จำนวนพนักงาน" value={`${totals.headcount.toLocaleString("th-TH")} คน`} tone="sky" />
      <StatCard label="รายได้รวม" value={formatBaht(totals.earnings)} tone="blue" />
      <StatCard label="ประกันสังคม" value={formatBaht(totals.socialSecurity)} tone="amber" />
      <StatCard label="ภาษีหัก ณ ที่จ่าย" value={formatBaht(totals.tax)} tone="amber" />
      <div className="col-span-2 lg:col-span-1">
        <StatCard label="เงินเดือนสุทธิรวม" value={formatBaht(totals.net)} tone="green" large />
      </div>
    </dl>
  );
}

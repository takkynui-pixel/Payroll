import { formatBaht } from "@/lib/format";
import type { ResultRow, ResultTotals } from "@/lib/results";

const th = "border-b border-line px-3 py-2 text-xs font-medium text-muted";

export function ResultsTable({ rows, totals }: { rows: ResultRow[]; totals: ResultTotals }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">ผลคำนวณเงินเดือนรายพนักงาน</caption>
        <thead>
          <tr>
            <th scope="col" className={`${th} text-left`}>
              รหัส
            </th>
            <th scope="col" className={`${th} text-left`}>
              ชื่อ-สกุล
            </th>
            <th scope="col" className={`${th} text-right`}>
              รายได้รวม
            </th>
            <th scope="col" className={`${th} text-right`}>
              ประกันสังคม
            </th>
            <th scope="col" className={`${th} text-right`}>
              ภาษี
            </th>
            <th scope="col" className={`${th} text-right`}>
              หักอื่น ๆ
            </th>
            <th scope="col" className={`${th} text-right`}>
              สุทธิ
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line/70 hover:bg-soft/60">
              <td className="px-3 py-2 text-muted">{r.employee_code}</td>
              <td className="px-3 py-2">{r.employee_name}</td>
              <td className="num px-3 py-2">{formatBaht(r.total_earnings)}</td>
              <td className="num px-3 py-2">{formatBaht(r.social_security_amount)}</td>
              <td className="num px-3 py-2">{formatBaht(r.tax_amount)}</td>
              <td className="num px-3 py-2">{formatBaht(r.other_deductions)}</td>
              <td className="num px-3 py-2 font-semibold">{formatBaht(r.net_salary)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-mist font-medium">
            <th scope="row" colSpan={2} className="px-3 py-2.5 text-left">
              รวม {totals.headcount.toLocaleString("th-TH")} คน
            </th>
            <td className="num px-3 py-2.5">{formatBaht(totals.earnings)}</td>
            <td className="num px-3 py-2.5">{formatBaht(totals.socialSecurity)}</td>
            <td className="num px-3 py-2.5">{formatBaht(totals.tax)}</td>
            <td className="num px-3 py-2.5">{formatBaht(totals.otherDeductions)}</td>
            <td className="num px-3 py-2.5 text-brand">{formatBaht(totals.net)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

import Link from "next/link";
import { FormError } from "@/components/ui/field";
import { PrintToolbar } from "@/components/tax/print-toolbar";
import { AttachSheet, CoverPnd1, CoverPnd1k, Warnings } from "@/components/tax/rd-forms";
import { preparePnd, ROWS_PER_PAGE } from "@/lib/tax/pnd-prepare";
import { createClient } from "@/lib/supabase/server";

/** หน้าตัวอย่างก่อนพิมพ์ของ ภ.ง.ด.1 (รายเดือน) และ ภ.ง.ด.1ก (รายปี) */
export async function PndDocument({ kind, params }: { kind: "pnd1" | "pnd1k"; params: Record<string, string | string[] | undefined> }) {
  const back = "/admin/tax";
  const supabase = await createClient();
  const prep = await preparePnd(supabase, kind, params);
  if ("error" in prep) {
    return (
      <>
        <FormError message={prep.error} />
        <Link href={back} className="text-brand underline">
          กลับไปหน้าเลือก
        </Link>
      </>
    );
  }
  const { company, year, month, additionalNo: add, report, pages, warnings } = prep;
  const qs = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : Array.isArray(v) && v[0] ? [[k, v[0]]] : [])));

  const title = kind === "pnd1" ? "ภ.ง.ด.1 (รายเดือน)" : "ภ.ง.ด.1ก (รายปี)";
  const sums = pages.map((p) => ({
    income: p.reduce((s, l) => s + l.incomeSatang, 0),
    tax: p.reduce((s, l) => s + l.taxSatang, 0),
  }));

  return (
    <>
      <PrintToolbar backHref={back} title={title} pdfHref={`/admin/tax/pdf/${kind}?${qs.toString()}`} />
      <Warnings items={warnings} />
      <div className="overflow-x-auto pb-4 print:overflow-visible">
        {kind === "pnd1" ? (
          <CoverPnd1 company={company} year={year} month={month!} report={report} attachPages={pages.length} additionalNo={add} />
        ) : (
          <CoverPnd1k company={company} year={year} report={report} attachPages={pages.length} additionalNo={add} />
        )}
        {pages.map((pageLines, i) => (
          <AttachSheet
            key={i}
            kind={kind}
            company={company}
            lines={pageLines}
            pageNo={i + 1}
            pageCount={pages.length}
            rowsPerPage={ROWS_PER_PAGE}
            startIndex={i * ROWS_PER_PAGE}
            pageTotal={sums[i]}
            grandTotal={i === pages.length - 1 ? { income: report.incomeSatang, tax: report.taxSatang } : undefined}
          />
        ))}
      </div>
    </>
  );
}

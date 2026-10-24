import Link from "next/link";
import { FormError } from "@/components/ui/field";
import { PrintToolbar } from "@/components/tax/print-toolbar";
import { Warnings } from "@/components/tax/rd-forms";
import { preparePnd } from "@/lib/tax/pnd-prepare";
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
  const { warnings } = prep;
  const qs = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : Array.isArray(v) && v[0] ? [[k, v[0]]] : [])));

  const title = kind === "pnd1" ? "ภ.ง.ด.1 (รายเดือน)" : "ภ.ง.ด.1ก (รายปี)";
  const pdfUrl = `/admin/tax/pdf/${kind}?${qs.toString()}`;

  return (
    <>
      <PrintToolbar backHref={back} title={title} pdfHref={pdfUrl} />
      <Warnings items={warnings} />
      <iframe
        title={title}
        src={`${pdfUrl}&inline=1`}
        className="h-[85vh] w-full rounded-2xl border border-line bg-white"
      />
    </>
  );
}

import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildPndPdf } from "@/lib/tax/pdf/pnd-pdf";
import { preparePnd } from "@/lib/tax/pnd-prepare";

/** ดาวน์โหลด ภ.ง.ด.1 / ภ.ง.ด.1ก เป็น PDF ที่พิมพ์ข้อมูลทับบนแบบฟอร์มของกรมสรรพากร */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const session = await getSession();
  if (!session?.isStaff) return new Response("Forbidden", { status: 403 });

  const { kind } = await ctx.params;
  if (kind !== "pnd1" && kind !== "pnd1k") return new Response("Not found", { status: 404 });

  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const supabase = await createClient();
  const p = await preparePnd(supabase, kind, params);
  if ("error" in p) return new Response(p.error, { status: 400 });

  const bytes = await buildPndPdf({
    kind,
    company: p.company,
    year: p.year,
    month: p.month,
    additionalNo: p.additionalNo,
    report: p.report,
    lines: p.lines,
  });

  const name = kind === "pnd1" ? `PND1_${p.year + 543}-${String(p.month).padStart(2, "0")}.pdf` : `PND1K_${p.year + 543}.pdf`;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${new URL(req.url).searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

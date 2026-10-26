import { z } from "zod";
import { getSession } from "@/lib/auth";
import { bankFileName } from "@/lib/bank/transfer";
import { prepareBankFile } from "@/lib/bank/prepare";
import { createClient } from "@/lib/supabase/server";

/** ดาวน์โหลดไฟล์ text นำส่งธนาคาร (บันทึกประวัติการออกไฟล์ลง audit_logs ทุกครั้ง) */
export async function GET(req: Request, ctx: { params: Promise<{ periodId: string }> }) {
  const session = await getSession();
  if (!session?.isStaff) return new Response("Forbidden", { status: 403 });

  const id = z.uuid().safeParse((await ctx.params).periodId);
  if (!id.success) return new Response("Not found", { status: 404 });

  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const supabase = await createClient();
  const p = await prepareBankFile(supabase, id.data, sp);
  if ("error" in p) return new Response(p.error, { status: p.status });
  if (p.result.count === 0) return new Response("ไม่มีรายการที่ออกไฟล์ได้", { status: 422 });

  const { error } = await supabase.rpc("log_bank_file_export", {
    p_period: p.period.id,
    p_format: p.format,
    p_count: p.result.count,
    p_total_satang: p.result.totalSatang,
    p_bank: p.onlyBank ?? undefined,
  });
  // ไม่มีบันทึกประวัติ = ไม่ออกไฟล์ (ไฟล์โอนเงินต้องตรวจย้อนหลังได้เสมอ)
  if (error) return new Response(`บันทึกประวัติการออกไฟล์ไม่สำเร็จ: ${error.message}`, { status: 500 });

  const name = bankFileName({ payDate: p.period.pay_date, format: p.format, onlyBank: p.onlyBank });
  return new Response(new Uint8Array(p.result.content), {
    headers: {
      "Content-Type": p.format === "csv" ? "text/csv; charset=utf-8" : "text/plain; charset=windows-874",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

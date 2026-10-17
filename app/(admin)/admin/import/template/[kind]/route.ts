import { getSession } from "@/lib/auth";
import { buildTemplate, type TemplateKind } from "@/lib/import/template";

const NAMES: Record<TemplateKind, string> = {
  employees: "template-employees.xlsx",
  timesheets: "template-timesheets.xlsx",
};

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const session = await getSession();
  if (!session?.isStaff) return new Response("Forbidden", { status: 403 });

  const { kind } = await ctx.params;
  if (kind !== "employees" && kind !== "timesheets") return new Response("Not found", { status: 404 });

  const buf = await buildTemplate(kind);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${NAMES[kind]}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

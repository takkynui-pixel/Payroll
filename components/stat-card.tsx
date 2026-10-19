import type { ReactNode } from "react";
import { NavIcon } from "@/components/nav-icons";
import { cn } from "@/lib/cn";

const TONES = {
  blue: "bg-[#e6f0ff] text-[#1d4ed8]",
  green: "bg-[#e0f5ea] text-ok",
  amber: "bg-[#fff3d6] text-warn",
  sky: "bg-[#e0f4fb] text-[#0b6c93]",
} as const;

/** การ์ดตัวเลขสรุป: ไอคอนในชิปสีอ่อน ตัวเลขใหญ่ และแนวโน้มเทียบงวดก่อน (ถ้ามี) */
export function StatCard({
  label,
  value,
  tone = "blue",
  icon,
  delta,
  hint,
}: {
  label: string;
  value: string;
  tone?: keyof typeof TONES;
  icon?: ReactNode;
  /** เปลี่ยนแปลงเป็นเปอร์เซ็นต์เทียบงวดก่อน (บวก = เพิ่มขึ้น) */
  delta?: number | null;
  hint?: string;
  /** คงไว้เพื่อความเข้ากันได้กับหน้าเดิม */
  large?: boolean;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3">
        {icon ? <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TONES[tone])}>{icon}</span> : null}
        <dt className="text-sm text-muted">{label}</dt>
      </div>
      <dd className="num mt-3 !text-left text-2xl font-semibold tracking-tight text-ink">{value}</dd>
      {delta != null || hint ? (
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {delta != null ? (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-ok" : "text-danger")}>
              <NavIcon name={up ? "trend-up" : "trend-down"} className="size-3.5" />
              {up ? "+" : ""}
              {delta.toFixed(1)}%
            </span>
          ) : null}
          {hint}
        </p>
      ) : null}
    </div>
  );
}

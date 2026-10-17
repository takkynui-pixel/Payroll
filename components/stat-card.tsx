import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const TONES = {
  blue: { chip: "bg-[#dcebff] text-brand", bar: "bg-brand" },
  green: { chip: "bg-[#d9f2e4] text-ok", bar: "bg-[#2e9e66]" },
  amber: { chip: "bg-[#fdebc8] text-warn", bar: "bg-[#e0a21b]" },
  sky: { chip: "bg-[#d6f0fb] text-[#0b6c93]", bar: "bg-sky" },
} as const;

/** การ์ดตัวเลขสรุป: ชิปไอคอนสีอ่อน + เส้นสีด้านล่างเพื่อแยกหมวด (ไม่ได้แสดงความคืบหน้า) */
export function StatCard({
  label,
  value,
  tone = "blue",
  icon,
  large = false,
}: {
  label: string;
  value: string;
  tone?: keyof typeof TONES;
  icon?: ReactNode;
  large?: boolean;
}) {
  const t = TONES[tone];
  return (
    <div className="relative overflow-hidden rounded-xl border border-line/60 bg-surface px-5 py-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <dt className="text-sm text-muted">{label}</dt>
          <dd className={cn("num mt-1 !text-left font-semibold text-navy", large ? "text-2xl" : "text-xl")}>{value}</dd>
        </div>
        {icon ? <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", t.chip)}>{icon}</span> : null}
      </div>
      <span aria-hidden className={cn("absolute inset-x-0 bottom-0 h-1", t.bar)} />
    </div>
  );
}

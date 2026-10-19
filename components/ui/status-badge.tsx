import { PERIOD_STATUS } from "@/lib/format";
import { cn } from "@/lib/cn";

const TONES = {
  gray: { chip: "bg-[#eef1f6] text-[#3d4b61]", dot: "bg-[#8895a8]" },
  blue: { chip: "bg-[#e6f0ff] text-[#1d4ed8]", dot: "bg-accent" },
  amber: { chip: "bg-[#fff3d6] text-[#7a4a00]", dot: "bg-[#e0a21b]" },
  green: { chip: "bg-[#e0f5ea] text-[#12603a]", dot: "bg-[#2e9e66]" },
  dark: { chip: "bg-ink text-white", dot: "bg-white" },
} as const;

/** ป้ายสถานะแบบมีจุดสี (สีไม่ใช่สิ่งเดียวที่สื่อความหมาย เพราะมีข้อความกำกับเสมอ) */
export function StatusBadge({ status }: { status: string }) {
  const s = PERIOD_STATUS[status] ?? { label: status, tone: "gray" as const };
  const t = TONES[s.tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", t.chip)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", t.dot)} />
      {s.label}
    </span>
  );
}

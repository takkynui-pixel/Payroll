import { PERIOD_STATUS } from "@/lib/format";
import { cn } from "@/lib/cn";

const TONES = {
  gray: "bg-[#e6edf6] text-[#33475f]",
  blue: "bg-[#d9eafc] text-[#0d4a94]",
  amber: "bg-[#fdebc8] text-[#7a4a00]",
  green: "bg-[#d4efe0] text-[#12603a]",
  dark: "bg-navy text-white",
} as const;

export function StatusBadge({ status }: { status: string }) {
  const s = PERIOD_STATUS[status] ?? { label: status, tone: "gray" as const };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[s.tone])}>
      {s.label}
    </span>
  );
}

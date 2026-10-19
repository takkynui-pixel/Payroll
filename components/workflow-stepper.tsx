import { PERIOD_STEPS, STEP_LABELS, stepIndex } from "@/lib/workflow";
import { cn } from "@/lib/cn";

/**
 * แถบสถานะของงวด: ร่าง → คำนวณแล้ว → ลูกค้าตรวจสอบ → อนุมัติ → ปิดงวด
 * ลำดับนี้เป็นลำดับจริงที่ฐานข้อมูลบังคับ จึงแสดงเป็นเส้นความคืบหน้า
 * (เป็นจุดเดียวในระบบที่ใช้สีไล่ระดับ)
 */
export function WorkflowStepper({ status }: { status: string }) {
  const n = PERIOD_STEPS.length;
  const finished = status === "closed";
  const current = finished ? n : stepIndex(status);
  // เส้นเริ่มที่กึ่งกลางคอลัมน์แรก (10%) ถึงกึ่งกลางคอลัมน์สุดท้าย (90%) รวมกว้าง 80%
  const fill = (Math.min(current, n - 1) / (n - 1)) * 80;

  return (
    <div className="relative rounded-2xl border border-line bg-surface shadow-card px-2 py-5 sm:px-6">
      <span aria-hidden className="absolute left-[10%] right-[10%] top-[33px] h-[3px] rounded-full bg-line sm:left-[calc(10%+0.3rem)]" />
      <span
        aria-hidden
        className="absolute left-[10%] top-[33px] h-[3px] rounded-full bg-linear-to-r from-brand to-sky sm:left-[calc(10%+0.3rem)]"
        style={{ width: `calc(${fill}% - 0px)` }}
      />
      <ol aria-label="ขั้นตอนของงวดเงินเดือน" className="relative grid grid-cols-5">
        {PERIOD_STEPS.map((step, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          return (
            <li
              key={step}
              aria-current={state === "current" ? "step" : undefined}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full",
                  state === "done" && "bg-brand text-white",
                  state === "current" && "border-[3px] border-brand bg-surface",
                  state === "todo" && "border-2 border-line bg-surface",
                )}
              >
                {state === "done" ? (
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : state === "current" ? (
                  <span className="size-2 rounded-full bg-brand" />
                ) : null}
              </span>
              <span className={cn("px-1 text-xs leading-tight sm:text-sm", state === "current" ? "font-semibold text-ink" : "text-muted")}>
                {STEP_LABELS[step]}
                <span className="sr-only">
                  {state === "done" ? " (เสร็จแล้ว)" : state === "current" ? " (ขั้นตอนปัจจุบัน)" : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

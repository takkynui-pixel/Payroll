"use client";

import { useActionState } from "react";
import { calculatePeriodAction, type CalcState } from "@/app/actions/period";
import { SubmitButton } from "@/components/submit-button";
import { FormError } from "@/components/ui/field";
import { formatBaht } from "@/lib/format";
import type { CalcSummary } from "@/lib/payroll/mapping";

function Report({ s }: { s: CalcSummary }) {
  if (s.fatal) {
    return (
      <div className="space-y-2">
        <FormError message={s.fatal} />
        <Notes notes={s.notes} />
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite">
      {s.ok ? (
        <p className="rounded-md border border-ok/30 bg-ok/5 px-3 py-2 text-sm text-ok">
          คำนวณและบันทึกผลแล้ว {s.saved.toLocaleString("th-TH")} คน
          {s.statusMoved ? " (เปลี่ยนสถานะงวดเป็น “คำนวณแล้ว”)" : ""} สุทธิรวม{" "}
          <strong className="num">{formatBaht(s.totals?.net)}</strong> บาท
        </p>
      ) : (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-3 text-sm text-danger">
          <p className="font-medium">
            คำนวณไม่สำเร็จ ยังไม่ได้บันทึกอะไรเลย ({s.issues.length.toLocaleString("th-TH")} คนมีข้อมูลไม่พร้อม)
          </p>
          <p className="mt-0.5 text-danger/90">แก้ข้อมูลพนักงานต่อไปนี้ให้ครบ แล้วกดคำนวณใหม่</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {s.issues.map((i) => (
              <li key={`${i.employeeCode}-${i.message}`}>
                <span className="font-medium">
                  {i.employeeCode} {i.employeeName}
                </span>
                : {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.warnings.length > 0 ? (
        <div className="rounded-md border border-[#e6c27a] bg-[#fff8e6] px-3 py-3 text-sm text-warn">
          <p className="font-medium">คำเตือน {s.warnings.length.toLocaleString("th-TH")} รายการ (ตรวจสอบก่อนส่งให้ลูกค้า)</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {s.warnings.map((w, idx) => (
              <li key={`${w.employeeCode}-${idx}`}>
                <span className="font-medium">{w.employeeCode}</span>: {w.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Notes notes={s.notes} />
    </div>
  );
}

function Notes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}

/** ปุ่มคำนวณทั้งงวด (คำนวณบน server) พร้อมรายงานผล ปัญหาข้อมูล และคำเตือน */
export function CalculatePanel({ periodId, hasResults }: { periodId: string; hasResults: boolean }) {
  const [state, action] = useActionState<CalcState, FormData>(calculatePeriodAction, null);

  return (
    <section aria-labelledby="calc-title" className="space-y-4 rounded-md border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="calc-title" className="font-semibold text-navy">
            คำนวณเงินเดือน
          </h2>
          <p className="text-sm text-muted">
            คำนวณพนักงานทุกคนในงวดนี้ใหม่ทั้งหมด ผลเดิมของงวดนี้จะถูกแทนที่ ถ้ามีคนใดข้อมูลไม่พร้อมจะไม่บันทึกอะไรเลย
          </p>
        </div>
        <form action={action}>
          <input type="hidden" name="periodId" value={periodId} />
          <SubmitButton pendingText="กำลังคำนวณ…">{hasResults ? "คำนวณใหม่" : "คำนวณเงินเดือน"}</SubmitButton>
        </form>
      </div>
      {state ? <Report s={state} /> : null}
    </section>
  );
}

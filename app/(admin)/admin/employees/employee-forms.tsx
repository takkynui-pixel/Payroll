"use client";

import { useActionState, useState } from "react";
import { changeSalaryAction, correctSalaryAction, linkEmployeeByEmailAction, unlinkEmployeeAccountAction, createEmployeeAction, updateEmployeeAction } from "@/app/actions/employee";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormError, inputClass } from "@/components/ui/field";
import type { ActionState } from "@/lib/action-state";

function Saved({ state, text }: { state: ActionState; text: string }) {
  return state.ok ? (
    <p role="status" className="text-sm text-ok">
      {text}
    </p>
  ) : null;
}

/** ช่องเงินเดือนที่ใช้ร่วมกันระหว่างเพิ่มพนักงานและปรับเงินเดือน */
function SalaryFields({
  prefix,
  defaults,
}: {
  prefix: string;
  defaults?: { pay_type: string; base_salary: number; social_security_deduct: boolean; tax_deduct_type: string };
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="ประเภทการจ่าย" htmlFor={`${prefix}-pay`}>
          <select id={`${prefix}-pay`} name="pay_type" defaultValue={defaults?.pay_type ?? "monthly"} className={inputClass}>
            <option value="monthly">รายเดือน</option>
            <option value="daily">รายวัน</option>
            <option value="hourly">รายชั่วโมง</option>
          </select>
        </Field>
        <Field label="เงินเดือน / ค่าจ้างต่อวัน / ต่อชั่วโมง (บาท)" htmlFor={`${prefix}-base`}>
          <input
            id={`${prefix}-base`}
            name="base_salary"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            defaultValue={defaults?.base_salary}
            className={inputClass}
          />
        </Field>
        <Field label="วิธีหักภาษี" htmlFor={`${prefix}-tax`}>
          <select id={`${prefix}-tax`} name="tax_deduct_type" defaultValue={defaults?.tax_deduct_type ?? "normal"} className={inputClass}>
            <option value="normal">ปกติ (คำนวณสะสมทั้งปี)</option>
            <option value="calculate_per_month">คำนวณรายเดือน</option>
            <option value="no_tax">ไม่หักภาษี</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-ink">
          <input type="checkbox" name="social_security_deduct" defaultChecked={defaults?.social_security_deduct ?? true} className="size-4" />
          หักประกันสังคม
        </label>
      </div>
    </>
  );
}

export interface CompanyOption {
  id: string;
  name: string;
}

export function AddEmployeeForm({ companies, defaultCompany }: { companies: CompanyOption[]; defaultCompany?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createEmployeeAction, {});
  return (
    <form action={action} className="max-w-3xl space-y-6 rounded-2xl border border-line bg-surface shadow-card p-4">
      <fieldset className="space-y-4">
        <legend className="font-semibold text-ink">ข้อมูลพนักงาน</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="บริษัท" htmlFor="e-company">
            <select id="e-company" name="company_id" required defaultValue={defaultCompany ?? ""} className={inputClass}>
              <option value="" disabled>
                เลือกบริษัท
              </option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="รหัสพนักงาน" htmlFor="e-code">
            <input id="e-code" name="employee_code" required maxLength={50} autoComplete="off" className={inputClass} />
          </Field>
          <Field label="คำนำหน้า" htmlFor="e-title">
            <input id="e-title" name="title" maxLength={30} className={inputClass} />
          </Field>
          <div />
          <Field label="ชื่อ" htmlFor="e-first">
            <input id="e-first" name="first_name" required maxLength={200} className={inputClass} />
          </Field>
          <Field label="นามสกุล" htmlFor="e-last">
            <input id="e-last" name="last_name" required maxLength={200} className={inputClass} />
          </Field>
          <Field label="วันที่เริ่มงาน" htmlFor="e-hire">
            <input id="e-hire" name="hire_date" type="date" required className={inputClass} />
          </Field>
          <Field label="เลขบัตรประชาชน" htmlFor="e-idcard" hint="เว้นว่างได้ เก็บแบบเข้ารหัส แสดงเฉพาะ 4 ตัวท้าย">
            <input id="e-idcard" name="id_card" inputMode="numeric" maxLength={17} autoComplete="off" className={inputClass} />
          </Field>
          <Field label="ธนาคาร" htmlFor="e-bank" hint="เช่น KBANK, SCB, BBL">
            <input id="e-bank" name="bank_code" maxLength={30} className={inputClass} />
          </Field>
          <Field label="เลขบัญชี" htmlFor="e-acct">
            <input id="e-acct" name="bank_account_no" inputMode="numeric" maxLength={30} autoComplete="off" className={inputClass} />
          </Field>
          <Field label="อีเมล" htmlFor="e-email">
            <input id="e-email" name="email" type="email" maxLength={254} className={inputClass} />
          </Field>
          <Field label="โทรศัพท์" htmlFor="e-phone">
            <input id="e-phone" name="phone" maxLength={30} className={inputClass} />
          </Field>
        </div>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="font-semibold text-ink">โครงสร้างเงินเดือนแรก (มีผลตั้งแต่วันที่เริ่มงาน)</legend>
        <SalaryFields prefix="e" />
      </fieldset>
      <FormError message={state.error} />
      <SubmitButton pendingText="กำลังบันทึก…">เพิ่มพนักงาน</SubmitButton>
    </form>
  );
}

export interface EmployeeValues {
  id: string;
  title: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  bank_code: string | null;
  bank_account_no: string | null;
  hire_date: string;
  employment_status: string;
  termination_date: string | null;
}

export function EditEmployeeForm({ employee }: { employee: EmployeeValues }) {
  const [state, action] = useActionState<ActionState, FormData>(updateEmployeeAction, {});
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface shadow-card p-4">
      <h2 className="font-semibold text-brand-deep">ข้อมูลพนักงาน</h2>
      <input type="hidden" name="employeeId" value={employee.id} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="คำนำหน้า" htmlFor="u-title">
          <input id="u-title" name="title" maxLength={30} defaultValue={employee.title ?? ""} className={inputClass} />
        </Field>
        <div />
        <Field label="ชื่อ" htmlFor="u-first">
          <input id="u-first" name="first_name" required maxLength={200} defaultValue={employee.first_name} className={inputClass} />
        </Field>
        <Field label="นามสกุล" htmlFor="u-last">
          <input id="u-last" name="last_name" required maxLength={200} defaultValue={employee.last_name} className={inputClass} />
        </Field>
        <Field label="วันที่เริ่มงาน" htmlFor="u-hire">
          <input id="u-hire" name="hire_date" type="date" required defaultValue={employee.hire_date} className={inputClass} />
        </Field>
        <Field label="สถานะ" htmlFor="u-status">
          <select id="u-status" name="employment_status" defaultValue={employee.employment_status} className={inputClass}>
            <option value="active">ทำงานอยู่</option>
            <option value="resigned">ลาออก</option>
            <option value="suspended">พักงาน</option>
          </select>
        </Field>
        <Field label="วันที่สิ้นสุดการจ้าง" htmlFor="u-term" hint="ต้องระบุเมื่อสถานะเป็นลาออก">
          <input id="u-term" name="termination_date" type="date" defaultValue={employee.termination_date ?? ""} className={inputClass} />
        </Field>
        <Field label="เลขบัตรประชาชน (กรอกเมื่อต้องการเปลี่ยน)" htmlFor="u-id" hint="เว้นว่าง = ไม่เปลี่ยน">
          <input id="u-id" name="id_card" inputMode="numeric" maxLength={17} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="ธนาคาร" htmlFor="u-bank">
          <input id="u-bank" name="bank_code" maxLength={30} defaultValue={employee.bank_code ?? ""} className={inputClass} />
        </Field>
        <Field label="เลขบัญชี" htmlFor="u-acct">
          <input id="u-acct" name="bank_account_no" inputMode="numeric" maxLength={30} defaultValue={employee.bank_account_no ?? ""} className={inputClass} />
        </Field>
        <Field label="อีเมล" htmlFor="u-email">
          <input id="u-email" name="email" type="email" maxLength={254} defaultValue={employee.email ?? ""} className={inputClass} />
        </Field>
        <Field label="โทรศัพท์" htmlFor="u-phone">
          <input id="u-phone" name="phone" maxLength={30} defaultValue={employee.phone ?? ""} className={inputClass} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="ที่อยู่ (ใช้ในใบแนบ ภ.ง.ด.1ก)" htmlFor="u-address" hint="เลขที่ ตรอก/ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์">
            <input id="u-address" name="address" maxLength={500} defaultValue={employee.address ?? ""} className={inputClass} />
          </Field>
        </div>
      </div>
      <FormError message={state.error} />
      <Saved state={state} text="บันทึกแล้ว" />
      <SubmitButton pendingText="กำลังบันทึก…">บันทึก</SubmitButton>
    </form>
  );
}

export function ChangeSalaryForm({
  employeeId,
  current,
}: {
  employeeId: string;
  current?: { pay_type: string; base_salary: number; social_security_deduct: boolean; tax_deduct_type: string };
}) {
  const [state, action] = useActionState<ActionState, FormData>(changeSalaryAction, {});
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface shadow-card p-4">
      <h2 className="font-semibold text-brand-deep">ปรับเงินเดือน / เปลี่ยนเงื่อนไข</h2>
      <p className="text-xs text-muted">
        ระบบจะปิดโครงสร้างปัจจุบันในวันก่อนวันที่มีผล แล้วเพิ่มโครงสร้างใหม่ ประวัติเดิมไม่ถูกลบ งวดที่คำนวณไปแล้วไม่เปลี่ยนจนกว่าจะคำนวณใหม่
      </p>
      <input type="hidden" name="employeeId" value={employeeId} />
      <SalaryFields prefix="s" defaults={current} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="มีผลตั้งแต่วันที่" htmlFor="s-eff">
          <input id="s-eff" name="effective_date" type="date" required className={inputClass} />
        </Field>
        <Field label="หมายเหตุ" htmlFor="s-note">
          <input id="s-note" name="note" maxLength={300} className={inputClass} />
        </Field>
      </div>
      <FormError message={state.error} />
      <Saved state={state} text="ปรับเงินเดือนแล้ว" />
      <SubmitButton pendingText="กำลังบันทึก…">บันทึกโครงสร้างใหม่</SubmitButton>
    </form>
  );
}

export interface SalaryHistoryItem {
  id: string;
  label: string;
  pay_type: string;
  base_salary: number;
  social_security_deduct: boolean;
  tax_deduct_type: string;
}

/** แก้ไขแถวเดิมในประวัติโครงสร้างเงินเดือน (ใช้เมื่อบันทึกประเภทการจ่ายหรืออัตราผิดตั้งแต่ต้น) */
export function CorrectSalaryForm({ employeeId, items }: { employeeId: string; items: SalaryHistoryItem[] }) {
  const [state, action] = useActionState<ActionState, FormData>(correctSalaryAction, {});
  const [selected, setSelected] = useState(items[0]?.id ?? "");
  const item = items.find((i) => i.id === selected);
  if (items.length === 0) return null;
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface shadow-card p-4">
      <h2 className="font-semibold text-brand-deep">แก้ไขประวัติโครงสร้างเงินเดือน</h2>
      <p className="text-xs text-muted">
        ใช้แก้รายการเดิมที่บันทึกผิด เช่น ประเภทการจ่ายหรืออัตรา โดยไม่เปลี่ยนวันที่มีผล ระบบบันทึกผู้แก้และเวลาไว้ใน audit log
        งวดที่คำนวณไปแล้วไม่เปลี่ยนจนกว่าจะคำนวณใหม่ (งวดที่อนุมัติหรือปิดแล้วต้องเปิดงวดก่อน)
      </p>
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="salaryId" value={selected} />
      <Field label="เลือกรายการที่จะแก้" htmlFor="cs-pick">
        <select id="cs-pick" value={selected} onChange={(e) => setSelected(e.target.value)} className={inputClass}>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </select>
      </Field>
      <SalaryFields key={selected} prefix="cs" defaults={item} />
      <Field label="หมายเหตุ (เหตุผลที่แก้)" htmlFor="cs-note">
        <input id="cs-note" name="note" maxLength={300} className={inputClass} />
      </Field>
      <FormError message={state.error} />
      <Saved state={state} text="แก้ไขประวัติแล้ว" />
      <SubmitButton pendingText="กำลังบันทึก…">บันทึกการแก้ไข</SubmitButton>
    </form>
  );
}

/** สถานะบัญชีล็อกอินของพนักงาน (ดูสลิปของตัวเอง) ผูกด้วยอีเมลในข้อมูลพนักงาน */
export function AccountLinkCard({ employeeId, email, linked }: { employeeId: string; email: string | null; linked: boolean }) {
  const [linkState, linkAction] = useActionState<ActionState, FormData>(linkEmployeeByEmailAction, {});
  const [unlinkState, unlinkAction] = useActionState<ActionState, FormData>(unlinkEmployeeAccountAction, {});
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface shadow-card p-4" aria-labelledby="acct-title">
      <h2 id="acct-title" className="font-semibold text-brand-deep">
        บัญชีล็อกอินดูสลิป
      </h2>
      {linked ? (
        <>
          <p className="text-sm text-ink">
            <span className="rounded-full bg-ok/10 px-2 py-0.5 text-xs font-medium text-ok">ผูกแล้ว</span> พนักงานล็อกอินดูสลิปของตัวเองได้
          </p>
          <form action={unlinkAction}>
            <input type="hidden" name="employeeId" value={employeeId} />
            <FormError message={unlinkState.error} />
            <SubmitButton pendingText="กำลังบันทึก…" variant="secondary">
              ยกเลิกการผูกบัญชี
            </SubmitButton>
          </form>
          <p className="text-xs text-muted">ถ้าแก้อีเมลของพนักงานที่ผูกไว้แล้ว ระบบจะยกเลิกการผูกเดิมให้อัตโนมัติ แล้วพนักงานล็อกอินด้วยอีเมลใหม่เพื่อผูกใหม่</p>
        </>
      ) : email ? (
        <>
          <p className="text-sm text-ink">
            <span className="rounded-full bg-warn/10 px-2 py-0.5 text-xs font-medium text-warn">รอผูก</span> อีเมลที่ใช้ผูก: <b>{email}</b>
          </p>
          <p className="text-xs text-muted">
            พนักงานเข้าสู่ระบบด้วยแท็บ “รับรหัสทางอีเมล” ที่หน้าเข้าสู่ระบบ ระบบจะผูกบัญชีให้อัตโนมัติเมื่ออีเมลตรงกัน หากมีบัญชีอยู่แล้ว กดผูกให้ได้ที่นี่
          </p>
          <form action={linkAction}>
            <input type="hidden" name="employeeId" value={employeeId} />
            <FormError message={linkState.error} />
            <SubmitButton pendingText="กำลังผูก…" variant="secondary">
              ผูกกับบัญชีที่มีอยู่ตามอีเมลนี้
            </SubmitButton>
          </form>
        </>
      ) : (
        <p className="text-sm text-muted">ยังไม่มีอีเมล กรอกอีเมลในฟอร์มข้อมูลพนักงานแล้วบันทึก พนักงานจึงจะล็อกอินดูสลิปได้</p>
      )}
      {linkState.ok || unlinkState.ok ? (
        <p role="status" className="text-sm text-ok">
          บันทึกแล้ว
        </p>
      ) : null}
    </section>
  );
}

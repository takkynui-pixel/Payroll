"use client";

import { useActionState } from "react";
import { changeSalaryAction, createEmployeeAction, updateEmployeeAction } from "@/app/actions/employee";
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
      <div className="grid gap-4 sm:grid-cols-2">
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
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-navy">
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
    <form action={action} className="max-w-3xl space-y-6 rounded-xl border border-line/60 bg-surface shadow-card p-4">
      <fieldset className="space-y-4">
        <legend className="font-semibold text-navy">ข้อมูลพนักงาน</legend>
        <div className="grid gap-4 sm:grid-cols-2">
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
        <legend className="font-semibold text-navy">โครงสร้างเงินเดือนแรก (มีผลตั้งแต่วันที่เริ่มงาน)</legend>
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
  bank_code: string | null;
  bank_account_no: string | null;
  hire_date: string;
  employment_status: string;
  termination_date: string | null;
}

export function EditEmployeeForm({ employee }: { employee: EmployeeValues }) {
  const [state, action] = useActionState<ActionState, FormData>(updateEmployeeAction, {});
  return (
    <form action={action} className="space-y-4 rounded-xl border border-line/60 bg-surface shadow-card p-4">
      <h2 className="font-semibold text-navy">ข้อมูลพนักงาน</h2>
      <input type="hidden" name="employeeId" value={employee.id} />
      <div className="grid gap-4 sm:grid-cols-2">
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
    <form action={action} className="space-y-4 rounded-xl border border-line/60 bg-surface shadow-card p-4">
      <h2 className="font-semibold text-navy">ปรับเงินเดือน / เปลี่ยนเงื่อนไข</h2>
      <p className="text-xs text-muted">
        ระบบจะปิดโครงสร้างปัจจุบันในวันก่อนวันที่มีผล แล้วเพิ่มโครงสร้างใหม่ ประวัติเดิมไม่ถูกลบ งวดที่คำนวณไปแล้วไม่เปลี่ยนจนกว่าจะคำนวณใหม่
      </p>
      <input type="hidden" name="employeeId" value={employeeId} />
      <SalaryFields prefix="s" defaults={current} />
      <div className="grid gap-4 sm:grid-cols-2">
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

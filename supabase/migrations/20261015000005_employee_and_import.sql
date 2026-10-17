-- =====================================================================
-- 005: เพิ่มพนักงาน / เปลี่ยนเงินเดือน / นำเข้า Excel (พนักงาน, เวลาทำงานรายงวด)
--
-- ทุกฟังก์ชันเป็น security invoker: ทำงานด้วยสิทธิ์ของผู้เรียกและผ่าน RLS เดิม
-- (เขียนข้อมูลได้เฉพาะทีม payroll) จึงไม่ข้ามสิทธิ์ใด ๆ
-- ทุกฟังก์ชันทำงานเป็น transaction เดียว: ถ้าแถวไหนผิดจะไม่บันทึกอะไรเลย
-- รันซ้ำได้ (create or replace)
-- =====================================================================

-- เพิ่มพนักงาน + เงินเดือนเริ่มต้น (+ เลขบัตรประชาชนแบบเข้ารหัส ถ้าระบุ)
create or replace function public.create_employee(
  p_company uuid, p_code text, p_title text, p_first text, p_last text,
  p_email text, p_phone text, p_bank_code text, p_bank_account text, p_hire_date date,
  p_base_salary numeric, p_pay_type text, p_ss boolean, p_tax_type text,
  p_effective date default null, p_id_card text default null
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.employees
    (company_id, employee_code, title, first_name, last_name, email, phone, bank_code, bank_account_no, hire_date)
  values
    (p_company, btrim(p_code), nullif(btrim(coalesce(p_title, '')), ''), btrim(p_first), btrim(p_last),
     nullif(btrim(coalesce(p_email, '')), ''), nullif(btrim(coalesce(p_phone, '')), ''),
     nullif(btrim(coalesce(p_bank_code, '')), ''), nullif(btrim(coalesce(p_bank_account, '')), ''), p_hire_date)
  returning id into v_id;

  insert into public.employee_salaries
    (company_id, employee_id, base_salary, pay_type, social_security_deduct, tax_deduct_type, effective_date)
  values
    (p_company, v_id, p_base_salary, p_pay_type, p_ss, p_tax_type, coalesce(p_effective, p_hire_date));

  if nullif(btrim(coalesce(p_id_card, '')), '') is not null then
    perform public.set_employee_id_card(v_id, btrim(p_id_card));
  end if;
  return v_id;
end;
$$;

-- เปลี่ยนเงินเดือน: ปิดรายการเดิมที่ยังเปิดอยู่ (end_date = วันก่อนวันมีผลใหม่) แล้วเพิ่มรายการใหม่ในครั้งเดียว
create or replace function public.add_employee_salary(
  p_employee uuid, p_base numeric, p_pay_type text, p_ss boolean, p_tax_type text,
  p_effective date, p_note text default null
) returns uuid
language plpgsql set search_path = '' as $$
declare
  e public.employees;
  v_id uuid;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into e from public.employees where id = p_employee and deleted_at is null for update;
  if not found then
    raise exception 'employee_not_found' using errcode = 'P0002';
  end if;
  -- วันมีผลใหม่ต้องหลังรายการเดิมทุกรายการ (ไม่ย้อนแก้ประวัติ)
  if exists (select 1 from public.employee_salaries s
             where s.employee_id = p_employee and s.effective_date >= p_effective) then
    raise exception 'salary_date_conflict' using errcode = 'P0001';
  end if;

  update public.employee_salaries
     set end_date = p_effective - 1
   where employee_id = p_employee and (end_date is null or end_date >= p_effective);

  insert into public.employee_salaries
    (company_id, employee_id, base_salary, pay_type, social_security_deduct, tax_deduct_type, effective_date, note)
  values
    (e.company_id, p_employee, p_base, p_pay_type, p_ss, p_tax_type, p_effective, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- นำเข้าพนักงานหลายคนพร้อมเงินเดือนเริ่มต้น (all-or-nothing) คืนจำนวนที่นำเข้า
create or replace function public.import_employees(p_company uuid, p_rows jsonb, p_file_name text)
returns integer
language plpgsql set search_path = '' as $$
declare
  r record;
  v_id uuid;
  n integer := 0;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'invalid_rows' using errcode = '22023';
  end if;

  insert into public.import_batches (company_id, import_type, file_name, status, total_rows, valid_rows)
  values (p_company, 'employee', left(coalesce(nullif(btrim(p_file_name), ''), 'import.xlsx'), 255),
          'committed', jsonb_array_length(p_rows), jsonb_array_length(p_rows));

  for r in
    select * from jsonb_to_recordset(p_rows) as x(
      code text, title text, first_name text, last_name text, email text, phone text,
      bank_code text, bank_account_no text, id_card text, hire_date date,
      pay_type text, base_salary numeric, ss_deduct boolean, tax_type text, effective_date date)
  loop
    insert into public.employees
      (company_id, employee_code, title, first_name, last_name, email, phone, bank_code, bank_account_no, hire_date)
    values
      (p_company, btrim(r.code), nullif(btrim(coalesce(r.title, '')), ''), btrim(r.first_name), btrim(r.last_name),
       nullif(btrim(coalesce(r.email, '')), ''), nullif(btrim(coalesce(r.phone, '')), ''),
       nullif(btrim(coalesce(r.bank_code, '')), ''), nullif(btrim(coalesce(r.bank_account_no, '')), ''), r.hire_date)
    returning id into v_id;

    insert into public.employee_salaries
      (company_id, employee_id, base_salary, pay_type, social_security_deduct, tax_deduct_type, effective_date)
    values
      (p_company, v_id, r.base_salary, r.pay_type, coalesce(r.ss_deduct, true), r.tax_type,
       coalesce(r.effective_date, r.hire_date));

    if nullif(btrim(coalesce(r.id_card, '')), '') is not null then
      perform public.set_employee_id_card(v_id, btrim(r.id_card));
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- นำเข้าเวลาทำงาน + รายการเพิ่ม/หักของทั้งงวด
--   * แทนที่เวลาทำงานทั้งงวดด้วยข้อมูลในไฟล์ (ไฟล์ = ข้อมูลทั้งงวด)
--   * ลบเฉพาะรายการเพิ่ม/หักที่มาจากการนำเข้าครั้งก่อน (รายการที่คีย์เองไม่ถูกแตะ)
--   * งวดต้องเป็น draft หรือ calculated
create or replace function public.import_period_data(
  p_period uuid, p_timesheets jsonb, p_adjustments jsonb, p_file_name text
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  per public.payroll_periods;
  v_batch uuid;
  v_missing text;
  nt integer;
  na integer;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into per from public.payroll_periods where id = p_period for update;
  if not found then
    raise exception 'period_not_found' using errcode = 'P0002';
  end if;
  if per.status not in ('draft', 'calculated') then
    raise exception 'period_locked' using errcode = 'P0001';
  end if;

  select string_agg(distinct u.c, ', ' order by u.c) into v_missing
  from (
    select x.code as c from jsonb_to_recordset(coalesce(p_timesheets, '[]'::jsonb)) as x(code text)
    union
    select y.code from jsonb_to_recordset(coalesce(p_adjustments, '[]'::jsonb)) as y(code text)
  ) u
  where not exists (
    select 1 from public.employees e
    where e.company_id = per.company_id and e.employee_code = u.c and e.deleted_at is null
  );
  if v_missing is not null then
    raise exception 'employee_not_found' using errcode = 'P0002', detail = v_missing;
  end if;

  insert into public.import_batches
    (company_id, payroll_period_id, import_type, file_name, status, total_rows, valid_rows)
  values
    (per.company_id, p_period, 'timesheet', left(coalesce(nullif(btrim(p_file_name), ''), 'import.xlsx'), 255),
     'committed',
     coalesce(jsonb_array_length(p_timesheets), 0) + coalesce(jsonb_array_length(p_adjustments), 0),
     coalesce(jsonb_array_length(p_timesheets), 0) + coalesce(jsonb_array_length(p_adjustments), 0))
  returning id into v_batch;

  delete from public.employee_timesheets where payroll_period_id = p_period;
  delete from public.payroll_adjustments where payroll_period_id = p_period and import_batch_id is not null;

  insert into public.employee_timesheets
    (company_id, payroll_period_id, employee_id, working_days, ot_hours_1_0, ot_hours_1_5, ot_hours_2_0,
     ot_hours_3_0, late_minutes, absence_days, import_batch_id)
  select per.company_id, p_period, e.id,
         coalesce(x.working_days, 0), coalesce(x.ot_1_0, 0), coalesce(x.ot_1_5, 0), coalesce(x.ot_2_0, 0),
         coalesce(x.ot_3_0, 0), coalesce(x.late_minutes, 0), coalesce(x.absence_days, 0), v_batch
  from jsonb_to_recordset(coalesce(p_timesheets, '[]'::jsonb)) as x(
         code text, working_days numeric, ot_1_0 numeric, ot_1_5 numeric, ot_2_0 numeric, ot_3_0 numeric,
         late_minutes integer, absence_days numeric)
  join public.employees e
    on e.company_id = per.company_id and e.employee_code = x.code and e.deleted_at is null;
  get diagnostics nt = row_count;

  insert into public.payroll_adjustments
    (company_id, payroll_period_id, employee_id, adjustment_type, item_name, amount, is_taxable, is_ss_base,
     import_batch_id)
  select per.company_id, p_period, e.id, x.adj_type, btrim(x.item_name), x.amount,
         coalesce(x.is_taxable, true), coalesce(x.is_ss_base, false), v_batch
  from jsonb_to_recordset(coalesce(p_adjustments, '[]'::jsonb)) as x(
         code text, adj_type text, item_name text, amount numeric, is_taxable boolean, is_ss_base boolean)
  join public.employees e
    on e.company_id = per.company_id and e.employee_code = x.code and e.deleted_at is null;
  get diagnostics na = row_count;

  return jsonb_build_object('timesheets', nt, 'adjustments', na);
end;
$$;

revoke execute on function public.create_employee(uuid, text, text, text, text, text, text, text, text, date, numeric, text, boolean, text, date, text) from public, anon;
revoke execute on function public.add_employee_salary(uuid, numeric, text, boolean, text, date, text) from public, anon;
revoke execute on function public.import_employees(uuid, jsonb, text)                                 from public, anon;
revoke execute on function public.import_period_data(uuid, jsonb, jsonb, text)                        from public, anon;

grant execute on function public.create_employee(uuid, text, text, text, text, text, text, text, text, date, numeric, text, boolean, text, date, text) to authenticated;
grant execute on function public.add_employee_salary(uuid, numeric, text, boolean, text, date, text) to authenticated;
grant execute on function public.import_employees(uuid, jsonb, text)                                  to authenticated;
grant execute on function public.import_period_data(uuid, jsonb, jsonb, text)                         to authenticated;

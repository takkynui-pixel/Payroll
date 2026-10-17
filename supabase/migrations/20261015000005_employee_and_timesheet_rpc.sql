-- =====================================================================
-- 005: ฟังก์ชันเพิ่มพนักงาน / ปรับเงินเดือน / นำเข้าเวลาทำงานแบบ atomic
--
-- ทุกฟังก์ชันเป็น security INVOKER: ทำงานด้วยสิทธิ์ของผู้เรียก ดังนั้น RLS เดิมยังบังคับอยู่
-- (เฉพาะทีม payroll เพิ่ม/แก้ได้) และ trigger ล็อกงวด + audit ทำงานตามปกติ
-- ถ้ามีแถวใดผิดพลาด ทั้งชุดถูกยกเลิก (ไม่มีการบันทึกครึ่ง ๆ กลาง ๆ)
-- รันซ้ำได้ (create or replace)
-- =====================================================================

-- เพิ่มพนักงานใหม่พร้อมโครงสร้างเงินเดือนแรก (และเลขบัตรถ้ามี) ครั้งละหลายคนได้
create or replace function public.create_employees(p_company uuid, p_rows jsonb)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  r jsonb;
  v_id uuid;
  n integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows_must_be_array' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.employees
      (company_id, employee_code, title, first_name, last_name, email, phone,
       bank_code, bank_account_no, hire_date)
    values
      (p_company, r->>'employee_code', nullif(r->>'title', ''), r->>'first_name', r->>'last_name',
       nullif(r->>'email', ''), nullif(r->>'phone', ''), nullif(r->>'bank_code', ''),
       nullif(r->>'bank_account_no', ''), (r->>'hire_date')::date)
    returning id into v_id;

    insert into public.employee_salaries
      (company_id, employee_id, base_salary, pay_type, social_security_deduct,
       tax_deduct_type, effective_date)
    values
      (p_company, v_id, (r->>'base_salary')::numeric,
       coalesce(r->>'pay_type', 'monthly'),
       coalesce((r->>'social_security_deduct')::boolean, true),
       coalesce(r->>'tax_deduct_type', 'normal'),
       coalesce((r->>'effective_date')::date, (r->>'hire_date')::date));

    if nullif(r->>'id_card', '') is not null then
      perform public.set_employee_id_card(v_id, r->>'id_card');
    end if;

    n := n + 1;
  end loop;

  return n;
end;
$$;

-- ปรับเงินเดือน: ปิดรายการปัจจุบัน (end_date = วันก่อนวันมีผลใหม่) แล้วเพิ่มรายการใหม่
create or replace function public.change_salary(p_employee uuid, p_salary jsonb)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  e public.employees;
  v_eff date := (p_salary->>'effective_date')::date;
  v_open public.employee_salaries;
  v_id uuid;
begin
  select * into e from public.employees where id = p_employee and deleted_at is null;
  if not found then
    raise exception 'employee_not_found' using errcode = 'P0002';
  end if;

  select * into v_open
  from public.employee_salaries s
  where s.employee_id = p_employee and (s.end_date is null or s.end_date >= v_eff)
  order by s.effective_date desc
  limit 1;

  if found then
    if v_open.effective_date >= v_eff then
      raise exception 'salary_overlap' using errcode = 'P0001';
    end if;
    update public.employee_salaries set end_date = v_eff - 1 where id = v_open.id;
  end if;

  insert into public.employee_salaries
    (company_id, employee_id, base_salary, pay_type, social_security_deduct,
     tax_deduct_type, effective_date, note)
  values
    (e.company_id, p_employee, (p_salary->>'base_salary')::numeric,
     coalesce(p_salary->>'pay_type', 'monthly'),
     coalesce((p_salary->>'social_security_deduct')::boolean, true),
     coalesce(p_salary->>'tax_deduct_type', 'normal'),
     v_eff, nullif(p_salary->>'note', ''))
  returning id into v_id;

  return v_id;
end;
$$;

-- นำเข้าเวลาทำงานของงวด (upsert ต่อพนักงาน) และรายการเพิ่ม-หัก
--   p_adjustments = null  -> ไม่แตะรายการเพิ่ม-หักเดิม
--   p_adjustments = [...] -> แทนที่รายการที่เคยนำเข้ามาก่อนหน้า (รายการที่คีย์เองไม่ถูกลบ)
create or replace function public.import_timesheets(p_period uuid, p_rows jsonb, p_adjustments jsonb default null)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  per public.payroll_periods;
  v_batch uuid := gen_random_uuid();
  r jsonb;
  v_emp uuid;
  n_ts integer := 0;
  n_adj integer := 0;
begin
  select * into per from public.payroll_periods where id = p_period;
  if not found then
    raise exception 'period_not_found' using errcode = 'P0002';
  end if;
  if per.status not in ('draft', 'calculated') then
    raise exception 'period_locked' using errcode = '55006';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    select id into v_emp from public.employees
    where company_id = per.company_id and employee_code = r->>'employee_code' and deleted_at is null;
    if v_emp is null then
      raise exception 'unknown_employee:%', r->>'employee_code' using errcode = 'P0002';
    end if;

    insert into public.employee_timesheets
      (company_id, payroll_period_id, employee_id, working_days,
       ot_hours_1_0, ot_hours_1_5, ot_hours_2_0, ot_hours_3_0,
       late_minutes, absence_days, import_batch_id)
    values
      (per.company_id, p_period, v_emp,
       coalesce((r->>'working_days')::numeric, 0),
       coalesce((r->>'ot_hours_1_0')::numeric, 0), coalesce((r->>'ot_hours_1_5')::numeric, 0),
       coalesce((r->>'ot_hours_2_0')::numeric, 0), coalesce((r->>'ot_hours_3_0')::numeric, 0),
       coalesce((r->>'late_minutes')::integer, 0), coalesce((r->>'absence_days')::numeric, 0),
       v_batch)
    on conflict (payroll_period_id, employee_id) do update set
      working_days = excluded.working_days,
      ot_hours_1_0 = excluded.ot_hours_1_0, ot_hours_1_5 = excluded.ot_hours_1_5,
      ot_hours_2_0 = excluded.ot_hours_2_0, ot_hours_3_0 = excluded.ot_hours_3_0,
      late_minutes = excluded.late_minutes, absence_days = excluded.absence_days,
      import_batch_id = excluded.import_batch_id;
    n_ts := n_ts + 1;
  end loop;

  if p_adjustments is not null then
    delete from public.payroll_adjustments
    where payroll_period_id = p_period and import_batch_id is not null;

    for r in select * from jsonb_array_elements(p_adjustments) loop
      select id into v_emp from public.employees
      where company_id = per.company_id and employee_code = r->>'employee_code' and deleted_at is null;
      if v_emp is null then
        raise exception 'unknown_employee:%', r->>'employee_code' using errcode = 'P0002';
      end if;

      insert into public.payroll_adjustments
        (company_id, payroll_period_id, employee_id, adjustment_type, item_name,
         amount, is_taxable, is_ss_base, import_batch_id)
      values
        (per.company_id, p_period, v_emp, r->>'adjustment_type', r->>'item_name',
         (r->>'amount')::numeric,
         coalesce((r->>'is_taxable')::boolean, true),
         coalesce((r->>'is_ss_base')::boolean, false), v_batch);
      n_adj := n_adj + 1;
    end loop;
  end if;

  return jsonb_build_object('timesheets', n_ts, 'adjustments', n_adj);
end;
$$;

revoke execute on function public.create_employees(uuid, jsonb)         from public, anon;
revoke execute on function public.change_salary(uuid, jsonb)            from public, anon;
revoke execute on function public.import_timesheets(uuid, jsonb, jsonb) from public, anon;

grant execute on function public.create_employees(uuid, jsonb)          to authenticated;
grant execute on function public.change_salary(uuid, jsonb)             to authenticated;
grant execute on function public.import_timesheets(uuid, jsonb, jsonb)  to authenticated;

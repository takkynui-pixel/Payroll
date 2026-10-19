-- =====================================================================
-- 006: เพิ่มอัตราล่วงเวลา 2.5 เท่า (ot_hours_2_5)
-- รันซ้ำได้ (if not exists / create or replace) ต้องรันหลัง 005
-- =====================================================================

alter table public.employee_timesheets
  add column if not exists ot_hours_2_5 numeric(6,2) not null default 0 check (ot_hours_2_5 >= 0);

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
       ot_hours_1_0, ot_hours_1_5, ot_hours_2_0, ot_hours_2_5, ot_hours_3_0,
       late_minutes, absence_days, import_batch_id)
    values
      (per.company_id, p_period, v_emp,
       coalesce((r->>'working_days')::numeric, 0),
       coalesce((r->>'ot_hours_1_0')::numeric, 0), coalesce((r->>'ot_hours_1_5')::numeric, 0),
       coalesce((r->>'ot_hours_2_0')::numeric, 0), coalesce((r->>'ot_hours_2_5')::numeric, 0),
       coalesce((r->>'ot_hours_3_0')::numeric, 0),
       coalesce((r->>'late_minutes')::integer, 0), coalesce((r->>'absence_days')::numeric, 0),
       v_batch)
    on conflict (payroll_period_id, employee_id) do update set
      working_days = excluded.working_days,
      ot_hours_1_0 = excluded.ot_hours_1_0, ot_hours_1_5 = excluded.ot_hours_1_5,
      ot_hours_2_0 = excluded.ot_hours_2_0, ot_hours_2_5 = excluded.ot_hours_2_5,
      ot_hours_3_0 = excluded.ot_hours_3_0,
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

revoke execute on function public.import_timesheets(uuid, jsonb, jsonb) from public, anon;
grant  execute on function public.import_timesheets(uuid, jsonb, jsonb) to authenticated;

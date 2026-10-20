-- =====================================================================
-- 009: เก็บเวลาทำงานเป็น "นาที" (จำนวนเต็ม) แทนทศนิยมวัน/ชั่วโมง
--   รองรับไฟล์ที่ส่งเป็น วัน / ชั่วโมง / นาที ได้ไม่เสียเศษ
--   - คอลัมน์หลัก (นาที): working_minutes, absence_minutes, leave_unpaid_minutes,
--       late_minutes (มีอยู่แล้ว), early_leave_minutes, ot_minutes_1_0 .. ot_minutes_3_0
--   - คอลัมน์เดิม working_days / ot_hours_* / absence_days กลายเป็นคอลัมน์คำนวณอัตโนมัติ
--       (1 วัน = 8 ชั่วโมง = 480 นาที; absence_days = ขาดงาน + ลาหักเงิน)
--     ทำให้โค้ดที่อ่านคอลัมน์เดิมใช้ต่อได้
--   - import_timesheets รับค่าเป็นนาที
-- ต้องรันหลัง 006 รันซ้ำได้ (ตรวจก่อนแปลง)
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employee_timesheets' and column_name = 'working_minutes'
  ) then
    alter table public.employee_timesheets
      add column working_minutes     integer not null default 0 check (working_minutes >= 0),
      add column absence_minutes     integer not null default 0 check (absence_minutes >= 0),
      add column leave_unpaid_minutes integer not null default 0 check (leave_unpaid_minutes >= 0),
      add column early_leave_minutes integer not null default 0 check (early_leave_minutes >= 0),
      add column ot_minutes_1_0      integer not null default 0 check (ot_minutes_1_0 >= 0),
      add column ot_minutes_1_5      integer not null default 0 check (ot_minutes_1_5 >= 0),
      add column ot_minutes_2_0      integer not null default 0 check (ot_minutes_2_0 >= 0),
      add column ot_minutes_2_5      integer not null default 0 check (ot_minutes_2_5 >= 0),
      add column ot_minutes_3_0      integer not null default 0 check (ot_minutes_3_0 >= 0);

    -- ย้ายข้อมูลเดิม (วัน x 480 นาที, ชั่วโมง x 60 นาที)
    update public.employee_timesheets set
      working_minutes = round(working_days * 480),
      absence_minutes = round(absence_days * 480),
      ot_minutes_1_0 = round(ot_hours_1_0 * 60),
      ot_minutes_1_5 = round(ot_hours_1_5 * 60),
      ot_minutes_2_0 = round(ot_hours_2_0 * 60),
      ot_minutes_2_5 = round(ot_hours_2_5 * 60),
      ot_minutes_3_0 = round(ot_hours_3_0 * 60);

    alter table public.employee_timesheets
      drop column working_days,
      drop column absence_days,
      drop column ot_hours_1_0,
      drop column ot_hours_1_5,
      drop column ot_hours_2_0,
      drop column ot_hours_2_5,
      drop column ot_hours_3_0;

    alter table public.employee_timesheets
      add column working_days numeric generated always as (working_minutes / 480.0) stored,
      add column absence_days numeric generated always as ((absence_minutes + leave_unpaid_minutes) / 480.0) stored,
      add column ot_hours_1_0 numeric generated always as (ot_minutes_1_0 / 60.0) stored,
      add column ot_hours_1_5 numeric generated always as (ot_minutes_1_5 / 60.0) stored,
      add column ot_hours_2_0 numeric generated always as (ot_minutes_2_0 / 60.0) stored,
      add column ot_hours_2_5 numeric generated always as (ot_minutes_2_5 / 60.0) stored,
      add column ot_hours_3_0 numeric generated always as (ot_minutes_3_0 / 60.0) stored;
  end if;
end
$$;

-- นำเข้าเวลาทำงานของงวด (upsert ต่อพนักงาน) และรายการเพิ่ม-หัก  ค่าเวลาทั้งหมดเป็น "นาที"
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
    v_emp := null;
    select id into v_emp from public.employees
    where company_id = per.company_id and employee_code = r->>'employee_code' and deleted_at is null;
    if v_emp is null then
      raise exception 'unknown_employee:%', r->>'employee_code' using errcode = 'P0002';
    end if;

    insert into public.employee_timesheets
      (company_id, payroll_period_id, employee_id,
       working_minutes, absence_minutes, leave_unpaid_minutes, late_minutes, early_leave_minutes,
       ot_minutes_1_0, ot_minutes_1_5, ot_minutes_2_0, ot_minutes_2_5, ot_minutes_3_0,
       import_batch_id)
    values
      (per.company_id, p_period, v_emp,
       coalesce((r->>'working_minutes')::integer, 0), coalesce((r->>'absence_minutes')::integer, 0),
       coalesce((r->>'leave_unpaid_minutes')::integer, 0), coalesce((r->>'late_minutes')::integer, 0),
       coalesce((r->>'early_leave_minutes')::integer, 0),
       coalesce((r->>'ot_minutes_1_0')::integer, 0), coalesce((r->>'ot_minutes_1_5')::integer, 0),
       coalesce((r->>'ot_minutes_2_0')::integer, 0), coalesce((r->>'ot_minutes_2_5')::integer, 0),
       coalesce((r->>'ot_minutes_3_0')::integer, 0),
       v_batch)
    on conflict (payroll_period_id, employee_id) do update set
      working_minutes = excluded.working_minutes, absence_minutes = excluded.absence_minutes,
      leave_unpaid_minutes = excluded.leave_unpaid_minutes, late_minutes = excluded.late_minutes,
      early_leave_minutes = excluded.early_leave_minutes,
      ot_minutes_1_0 = excluded.ot_minutes_1_0, ot_minutes_1_5 = excluded.ot_minutes_1_5,
      ot_minutes_2_0 = excluded.ot_minutes_2_0, ot_minutes_2_5 = excluded.ot_minutes_2_5,
      ot_minutes_3_0 = excluded.ot_minutes_3_0,
      import_batch_id = excluded.import_batch_id;
    n_ts := n_ts + 1;
  end loop;

  if p_adjustments is not null then
    delete from public.payroll_adjustments
    where payroll_period_id = p_period and import_batch_id is not null;

    for r in select * from jsonb_array_elements(p_adjustments) loop
      v_emp := null;
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

-- =====================================================================
-- 003: ข้อมูลภาษีรายพนักงาน + ฟังก์ชันบันทึกผลคำนวณแบบ atomic
-- เพิ่มอย่างเดียว ไม่แตะตารางเดิม
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. employee_tax_profiles
--    ค่าลดหย่อนอื่นต่อปี (คู่สมรส บุตร ประกันชีวิต ฯลฯ รวมเป็นยอดเดียวที่ตรวจแล้ว)
--    และยอดสะสมยกมา สำหรับพนักงานที่เริ่มใช้ระบบกลางปี
-- ---------------------------------------------------------------------
create table public.employee_tax_profiles (
  id                          uuid primary key default gen_random_uuid(),
  company_id                  uuid not null,
  employee_id                 uuid not null,
  tax_year                    integer not null check (tax_year between 2020 and 2100),  -- ค.ศ. ตามปีที่จ่ายเงิน
  other_allowances_annual     numeric(12,2) not null default 0 check (other_allowances_annual >= 0),
  ytd_opening_taxable         numeric(14,2) not null default 0 check (ytd_opening_taxable >= 0),
  ytd_opening_social_security numeric(12,2) not null default 0 check (ytd_opening_social_security >= 0),
  ytd_opening_tax             numeric(12,2) not null default 0 check (ytd_opening_tax >= 0),
  note                        text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (employee_id, tax_year),
  foreign key (employee_id, company_id) references public.employees (id, company_id)
);
create index employee_tax_profiles_emp_co_idx on public.employee_tax_profiles (employee_id, company_id);
create index employee_tax_profiles_company_idx on public.employee_tax_profiles (company_id);

create trigger trg_employee_tax_profiles_updated_at before update on public.employee_tax_profiles
  for each row execute function private.set_updated_at();
create trigger trg_employee_tax_profiles_audit after insert or update or delete on public.employee_tax_profiles
  for each row execute function private.audit_row();

alter table public.employee_tax_profiles enable row level security;

create policy tax_profiles_select on public.employee_tax_profiles for select to authenticated
  using (private.has_company_access(company_id) or private.is_self(employee_id));
create policy tax_profiles_insert on public.employee_tax_profiles for insert to authenticated
  with check (private.is_staff());
create policy tax_profiles_update on public.employee_tax_profiles for update to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy tax_profiles_delete on public.employee_tax_profiles for delete to authenticated
  using (private.is_staff());

revoke all on public.employee_tax_profiles from anon;

-- ---------------------------------------------------------------------
-- 2. เพดานค่าลดหย่อนเงินสมทบประกันสังคมในการคำนวณภาษี (ต่อปี)
--    ใช้ค่า 9,000 บาทซึ่งเป็นค่าเดิมที่บทความปีภาษี 2569 ยังอ้างถึง
--    เป็นฝั่งระมัดระวัง (หักภาษีมากไม่ใช่น้อย) ต้องให้ผู้รู้ด้านภาษียืนยันกับกรมสรรพากร
-- ---------------------------------------------------------------------
insert into public.statutory_rates (code, value, effective_from, effective_to, description)
values ('tax_ss_deduction_cap', 9000, '2026-01-01', null,
        'ภาษี: เพดานลดหย่อนเงินสมทบประกันสังคมต่อปี (ยังไม่ยืนยันกับกรมสรรพากร ตรวจสอบก่อนใช้งานจริง)')
on conflict (code, effective_from) do nothing;

-- ---------------------------------------------------------------------
-- 3. บันทึกผลคำนวณทั้งงวดใน transaction เดียว (SECURITY INVOKER)
--    ใช้สิทธิ์และ RLS ของผู้เรียก ทริกเกอร์ล็อกงวด และ check ยอดสุทธิทำงานตามปกติ
--    ถ้าแถวใดผิดเงื่อนไข ทั้งงวดจะ rollback ไม่ค้างครึ่งทาง
-- ---------------------------------------------------------------------
create or replace function public.save_payroll_results(p_period uuid, p_results jsonb)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_company uuid;
  v_status  text;
  v_count   integer;
begin
  if p_results is null or jsonb_typeof(p_results) <> 'array' then
    raise exception 'p_results must be a json array';
  end if;

  select company_id, status into v_company, v_status
  from public.payroll_periods where id = p_period;

  if v_company is null then
    raise exception 'payroll period not found or not accessible' using errcode = 'P0002';
  end if;
  if v_status not in ('draft', 'calculated') then
    raise exception 'payroll period is locked (status=%)', v_status using errcode = '55006';
  end if;

  delete from public.payroll_results where payroll_period_id = p_period;

  with ins as (
    insert into public.payroll_results (
      company_id, payroll_period_id, employee_id,
      employee_code, employee_name, bank_code, bank_account_no,
      base_salary_used, working_days, ot_amount, absence_deduction, late_deduction,
      gross_salary, total_earnings, ss_wage_base, ss_rate_used, social_security_amount,
      tax_amount, other_deductions, net_salary, calc_version, input_snapshot
    )
    select
      v_company, p_period, x.employee_id,
      x.employee_code, x.employee_name, x.bank_code, x.bank_account_no,
      x.base_salary_used, x.working_days, x.ot_amount, x.absence_deduction, x.late_deduction,
      x.gross_salary, x.total_earnings, x.ss_wage_base, x.ss_rate_used, x.social_security_amount,
      x.tax_amount, x.other_deductions, x.net_salary, x.calc_version, x.input_snapshot
    from jsonb_to_recordset(p_results) as x(
      employee_id uuid, employee_code text, employee_name text, bank_code text, bank_account_no text,
      base_salary_used numeric, working_days numeric, ot_amount numeric,
      absence_deduction numeric, late_deduction numeric,
      gross_salary numeric, total_earnings numeric, ss_wage_base numeric, ss_rate_used numeric,
      social_security_amount numeric, tax_amount numeric, other_deductions numeric,
      net_salary numeric, calc_version text, input_snapshot jsonb
    )
    returning id, employee_id
  )
  insert into public.payroll_result_items (
    company_id, payroll_period_id, employee_id, payroll_result_id,
    item_type, code, item_name, amount, sort_order
  )
  select
    v_company, p_period, ins.employee_id, ins.id,
    i.item_type, i.code, i.item_name, i.amount, i.sort_order
  from ins
  join jsonb_to_recordset(p_results) as x(employee_id uuid, items jsonb)
    on x.employee_id = ins.employee_id
  cross join lateral jsonb_to_recordset(coalesce(x.items, '[]'::jsonb)) as i(
    item_type text, code text, item_name text, amount numeric, sort_order integer
  );

  select count(*) into v_count from public.payroll_results where payroll_period_id = p_period;
  return v_count;
end $$;

revoke execute on function public.save_payroll_results(uuid, jsonb) from public, anon;
grant  execute on function public.save_payroll_results(uuid, jsonb) to authenticated;

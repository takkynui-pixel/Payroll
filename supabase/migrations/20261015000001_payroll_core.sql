-- =====================================================================
-- 001_payroll_core.sql
-- Payroll & Outsourcing (Multi-tenant) - Supabase / PostgreSQL
-- ครอบคลุม: extensions, ตารางทั้งหมด, helper functions, RLS, audit log,
--           ล็อกงวด, workflow การอนุมัติ, เข้ารหัสเลขบัตรประชาชน
-- รันได้ทั้ง Supabase SQL Editor หรือ `supabase db push`
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Extensions & schema
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto  with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- schema private: เก็บ helper function ที่ไม่ต้องเปิดผ่าน API (PostgREST เปิดเฉพาะ public)
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1. ตารางหลัก
-- ---------------------------------------------------------------------

-- 1.1 บริษัทลูกค้า
create table public.companies (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  tax_id           text,
  pay_cycle_type   text not null default 'monthly'
                   check (pay_cycle_type in ('monthly','semi_monthly','weekly','daily')),
  ss_account_no    text,                       -- เลขที่บัญชีนายจ้างประกันสังคม
  address          text,
  is_active        boolean not null default true,
  deleted_at       timestamptz,                -- soft delete
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index companies_tax_id_uq
  on public.companies (tax_id) where tax_id is not null and deleted_at is null;

-- 1.2 สมาชิกระบบ: ผูก auth user กับ role/บริษัท
--     super_admin / payroll_admin = ทีม outsource (company_id = null = ทุกบริษัท)
--     client_hr / employee        = ต้องระบุบริษัท
create table public.company_members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  company_id  uuid references public.companies(id),
  role        text not null
              check (role in ('super_admin','payroll_admin','client_hr','employee')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint company_members_scope_chk check (
    (role in ('super_admin','payroll_admin') and company_id is null)
    or (role in ('client_hr','employee') and company_id is not null)
  )
);
create unique index company_members_uq
  on public.company_members (user_id, coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), role);
create index company_members_user_idx on public.company_members (user_id, role, company_id) where is_active;

-- 1.3 พนักงาน (ไม่เก็บเลขบัตรเต็มที่นี่ ดู employee_identity)
create table public.employees (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id),
  user_id            uuid references auth.users(id) on delete set null,  -- ผูกกับ login ของพนักงาน (ถ้ามี)
  employee_code      text not null,
  title              text,
  first_name         text not null,
  last_name          text not null,
  email              text,
  phone              text,
  id_card_last4      text check (id_card_last4 ~ '^[0-9]{4}$'),          -- ไว้แสดงผลเท่านั้น
  bank_code          text,                                               -- เช่น KBANK, SCB
  bank_account_no    text,
  hire_date          date not null,
  termination_date   date,
  employment_status  text not null default 'active'
                     check (employment_status in ('active','resigned','suspended')),
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint employees_id_company_uq unique (id, company_id)
);
create unique index employees_code_uq on public.employees (company_id, employee_code) where deleted_at is null;
create unique index employees_user_uq on public.employees (user_id) where user_id is not null and deleted_at is null;
create index employees_company_idx on public.employees (company_id);

-- 1.4 เลขบัตรประชาชนแบบเข้ารหัส (เข้าถึงได้เฉพาะทีม payroll ผ่าน function)
create table public.employee_identity (
  employee_id        uuid primary key,
  company_id         uuid not null,
  id_card_encrypted  bytea not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (employee_id, company_id) references public.employees (id, company_id)
);

-- 1.5 โครงสร้างเงินเดือน (เก็บประวัติ ห้ามช่วงเวลาซ้อนกัน)
create table public.employee_salaries (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null,
  employee_id             uuid not null,
  base_salary             numeric(12,2) not null check (base_salary >= 0),
  pay_type                text not null default 'monthly' check (pay_type in ('monthly','daily','hourly')),
  social_security_deduct  boolean not null default true,
  tax_deduct_type         text not null default 'normal'
                          check (tax_deduct_type in ('normal','calculate_per_month','no_tax')),
  effective_date          date not null,
  end_date                date,                      -- null = ยังใช้อยู่ (รวมวันสิ้นสุด)
  note                    text,
  created_by              uuid default auth.uid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint salary_dates_chk check (end_date is null or end_date >= effective_date),
  foreign key (employee_id, company_id) references public.employees (id, company_id),
  constraint salary_no_overlap exclude using gist (
    employee_id with =,
    daterange(effective_date, end_date, '[]') with &&
  )
);
create index employee_salaries_emp_idx on public.employee_salaries (employee_id, effective_date desc);
create index employee_salaries_company_idx on public.employee_salaries (company_id);

-- 1.6 รายการหักประจำ (กยศ., PVD, ผ่อนชำระ ฯลฯ)
create table public.employee_deductions (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null,
  employee_id     uuid not null,
  deduction_type  text not null check (deduction_type in ('student_loan','pvd','loan','other')),
  item_name       text not null,
  amount          numeric(12,2) not null check (amount >= 0),
  start_date      date not null,
  end_date        date,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint deduction_dates_chk check (end_date is null or end_date >= start_date),
  foreign key (employee_id, company_id) references public.employees (id, company_id)
);
create index employee_deductions_emp_idx on public.employee_deductions (employee_id);
create index employee_deductions_company_idx on public.employee_deductions (company_id);

-- ---------------------------------------------------------------------
-- 2. ตารางประจำงวด
-- ---------------------------------------------------------------------

create table public.payroll_periods (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id),
  period_name   text not null,
  start_date    date not null,
  end_date      date not null,
  pay_date      date not null,
  status        text not null default 'draft'
                check (status in ('draft','calculated','client_reviewing','approved','closed')),
  submitted_at  timestamptz,
  approved_at   timestamptz,
  approved_by   uuid,
  closed_at     timestamptz,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint period_dates_chk check (end_date >= start_date),
  constraint payroll_periods_id_company_uq unique (id, company_id),
  constraint payroll_periods_range_uq unique (company_id, start_date, end_date)
);
create index payroll_periods_company_idx on public.payroll_periods (company_id, start_date desc);

create table public.employee_timesheets (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null,
  payroll_period_id uuid not null,
  employee_id       uuid not null,
  working_days      numeric(5,2) not null default 0 check (working_days >= 0),
  ot_hours_1_0      numeric(6,2) not null default 0 check (ot_hours_1_0 >= 0),
  ot_hours_1_5      numeric(6,2) not null default 0 check (ot_hours_1_5 >= 0),
  ot_hours_2_0      numeric(6,2) not null default 0 check (ot_hours_2_0 >= 0),
  ot_hours_3_0      numeric(6,2) not null default 0 check (ot_hours_3_0 >= 0),
  late_minutes      integer not null default 0 check (late_minutes >= 0),
  absence_days      numeric(5,2) not null default 0 check (absence_days >= 0),
  import_batch_id   uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (payroll_period_id, employee_id),
  foreign key (payroll_period_id, company_id) references public.payroll_periods (id, company_id),
  foreign key (employee_id, company_id) references public.employees (id, company_id)
);
create index employee_timesheets_company_idx on public.employee_timesheets (company_id);
create index employee_timesheets_emp_idx on public.employee_timesheets (employee_id);

create table public.payroll_adjustments (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null,
  payroll_period_id uuid not null,
  employee_id       uuid not null,
  adjustment_type   text not null check (adjustment_type in ('earning','deduction')),
  item_name         text not null,
  amount            numeric(12,2) not null check (amount > 0),
  is_taxable        boolean not null default true,     -- รวมในฐานภาษีหรือไม่ (เฉพาะ earning)
  is_ss_base        boolean not null default false,    -- รวมในฐานประกันสังคมหรือไม่
  note              text,
  import_batch_id   uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (payroll_period_id, company_id) references public.payroll_periods (id, company_id),
  foreign key (employee_id, company_id) references public.employees (id, company_id)
);
create index payroll_adjustments_period_idx on public.payroll_adjustments (payroll_period_id, employee_id);
create index payroll_adjustments_company_idx on public.payroll_adjustments (company_id);

-- ---------------------------------------------------------------------
-- 3. อัตราตามกฎหมาย (ไม่ hardcode ในโค้ด) ตารางกลาง ไม่ผูกบริษัท
-- ---------------------------------------------------------------------

-- code ตัวอย่าง: ss_employee_rate, ss_employer_rate, ss_wage_floor, ss_wage_cap,
--               tax_personal_allowance, tax_expense_rate, tax_expense_cap
create table public.statutory_rates (
  id             uuid primary key default gen_random_uuid(),
  code           text not null,
  value          numeric(14,6) not null,
  effective_from date not null,
  effective_to   date,
  description    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (code, effective_from),
  constraint statutory_dates_chk check (effective_to is null or effective_to >= effective_from)
);

-- ขั้นบันไดภาษีเงินได้บุคคลธรรมดา แยกตามวันที่มีผล
create table public.tax_brackets (
  id             uuid primary key default gen_random_uuid(),
  effective_from date not null,
  effective_to   date,
  income_from    numeric(14,2) not null,   -- เงินได้สุทธิตั้งแต่ (ต่อปี)
  income_to      numeric(14,2),            -- null = ไม่จำกัด
  rate           numeric(5,4) not null check (rate >= 0 and rate <= 1),
  created_at     timestamptz not null default now(),
  unique (effective_from, income_from),
  constraint bracket_range_chk check (income_to is null or income_to > income_from)
);

-- ---------------------------------------------------------------------
-- 4. ผลลัพธ์การคำนวณ (Snapshot)
-- ---------------------------------------------------------------------

create table public.payroll_results (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null,
  payroll_period_id       uuid not null,
  employee_id             uuid not null,

  -- snapshot ข้อมูลพนักงาน ณ วันคำนวณ (ไม่เปลี่ยนตามข้อมูลหลักในอนาคต)
  employee_code           text not null,
  employee_name           text not null,
  bank_code               text,
  bank_account_no         text,

  -- snapshot ข้อมูลที่ใช้คำนวณ
  base_salary_used        numeric(12,2) not null,
  working_days            numeric(5,2),
  ot_amount               numeric(12,2) not null default 0,
  absence_deduction       numeric(12,2) not null default 0,
  late_deduction          numeric(12,2) not null default 0,

  gross_salary            numeric(12,2) not null,   -- เงินเดือนหลังรวม OT และหักขาด/ลา/สาย
  total_earnings          numeric(12,2) not null,   -- รายได้รวมทั้งหมด
  ss_wage_base            numeric(12,2) not null default 0,
  ss_rate_used            numeric(7,6)  not null default 0,
  social_security_amount  numeric(12,2) not null default 0,
  tax_amount              numeric(12,2) not null default 0,
  other_deductions        numeric(12,2) not null default 0,
  net_salary              numeric(12,2) not null,

  calc_version            text,                     -- เวอร์ชันของสูตร/engine
  input_snapshot          jsonb,                    -- อัตรา/ลดหย่อน/ข้อมูลอื่นที่ใช้ตอนคำนวณ
  calculated_at           timestamptz not null default now(),
  calculated_by           uuid default auth.uid(),

  unique (payroll_period_id, employee_id),
  constraint payroll_results_id_company_uq unique (id, company_id),
  constraint payroll_results_net_chk check (
    net_salary = total_earnings - social_security_amount - tax_amount - other_deductions
  ),
  foreign key (payroll_period_id, company_id) references public.payroll_periods (id, company_id),
  foreign key (employee_id, company_id) references public.employees (id, company_id)
);
create index payroll_results_company_idx on public.payroll_results (company_id);
create index payroll_results_emp_idx on public.payroll_results (employee_id);

-- รายละเอียดรายบรรทัดสำหรับสลิป (denormalize period/employee เพื่อให้ RLS เร็ว)
create table public.payroll_result_items (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null,
  payroll_period_id uuid not null,
  employee_id       uuid not null,
  payroll_result_id uuid not null,
  item_type         text not null check (item_type in ('earning','deduction')),
  code              text not null,        -- base, ot_1_5, bonus, social_security, withholding_tax, ...
  item_name         text not null,
  amount            numeric(12,2) not null check (amount >= 0),
  sort_order        integer not null default 0,
  foreign key (payroll_result_id, company_id) references public.payroll_results (id, company_id) on delete cascade,
  foreign key (payroll_period_id, company_id) references public.payroll_periods (id, company_id),
  foreign key (employee_id, company_id) references public.employees (id, company_id)
);
create index payroll_result_items_result_idx on public.payroll_result_items (payroll_result_id);
create index payroll_result_items_company_idx on public.payroll_result_items (company_id);

-- ---------------------------------------------------------------------
-- 5. Workflow / เอกสาร / นำเข้าข้อมูล / Audit
-- ---------------------------------------------------------------------

create table public.payroll_period_approvals (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null,
  payroll_period_id uuid not null,
  action            text not null check (action in ('calculated','submitted','approved','rejected','reopened','closed')),
  from_status       text not null,
  to_status         text not null,
  note              text,
  acted_by          uuid default auth.uid(),
  acted_at          timestamptz not null default now(),
  foreign key (payroll_period_id, company_id) references public.payroll_periods (id, company_id)
);
create index payroll_period_approvals_period_idx on public.payroll_period_approvals (payroll_period_id, acted_at);

create table public.payslips (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null,
  payroll_period_id uuid not null,
  employee_id       uuid not null,
  payroll_result_id uuid not null unique,
  storage_path      text not null,        -- {company_id}/{period_id}/{employee_id}.pdf ใน bucket 'payslips'
  generated_at      timestamptz not null default now(),
  foreign key (payroll_result_id, company_id) references public.payroll_results (id, company_id),
  foreign key (payroll_period_id, company_id) references public.payroll_periods (id, company_id),
  foreign key (employee_id, company_id) references public.employees (id, company_id)
);
create index payslips_company_idx on public.payslips (company_id);
create index payslips_emp_idx on public.payslips (employee_id);

create table public.import_batches (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id),
  payroll_period_id uuid,
  import_type       text not null check (import_type in ('timesheet','adjustment','employee')),
  file_name         text not null,
  storage_path      text,
  status            text not null default 'uploaded'
                    check (status in ('uploaded','validated','failed','committed')),
  total_rows        integer not null default 0,
  valid_rows        integer not null default 0,
  error_rows        integer not null default 0,
  errors            jsonb,
  created_by        uuid default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (payroll_period_id, company_id) references public.payroll_periods (id, company_id)
);
create index import_batches_company_idx on public.import_batches (company_id, created_at desc);

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid,
  company_id  uuid,
  table_name  text not null,
  record_id   uuid,
  action      text not null,          -- INSERT / UPDATE / DELETE / ID_CARD_SET / ID_CARD_DECRYPT
  old_data    jsonb,
  new_data    jsonb
);
create index audit_logs_company_idx on public.audit_logs (company_id, occurred_at desc);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);

-- ---------------------------------------------------------------------
-- 6. Helper functions สำหรับ RLS (security definer เพื่อเลี่ยง recursion)
-- ---------------------------------------------------------------------

create or replace function private.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_members
    where user_id = (select auth.uid()) and role = 'super_admin' and is_active
  );
$$;

-- ทีม outsource (เห็นทุกบริษัท)
create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_members
    where user_id = (select auth.uid())
      and role in ('super_admin','payroll_admin') and is_active
  );
$$;

create or replace function private.is_company_hr(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_members
    where user_id = (select auth.uid())
      and role = 'client_hr' and company_id = cid and is_active
  );
$$;

create or replace function private.has_company_access(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_staff() or private.is_company_hr(cid);
$$;

-- พนักงานที่ login อยู่ ผูกกับ employee row นี้หรือไม่
create or replace function private.is_self(emp uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.employees
    where id = emp and user_id = (select auth.uid()) and deleted_at is null
  );
$$;

create or replace function private.is_employee_of(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.employees
    where company_id = cid and user_id = (select auth.uid()) and deleted_at is null
  );
$$;

create or replace function private.period_status(pid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select status from public.payroll_periods where id = pid;
$$;

-- ตรวจเลขบัตรประชาชนไทย 13 หลัก (checksum)
create or replace function private.is_valid_thai_id(p text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare s int := 0; i int;
begin
  if p is null or p !~ '^[0-9]{13}$' then return false; end if;
  for i in 1..12 loop
    s := s + substr(p, i, 1)::int * (14 - i);
  end loop;
  return ((11 - (s % 11)) % 10) = substr(p, 13, 1)::int;
end $$;

-- ---------------------------------------------------------------------
-- 7. Triggers: updated_at
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'companies','company_members','employees','employee_identity','employee_salaries',
    'employee_deductions','payroll_periods','employee_timesheets','payroll_adjustments',
    'statutory_rates','import_batches'
  ] loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function private.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. Audit trigger (บันทึกอัตโนมัติ: ใคร ทำอะไร เมื่อไร ค่าเดิม/ค่าใหม่)
-- ---------------------------------------------------------------------
create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  j_old jsonb; j_new jsonb; j jsonb; cid uuid; rid uuid;
begin
  if tg_op in ('UPDATE','DELETE') then j_old := to_jsonb(old); end if;
  if tg_op in ('INSERT','UPDATE') then j_new := to_jsonb(new); end if;

  -- ข้ามการ UPDATE ที่ไม่มีอะไรเปลี่ยนจริง (นอกจาก updated_at)
  if tg_op = 'UPDATE' and (j_old - 'updated_at') = (j_new - 'updated_at') then
    return null;
  end if;

  j := coalesce(j_new, j_old);
  begin
    rid := (j->>'id')::uuid;
    cid := case when tg_table_name = 'companies' then (j->>'id')::uuid
                else (j->>'company_id')::uuid end;
  exception when others then null;
  end;

  insert into public.audit_logs (actor_id, company_id, table_name, record_id, action, old_data, new_data)
  values ((select auth.uid()), cid, tg_table_name, rid, tg_op, j_old, j_new);

  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'companies','company_members','employees','employee_salaries','employee_deductions',
    'payroll_periods','employee_timesheets','payroll_adjustments','payroll_results',
    'payroll_period_approvals','payslips','statutory_rates','tax_brackets'
  ] loop
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$s
         for each row execute function private.audit_row()', t);
  end loop;
end $$;

-- audit_logs เป็น append-only: ห้ามแก้ไข/ลบ/truncate
create or replace function private.audit_logs_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs is append-only';
end $$;

create trigger trg_audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function private.audit_logs_immutable();
create trigger trg_audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function private.audit_logs_immutable();

-- ---------------------------------------------------------------------
-- 9. ล็อกงวด + บังคับ workflow
-- ---------------------------------------------------------------------

-- 9.1 ตารางลูกของงวด แก้ไขได้เฉพาะตอนงวดเป็น draft / calculated
create or replace function private.guard_period_open()
returns trigger language plpgsql security definer set search_path = '' as $$
declare j jsonb; st text;
begin
  if tg_op = 'DELETE' then j := to_jsonb(old); else j := to_jsonb(new); end if;
  select status into st from public.payroll_periods where id = (j->>'payroll_period_id')::uuid;
  if st is null or st not in ('draft','calculated') then
    raise exception 'payroll period is locked (status=%)', coalesce(st, 'unknown') using errcode = '55006';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'employee_timesheets','payroll_adjustments','payroll_results','payroll_result_items'
  ] loop
    execute format(
      'create trigger trg_%1$s_period_guard before insert or update or delete on public.%1$s
         for each row execute function private.guard_period_open()', t);
  end loop;
end $$;

-- 9.2 ตัวงวดเอง: ตรวจ transition และบังคับให้เปลี่ยนสถานะผ่าน RPC เท่านั้น
create or replace function private.guard_period_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if not ((old.status, new.status) in (
         ('draft','calculated'),
         ('calculated','draft'),
         ('calculated','client_reviewing'),
         ('client_reviewing','approved'),
         ('client_reviewing','draft'),
         ('approved','closed'))) then
      raise exception 'invalid status transition % -> %', old.status, new.status;
    end if;
    if coalesce(current_setting('app.via_rpc', true), '') <> '1' then
      raise exception 'status must be changed via change_payroll_period_status()';
    end if;
  elsif old.status in ('client_reviewing','approved','closed') then
    raise exception 'payroll period is locked (status=%)', old.status using errcode = '55006';
  end if;
  return new;
end $$;

create trigger trg_payroll_periods_guard before update on public.payroll_periods
  for each row execute function private.guard_period_update();

-- 9.3 RPC เปลี่ยนสถานะงวด + ตรวจสิทธิ์ + บันทึกประวัติการอนุมัติ
create or replace function public.change_payroll_period_status(
  p_period uuid, p_new_status text, p_note text default null
) returns public.payroll_periods
language plpgsql security definer set search_path = '' as $$
declare
  p public.payroll_periods;
  v_old text;
  v_staff boolean; v_hr boolean; v_sa boolean;
  v_action text;
begin
  select * into p from public.payroll_periods where id = p_period for update;
  if not found then
    raise exception 'payroll period not found' using errcode = 'P0002';
  end if;

  v_old   := p.status;
  v_staff := private.is_staff();
  v_hr    := private.is_company_hr(p.company_id);
  v_sa    := private.is_super_admin();

  if v_old = 'draft' and p_new_status = 'calculated' then
    if not v_staff then raise exception 'forbidden' using errcode = '42501'; end if;
    if not exists (select 1 from public.payroll_results where payroll_period_id = p.id) then
      raise exception 'no payroll results to mark as calculated';
    end if;
    v_action := 'calculated';

  elsif v_old = 'calculated' and p_new_status = 'draft' then
    if not v_staff then raise exception 'forbidden' using errcode = '42501'; end if;
    v_action := 'reopened';

  elsif v_old = 'calculated' and p_new_status = 'client_reviewing' then
    if not v_staff then raise exception 'forbidden' using errcode = '42501'; end if;
    v_action := 'submitted';

  elsif v_old = 'client_reviewing' and p_new_status = 'approved' then
    if not (v_hr or v_sa) then raise exception 'forbidden' using errcode = '42501'; end if;
    v_action := 'approved';

  elsif v_old = 'client_reviewing' and p_new_status = 'draft' then
    if not (v_hr or v_staff) then raise exception 'forbidden' using errcode = '42501'; end if;
    if p_note is null or length(trim(p_note)) = 0 then
      raise exception 'a note is required when rejecting a period';
    end if;
    v_action := 'rejected';

  elsif v_old = 'approved' and p_new_status = 'closed' then
    if not v_staff then raise exception 'forbidden' using errcode = '42501'; end if;
    v_action := 'closed';

  else
    raise exception 'invalid status transition % -> %', v_old, p_new_status;
  end if;

  perform set_config('app.via_rpc', '1', true);

  update public.payroll_periods set
    status       = p_new_status,
    submitted_at = case when p_new_status = 'client_reviewing' then now() else submitted_at end,
    approved_at  = case when p_new_status = 'approved' then now() else approved_at end,
    approved_by  = case when p_new_status = 'approved' then (select auth.uid()) else approved_by end,
    closed_at    = case when p_new_status = 'closed' then now() else closed_at end
  where id = p.id
  returning * into p;

  perform set_config('app.via_rpc', '', true);

  insert into public.payroll_period_approvals
    (company_id, payroll_period_id, action, from_status, to_status, note, acted_by)
  values (p.company_id, p.id, v_action, v_old, p_new_status, p_note, (select auth.uid()));

  return p;
end $$;

-- ---------------------------------------------------------------------
-- 10. เข้ารหัส/ถอดรหัสเลขบัตรประชาชน (ใช้ Supabase Vault เก็บกุญแจ)
--     สร้างกุญแจก่อนใช้งาน (ครั้งเดียว):
--       select vault.create_secret('<random-long-string>', 'id_card_key');
-- ---------------------------------------------------------------------
create or replace function public.set_employee_id_card(p_employee uuid, p_id_card text)
returns void language plpgsql security definer set search_path = '' as $$
declare k text; cid uuid;
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not private.is_valid_thai_id(p_id_card) then raise exception 'invalid thai national id'; end if;

  select decrypted_secret into k from vault.decrypted_secrets where name = 'id_card_key';
  if k is null then raise exception 'vault secret id_card_key not found'; end if;

  select company_id into cid from public.employees where id = p_employee;
  if cid is null then raise exception 'employee not found'; end if;

  insert into public.employee_identity (employee_id, company_id, id_card_encrypted)
  values (p_employee, cid, extensions.pgp_sym_encrypt(p_id_card, k))
  on conflict (employee_id) do update
    set id_card_encrypted = excluded.id_card_encrypted;

  update public.employees set id_card_last4 = right(p_id_card, 4) where id = p_employee;

  insert into public.audit_logs (actor_id, company_id, table_name, record_id, action)
  values ((select auth.uid()), cid, 'employee_identity', p_employee, 'ID_CARD_SET');
end $$;

create or replace function public.get_employee_id_card(p_employee uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare k text; v bytea; cid uuid;
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;

  select decrypted_secret into k from vault.decrypted_secrets where name = 'id_card_key';
  if k is null then raise exception 'vault secret id_card_key not found'; end if;

  select id_card_encrypted, company_id into v, cid
  from public.employee_identity where employee_id = p_employee;
  if v is null then return null; end if;

  insert into public.audit_logs (actor_id, company_id, table_name, record_id, action)
  values ((select auth.uid()), cid, 'employee_identity', p_employee, 'ID_CARD_DECRYPT');

  return extensions.pgp_sym_decrypt(v, k);
end $$;

-- ---------------------------------------------------------------------
-- 11. Row Level Security
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'companies','company_members','employees','employee_identity','employee_salaries',
    'employee_deductions','payroll_periods','employee_timesheets','payroll_adjustments',
    'statutory_rates','tax_brackets','payroll_results','payroll_result_items',
    'payroll_period_approvals','payslips','import_batches','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- companies
create policy companies_select on public.companies for select to authenticated
  using (private.has_company_access(id) or private.is_employee_of(id));
create policy companies_insert on public.companies for insert to authenticated
  with check (private.is_staff());
create policy companies_update on public.companies for update to authenticated
  using (private.is_staff()) with check (private.is_staff());

-- company_members: ดูของตัวเองได้, ทีม payroll ดูทั้งหมด, แก้ไขได้เฉพาะ super_admin
create policy members_select on public.company_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_staff());
create policy members_insert on public.company_members for insert to authenticated
  with check (private.is_super_admin());
create policy members_update on public.company_members for update to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());
create policy members_delete on public.company_members for delete to authenticated
  using (private.is_super_admin());

-- employees
create policy employees_select on public.employees for select to authenticated
  using (private.has_company_access(company_id) or user_id = (select auth.uid()));
create policy employees_insert on public.employees for insert to authenticated
  with check (private.is_staff());
create policy employees_update on public.employees for update to authenticated
  using (private.is_staff()) with check (private.is_staff());

-- employee_identity: ทีม payroll เท่านั้น (แนะนำให้ใช้ผ่าน function)
create policy identity_select on public.employee_identity for select to authenticated
  using (private.is_staff());

-- employee_salaries / employee_deductions
create policy salaries_select on public.employee_salaries for select to authenticated
  using (private.has_company_access(company_id) or private.is_self(employee_id));
create policy salaries_insert on public.employee_salaries for insert to authenticated
  with check (private.is_staff());
create policy salaries_update on public.employee_salaries for update to authenticated
  using (private.is_staff()) with check (private.is_staff());

create policy deductions_select on public.employee_deductions for select to authenticated
  using (private.has_company_access(company_id) or private.is_self(employee_id));
create policy deductions_insert on public.employee_deductions for insert to authenticated
  with check (private.is_staff());
create policy deductions_update on public.employee_deductions for update to authenticated
  using (private.is_staff()) with check (private.is_staff());

-- payroll_periods: HR ลูกค้าเห็นของบริษัทตัวเอง / พนักงานเห็นเฉพาะงวดที่อนุมัติแล้ว
-- (การเปลี่ยนสถานะทำผ่าน change_payroll_period_status เท่านั้น)
create policy periods_select on public.payroll_periods for select to authenticated
  using (
    private.has_company_access(company_id)
    or (private.is_employee_of(company_id) and status in ('approved','closed'))
  );
create policy periods_insert on public.payroll_periods for insert to authenticated
  with check (private.is_staff());
create policy periods_update on public.payroll_periods for update to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy periods_delete on public.payroll_periods for delete to authenticated
  using (private.is_staff() and status = 'draft');

-- timesheets / adjustments: ทีม payroll แก้ไข, HR ลูกค้าอ่านได้
create policy timesheets_select on public.employee_timesheets for select to authenticated
  using (private.has_company_access(company_id));
create policy timesheets_insert on public.employee_timesheets for insert to authenticated
  with check (private.is_staff());
create policy timesheets_update on public.employee_timesheets for update to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy timesheets_delete on public.employee_timesheets for delete to authenticated
  using (private.is_staff());

create policy adjustments_select on public.payroll_adjustments for select to authenticated
  using (private.has_company_access(company_id));
create policy adjustments_insert on public.payroll_adjustments for insert to authenticated
  with check (private.is_staff());
create policy adjustments_update on public.payroll_adjustments for update to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy adjustments_delete on public.payroll_adjustments for delete to authenticated
  using (private.is_staff());

-- statutory_rates / tax_brackets: ทุกคนที่ login อ่านได้, แก้ไขได้เฉพาะ super_admin
create policy rates_select on public.statutory_rates for select to authenticated using (true);
create policy rates_write  on public.statutory_rates for all to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());
create policy brackets_select on public.tax_brackets for select to authenticated using (true);
create policy brackets_write  on public.tax_brackets for all to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());

-- payroll_results / items
--   ทีม payroll: เห็นทั้งหมด
--   HR ลูกค้า : เห็นตั้งแต่ส่งตรวจสอบ (client_reviewing) เป็นต้นไป
--   พนักงาน   : เห็นของตัวเองเมื่อ approved / closed เท่านั้น
create policy results_select on public.payroll_results for select to authenticated
  using (
    private.is_staff()
    or (private.is_company_hr(company_id)
        and private.period_status(payroll_period_id) in ('client_reviewing','approved','closed'))
    or (private.is_self(employee_id)
        and private.period_status(payroll_period_id) in ('approved','closed'))
  );
create policy results_insert on public.payroll_results for insert to authenticated
  with check (private.is_staff());
create policy results_update on public.payroll_results for update to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy results_delete on public.payroll_results for delete to authenticated
  using (private.is_staff());

create policy result_items_select on public.payroll_result_items for select to authenticated
  using (
    private.is_staff()
    or (private.is_company_hr(company_id)
        and private.period_status(payroll_period_id) in ('client_reviewing','approved','closed'))
    or (private.is_self(employee_id)
        and private.period_status(payroll_period_id) in ('approved','closed'))
  );
create policy result_items_insert on public.payroll_result_items for insert to authenticated
  with check (private.is_staff());
create policy result_items_update on public.payroll_result_items for update to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy result_items_delete on public.payroll_result_items for delete to authenticated
  using (private.is_staff());

-- approvals: อ่านอย่างเดียว (เขียนผ่าน RPC)
create policy approvals_select on public.payroll_period_approvals for select to authenticated
  using (private.has_company_access(company_id));

-- payslips
create policy payslips_select on public.payslips for select to authenticated
  using (private.has_company_access(company_id) or private.is_self(employee_id));
create policy payslips_insert on public.payslips for insert to authenticated
  with check (private.is_staff());
create policy payslips_update on public.payslips for update to authenticated
  using (private.is_staff()) with check (private.is_staff());

-- import_batches
create policy imports_select on public.import_batches for select to authenticated
  using (private.has_company_access(company_id));
create policy imports_insert on public.import_batches for insert to authenticated
  with check (private.is_staff());
create policy imports_update on public.import_batches for update to authenticated
  using (private.is_staff()) with check (private.is_staff());

-- audit_logs: อ่านอย่างเดียว (ทีม payroll ทั้งหมด / HR เฉพาะบริษัทตัวเอง)
create policy audit_select on public.audit_logs for select to authenticated
  using (private.is_staff() or (company_id is not null and private.is_company_hr(company_id)));

-- ---------------------------------------------------------------------
-- 12. สิทธิ์ระดับตาราง/ฟังก์ชัน (defense in depth)
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke insert, update, delete, truncate on public.audit_logs from authenticated;
revoke insert, update, delete, truncate on public.payroll_period_approvals from authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.change_payroll_period_status(uuid, text, text) to authenticated;
grant execute on function public.set_employee_id_card(uuid, text)               to authenticated;
grant execute on function public.get_employee_id_card(uuid)                     to authenticated;

-- ---------------------------------------------------------------------
-- 13. ตัวอย่างข้อมูลอัตราตามกฎหมาย (ปิดไว้ — ตรวจสอบค่าปัจจุบันจากประกันสังคม/สรรพากรก่อนเปิดใช้)
-- ---------------------------------------------------------------------
-- insert into public.statutory_rates (code, value, effective_from, description) values
--   ('ss_employee_rate', 0.05,  '2026-01-01', 'อัตราประกันสังคมฝั่งลูกจ้าง'),
--   ('ss_employer_rate', 0.05,  '2026-01-01', 'อัตราประกันสังคมฝั่งนายจ้าง'),
--   ('ss_wage_floor',    1650,  '2026-01-01', 'ค่าจ้างขั้นต่ำที่ใช้คำนวณ'),
--   ('ss_wage_cap',      15000, '2026-01-01', 'ค่าจ้างสูงสุดที่ใช้คำนวณ');
--
-- insert into public.tax_brackets (effective_from, income_from, income_to, rate) values
--   ('2026-01-01', 0,       150000,  0.00),
--   ('2026-01-01', 150000,  300000,  0.05),
--   ('2026-01-01', 300000,  500000,  0.10),
--   ('2026-01-01', 500000,  750000,  0.15),
--   ('2026-01-01', 750000,  1000000, 0.20),
--   ('2026-01-01', 1000000, 2000000, 0.25),
--   ('2026-01-01', 2000000, 5000000, 0.30),
--   ('2026-01-01', 5000000, null,    0.35);

-- ---------------------------------------------------------------------
-- 14. สร้าง super_admin คนแรก (รันด้วยมือ หลังสมัคร user แล้ว แทน UUID ของ user)
-- ---------------------------------------------------------------------
-- insert into public.company_members (user_id, role)
-- values ('<AUTH_USER_UUID>', 'super_admin');

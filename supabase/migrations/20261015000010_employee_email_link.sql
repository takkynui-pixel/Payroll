-- =====================================================================
-- 010: ผูกบัญชีล็อกอินกับพนักงานด้วย "อีเมล" (ไม่ต้องสร้างบัญชีที่ Dashboard)
--   - claim_employee_account(): ผู้ใช้ที่ล็อกอินแล้ว (อีเมลยืนยันแล้ว) ผูกกับพนักงานที่ employees.email ตรงกันโดยอัตโนมัติ
--   - link_employee_by_email(): ทีม payroll สั่งผูกพนักงานกับบัญชีที่มีอยู่แล้ว (อีเมลตรงกับ employees.email)
--   - unlink_employee_account(): เปิดให้ทีม payroll (เดิมเฉพาะ super_admin) ยกเลิกการผูกได้
-- ไม่ใช้ service_role  รันซ้ำได้  ต้องรันหลัง 004
-- =====================================================================

-- ผู้ใช้ผูกตัวเอง: ต้องมีบัญชีที่ยืนยันอีเมลแล้ว และมีพนักงานที่ยังไม่ผูกอีเมลตรงกันเพียง 1 รายการ
-- คืนค่า: linked | already | none | ambiguous | unverified | no_user
create or replace function public.claim_employee_account()
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_ids   uuid[];
begin
  if v_uid is null then
    return 'no_user';
  end if;
  if exists (select 1 from public.employees where user_id = v_uid and deleted_at is null) then
    return 'already';
  end if;

  select lower(btrim(u.email)) into v_email
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null or v_email = '' then
    return 'unverified';
  end if;

  select array_agg(e.id) into v_ids
  from public.employees e
  where lower(btrim(e.email)) = v_email
    and e.user_id is null
    and e.deleted_at is null
    and e.employment_status in ('active', 'resigned');

  if v_ids is null then
    return 'none';
  end if;
  if array_length(v_ids, 1) > 1 then
    return 'ambiguous';  -- อีเมลเดียวกันซ้ำหลายพนักงาน ต้องให้ทีม payroll ผูกเอง
  end if;

  update public.employees set user_id = v_uid, updated_at = now() where id = v_ids[1];
  return 'linked';
exception
  when unique_violation then
    return 'already';
end;
$$;

-- ทีม payroll ผูกพนักงานกับบัญชีที่มีอยู่แล้ว โดยใช้อีเมลที่บันทึกในข้อมูลพนักงาน
create or replace function public.link_employee_by_email(p_employee uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_emp  public.employees;
  v_user uuid;
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_emp from public.employees where id = p_employee and deleted_at is null for update;
  if not found then
    raise exception 'employee_not_found' using errcode = 'P0002';
  end if;
  if v_emp.user_id is not null then
    raise exception 'already_linked' using errcode = 'P0001';
  end if;
  if v_emp.email is null or btrim(v_emp.email) = '' then
    raise exception 'no_email' using errcode = 'P0001';
  end if;

  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(v_emp.email)) limit 1;
  if v_user is null then
    return 'no_account';  -- ยังไม่มีบัญชี: พนักงานล็อกอินด้วยรหัสทางอีเมลครั้งแรก ระบบจะผูกให้เอง
  end if;

  update public.employees set user_id = v_user, updated_at = now() where id = v_emp.id;
  return 'linked';
end;
$$;

create or replace function public.unlink_employee_account(p_employee uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.employees set user_id = null, updated_at = now()
  where id = p_employee and user_id is not null and deleted_at is null;
  if not found then
    raise exception 'employee_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- อีเมลของพนักงานที่ยังทำงานอยู่ต้องไม่ซ้ำกัน (ใช้ผูกบัญชี) ถ้ามีข้อมูลเดิมซ้ำ ข้ามการสร้าง index และแจ้งเตือน
do $$
begin
  if exists (
    select 1 from public.employees
    where deleted_at is null and email is not null and btrim(email) <> ''
    group by lower(btrim(email)) having count(*) > 1
  ) then
    raise warning 'employees: พบอีเมลซ้ำในข้อมูลเดิม ยังไม่สร้าง employees_email_uq แก้ข้อมูลซ้ำแล้วรัน migration นี้อีกครั้ง';
  else
    create unique index if not exists employees_email_uq
      on public.employees (lower(btrim(email)))
      where deleted_at is null and email is not null and btrim(email) <> '';
  end if;
end
$$;

revoke execute on function public.claim_employee_account()            from public, anon;
revoke execute on function public.link_employee_by_email(uuid)        from public, anon;
revoke execute on function public.unlink_employee_account(uuid)       from public, anon;
grant  execute on function public.claim_employee_account()            to authenticated;
grant  execute on function public.link_employee_by_email(uuid)        to authenticated;
grant  execute on function public.unlink_employee_account(uuid)       to authenticated;

-- =====================================================================
-- 004: จัดการผู้ใช้และสิทธิ์จากในแอป (ไม่ใช้ service_role)
--
-- การสร้างบัญชีล็อกอินยังทำที่ Supabase Dashboard (Authentication -> Users)
-- ส่วนการให้บทบาท/ระงับ/ถอน/ผูกบัญชีพนักงาน ทำผ่านฟังก์ชันด้านล่าง
-- ทุกฟังก์ชันเช็ค super_admin เองภายในฟังก์ชัน และ audit trigger เดิมบันทึกผู้ทำให้อัตโนมัติ
-- (ฟังก์ชัน security definer อ่าน auth.users ได้ ส่วนผู้ใช้ทั่วไปอ่านไม่ได้)
--
-- รันซ้ำได้ (create or replace)
-- =====================================================================

-- รายการสิทธิ์ทั้งหมด: สมาชิก (company_members) + บัญชีพนักงานที่ผูกไว้ (employees.user_id)
create or replace function public.list_access()
returns table (
  kind text,            -- 'member' | 'employee'
  ref_id uuid,          -- company_members.id หรือ employees.id
  user_id uuid,
  email text,
  role text,
  company_id uuid,
  company_name text,
  display_name text,    -- ชื่อพนักงาน (kind = employee)
  is_active boolean,
  last_sign_in_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select 'member'::text, m.id, m.user_id, u.email::text, m.role, m.company_id, c.name,
         null::text, m.is_active, u.last_sign_in_at
  from public.company_members m
  join auth.users u on u.id = m.user_id
  left join public.companies c on c.id = m.company_id
  union all
  select 'employee'::text, e.id, e.user_id, u.email::text, 'employee'::text, e.company_id, c.name,
         btrim(coalesce(e.title, '') || e.first_name || ' ' || e.last_name), true, u.last_sign_in_at
  from public.employees e
  join auth.users u on u.id = e.user_id
  left join public.companies c on c.id = e.company_id
  where e.deleted_at is null;
end;
$$;

-- ให้บทบาทแก่บัญชีที่มีอยู่แล้ว (หาจากอีเมล) ถ้าเคยมีแล้วแต่ถูกระงับจะเปิดใช้ใหม่
create or replace function public.add_member(p_email text, p_role text, p_company uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_company uuid := p_company;
  v_id uuid;
begin
  if not private.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('super_admin', 'payroll_admin', 'client_hr') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if p_role = 'client_hr' and v_company is null then
    raise exception 'company_required' using errcode = '22023';
  end if;
  if p_role <> 'client_hr' then
    v_company := null;  -- ทีม outsource เห็นทุกบริษัท
  end if;
  if v_company is not null
     and not exists (select 1 from public.companies where id = v_company and deleted_at is null) then
    raise exception 'company_not_found' using errcode = 'P0002';
  end if;

  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
  if v_user is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  select m.id into v_id
  from public.company_members m
  where m.user_id = v_user and m.role = p_role and m.company_id is not distinct from v_company;

  if v_id is not null then
    update public.company_members set is_active = true, updated_at = now() where id = v_id;
  else
    insert into public.company_members (user_id, company_id, role)
    values (v_user, v_company, p_role)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- ระงับ/เปิดใช้สิทธิ์ (ห้ามทำกับสิทธิ์ของตัวเอง และห้ามระงับ super_admin คนสุดท้าย)
create or replace function public.set_member_active(p_member uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.company_members;
begin
  if not private.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into m from public.company_members where id = p_member for update;
  if not found then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if m.user_id = (select auth.uid()) then
    raise exception 'self_change' using errcode = 'P0001';
  end if;
  if not p_active and m.role = 'super_admin' and m.is_active
     and (select count(*) from public.company_members
          where role = 'super_admin' and is_active and id <> m.id) = 0 then
    raise exception 'last_super_admin' using errcode = 'P0001';
  end if;
  update public.company_members set is_active = p_active, updated_at = now() where id = p_member;
end;
$$;

-- ถอนสิทธิ์ถาวร (ข้อจำกัดเดียวกับ set_member_active; ประวัติยังอยู่ใน audit_logs)
create or replace function public.remove_member(p_member uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.company_members;
begin
  if not private.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into m from public.company_members where id = p_member for update;
  if not found then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if m.user_id = (select auth.uid()) then
    raise exception 'self_change' using errcode = 'P0001';
  end if;
  if m.role = 'super_admin' and m.is_active
     and (select count(*) from public.company_members
          where role = 'super_admin' and is_active and id <> m.id) = 0 then
    raise exception 'last_super_admin' using errcode = 'P0001';
  end if;
  delete from public.company_members where id = p_member;
end;
$$;

-- ผูกบัญชีล็อกอินกับพนักงาน (หาพนักงานจากบริษัท + รหัสพนักงาน) เพื่อให้เปิดสลิปของตัวเองได้
create or replace function public.link_employee_account(p_company uuid, p_employee_code text, p_email text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_emp public.employees;
  v_user uuid;
begin
  if not private.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_emp
  from public.employees e
  where e.company_id = p_company and e.employee_code = btrim(p_employee_code) and e.deleted_at is null
  for update;
  if not found then
    raise exception 'employee_not_found' using errcode = 'P0002';
  end if;
  if v_emp.user_id is not null then
    raise exception 'already_linked' using errcode = 'P0001';
  end if;

  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
  if v_user is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  -- 1 บัญชีผูกได้ 1 พนักงาน: ถ้าซ้ำ unique index employees_user_uq จะโยน 23505
  update public.employees set user_id = v_user, updated_at = now() where id = v_emp.id;
  return v_emp.id;
end;
$$;

create or replace function public.unlink_employee_account(p_employee uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.employees set user_id = null, updated_at = now()
  where id = p_employee and user_id is not null and deleted_at is null;
  if not found then
    raise exception 'employee_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.list_access()                                   from public, anon;
revoke execute on function public.add_member(text, text, uuid)                    from public, anon;
revoke execute on function public.set_member_active(uuid, boolean)               from public, anon;
revoke execute on function public.remove_member(uuid)                            from public, anon;
revoke execute on function public.link_employee_account(uuid, text, text)        from public, anon;
revoke execute on function public.unlink_employee_account(uuid)                  from public, anon;

grant execute on function public.list_access()                                    to authenticated;
grant execute on function public.add_member(text, text, uuid)                     to authenticated;
grant execute on function public.set_member_active(uuid, boolean)                to authenticated;
grant execute on function public.remove_member(uuid)                             to authenticated;
grant execute on function public.link_employee_account(uuid, text, text)         to authenticated;
grant execute on function public.unlink_employee_account(uuid)                   to authenticated;

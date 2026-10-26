-- =====================================================================
-- 011: รายงานนำส่งธนาคาร (ไฟล์ text โอนเงินเดือน)
--   - บัญชีต้นทาง (บัญชีบริษัทที่ตัดเงิน) + รูปแบบไฟล์ที่ใช้ ต่อบริษัท
--   - ฟังก์ชันบันทึกประวัติการออกไฟล์ลง audit_logs (ใครออกไฟล์ จำนวนกี่ราย ยอดรวมเท่าไร)
-- ใช้ RLS เดิมของ companies (เฉพาะทีม payroll แก้ได้) รันซ้ำได้
-- =====================================================================
alter table public.companies
  add column if not exists pay_bank_code        text,
  add column if not exists pay_bank_account_no  text check (pay_bank_account_no ~ '^[0-9]{10,15}$'),
  add column if not exists pay_account_name     text,
  add column if not exists bank_customer_id     text,
  add column if not exists bank_file_format     text not null default 'csv'
                           check (bank_file_format in ('csv','fixed_tis620'));

create or replace function public.log_bank_file_export(
  p_period uuid, p_format text, p_count integer, p_total_satang bigint, p_bank text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid; st text;
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  select company_id, status into cid, st from public.payroll_periods where id = p_period;
  if cid is null then raise exception 'period not found'; end if;
  if st not in ('approved','closed') then raise exception 'period not approved' using errcode = '22023'; end if;

  insert into public.audit_logs (actor_id, company_id, table_name, record_id, action, new_data)
  values ((select auth.uid()), cid, 'payroll_periods', p_period, 'BANK_FILE_EXPORT',
          jsonb_build_object('format', p_format, 'bank', p_bank, 'count', p_count, 'total_satang', p_total_satang));
end $$;

revoke all on function public.log_bank_file_export(uuid, text, integer, bigint, text) from public, anon;
grant execute on function public.log_bank_file_export(uuid, text, integer, bigint, text) to authenticated;

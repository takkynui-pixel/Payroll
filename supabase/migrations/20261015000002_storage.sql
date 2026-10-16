-- =====================================================================
-- 002_storage.sql  (รันหลัง 001_payroll_core.sql)
-- Storage buckets + policies สำหรับสลิปเงินเดือนและไฟล์นำเข้า
--
-- โครงสร้าง path:
--   payslips/{company_id}/{period_id}/{employee_id}.pdf
--   imports/{company_id}/{batch_id}/{file_name}
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('payslips', 'payslips', false),
       ('imports',  'imports',  false)
on conflict (id) do nothing;

-- ---------- payslips ----------
-- ทีม payroll: อ่าน/เขียนทั้งหมด
create policy payslips_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'payslips' and private.is_staff())
  with check (bucket_id = 'payslips' and private.is_staff());

-- HR ลูกค้า: อ่านเฉพาะโฟลเดอร์บริษัทตัวเอง
create policy payslips_hr_read on storage.objects for select to authenticated
  using (
    bucket_id = 'payslips'
    and exists (
      select 1 from public.company_members m
      where m.user_id = (select auth.uid())
        and m.role = 'client_hr' and m.is_active
        and m.company_id::text = (storage.foldername(name))[1]
    )
  );

-- พนักงาน: อ่านเฉพาะสลิปของตัวเอง (โฟลเดอร์ระดับ 3 = employee_id)
create policy payslips_self_read on storage.objects for select to authenticated
  using (
    bucket_id = 'payslips'
    and exists (
      select 1 from public.employees e
      where e.user_id = (select auth.uid())
        and e.deleted_at is null
        and e.id::text = (storage.foldername(name))[3]
    )
  );

-- ---------- imports ----------
create policy imports_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'imports' and private.is_staff())
  with check (bucket_id = 'imports' and private.is_staff());

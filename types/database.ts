/**
 * Types ของฐานข้อมูล Payroll-VTA (สร้างจาก Supabase generate_typescript_types)
 *
 * หมายเหตุ: ส่วนที่มีเครื่องหมาย [PENDING 003] คือ employee_tax_profiles และ save_payroll_results
 * เพิ่มด้วยมือตาม migration 20261015000003 ที่ "ยังไม่ได้ apply" กับฐานข้อมูลจริง
 * หลัง apply แล้วให้สร้างไฟล์นี้ใหม่ทั้งไฟล์:
 *   npx supabase gen types typescript --project-id jmddftqdpctymfliutot > types/database.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          company_id: string | null;
          id: number;
          new_data: Json | null;
          occurred_at: string;
          old_data: Json | null;
          record_id: string | null;
          table_name: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          company_id?: string | null;
          id?: never;
          new_data?: Json | null;
          occurred_at?: string;
          old_data?: Json | null;
          record_id?: string | null;
          table_name: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          company_id?: string | null;
          id?: never;
          new_data?: Json | null;
          occurred_at?: string;
          old_data?: Json | null;
          record_id?: string | null;
          table_name?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          address: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_active: boolean;
          name: string;
          pay_cycle_type: string;
          ss_account_no: string | null;
          tax_id: string | null;
          updated_at: string;
          branch_no: string | null;
          addr_building: string | null;
          wcf_account_no: string | null;
          wcf_business_code: string | null;
          wcf_rate: number;
          /** [PENDING 011] */
          pay_bank_code: string | null;
          pay_bank_account_no: string | null;
          pay_account_name: string | null;
          bank_customer_id: string | null;
          bank_file_format: string;
          addr_moo: string | null;
          addr_soi: string | null;
          addr_road: string | null;
          addr_subdistrict: string | null;
          addr_district: string | null;
          addr_province: string | null;
          addr_postcode: string | null;
          phone: string | null;
          signer_name: string | null;
          signer_position: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          pay_cycle_type?: string;
          ss_account_no?: string | null;
          tax_id?: string | null;
          updated_at?: string;
          branch_no?: string | null;
          addr_building?: string | null;
          wcf_account_no?: string | null;
          wcf_business_code?: string | null;
          wcf_rate?: number;
          pay_bank_code?: string | null;
          pay_bank_account_no?: string | null;
          pay_account_name?: string | null;
          bank_customer_id?: string | null;
          bank_file_format?: string;
          addr_moo?: string | null;
          addr_soi?: string | null;
          addr_road?: string | null;
          addr_subdistrict?: string | null;
          addr_district?: string | null;
          addr_province?: string | null;
          addr_postcode?: string | null;
          phone?: string | null;
          signer_name?: string | null;
          signer_position?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          pay_cycle_type?: string;
          ss_account_no?: string | null;
          tax_id?: string | null;
          updated_at?: string;
          branch_no?: string | null;
          addr_building?: string | null;
          wcf_account_no?: string | null;
          wcf_business_code?: string | null;
          wcf_rate?: number;
          pay_bank_code?: string | null;
          pay_bank_account_no?: string | null;
          pay_account_name?: string | null;
          bank_customer_id?: string | null;
          bank_file_format?: string;
          addr_moo?: string | null;
          addr_soi?: string | null;
          addr_road?: string | null;
          addr_subdistrict?: string | null;
          addr_district?: string | null;
          addr_province?: string | null;
          addr_postcode?: string | null;
          phone?: string | null;
          signer_name?: string | null;
          signer_position?: string | null;
        };
        Relationships: [];
      };
      company_members: {
        Row: {
          company_id: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          company_id?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          role: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      employee_deductions: {
        Row: {
          amount: number;
          company_id: string;
          created_at: string;
          deduction_type: string;
          employee_id: string;
          end_date: string | null;
          id: string;
          is_active: boolean;
          item_name: string;
          start_date: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          company_id: string;
          created_at?: string;
          deduction_type: string;
          employee_id: string;
          end_date?: string | null;
          id?: string;
          is_active?: boolean;
          item_name: string;
          start_date: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          company_id?: string;
          created_at?: string;
          deduction_type?: string;
          employee_id?: string;
          end_date?: string | null;
          id?: string;
          is_active?: boolean;
          item_name?: string;
          start_date?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employee_deductions_employee_id_company_id_fkey";
            columns: ["employee_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      employee_identity: {
        Row: {
          company_id: string;
          created_at: string;
          employee_id: string;
          id_card_encrypted: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          employee_id: string;
          id_card_encrypted: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          employee_id?: string;
          id_card_encrypted?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employee_identity_employee_id_company_id_fkey";
            columns: ["employee_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      employee_salaries: {
        Row: {
          base_salary: number;
          company_id: string;
          created_at: string;
          created_by: string | null;
          effective_date: string;
          employee_id: string;
          end_date: string | null;
          id: string;
          note: string | null;
          pay_type: string;
          social_security_deduct: boolean;
          tax_deduct_type: string;
          updated_at: string;
        };
        Insert: {
          base_salary: number;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          effective_date: string;
          employee_id: string;
          end_date?: string | null;
          id?: string;
          note?: string | null;
          pay_type?: string;
          social_security_deduct?: boolean;
          tax_deduct_type?: string;
          updated_at?: string;
        };
        Update: {
          base_salary?: number;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          effective_date?: string;
          employee_id?: string;
          end_date?: string | null;
          id?: string;
          note?: string | null;
          pay_type?: string;
          social_security_deduct?: boolean;
          tax_deduct_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employee_salaries_employee_id_company_id_fkey";
            columns: ["employee_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      /** [PENDING 003] ยังไม่มีในฐานข้อมูลจริงจนกว่าจะ apply migration 20261015000003 */
      employee_tax_profiles: {
        Row: {
          company_id: string;
          created_at: string;
          employee_id: string;
          id: string;
          note: string | null;
          other_allowances_annual: number;
          tax_year: number;
          updated_at: string;
          ytd_opening_social_security: number;
          ytd_opening_tax: number;
          ytd_opening_taxable: number;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          employee_id: string;
          id?: string;
          note?: string | null;
          other_allowances_annual?: number;
          tax_year: number;
          updated_at?: string;
          ytd_opening_social_security?: number;
          ytd_opening_tax?: number;
          ytd_opening_taxable?: number;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          employee_id?: string;
          id?: string;
          note?: string | null;
          other_allowances_annual?: number;
          tax_year?: number;
          updated_at?: string;
          ytd_opening_social_security?: number;
          ytd_opening_tax?: number;
          ytd_opening_taxable?: number;
        };
        Relationships: [
          {
            foreignKeyName: "employee_tax_profiles_employee_id_company_id_fkey";
            columns: ["employee_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      employee_timesheets: {
        Row: {
          absence_days: number;
          company_id: string;
          created_at: string;
          employee_id: string;
          id: string;
          import_batch_id: string | null;
          late_minutes: number;
          ot_hours_1_0: number;
          ot_hours_1_5: number;
          ot_hours_2_0: number;
          ot_hours_2_5: number;
          ot_hours_3_0: number;
          payroll_period_id: string;
          updated_at: string;
          working_days: number;
          absence_minutes: number;
          early_leave_minutes: number;
          leave_unpaid_minutes: number;
          ot_minutes_1_0: number;
          ot_minutes_1_5: number;
          ot_minutes_2_0: number;
          ot_minutes_2_5: number;
          ot_minutes_3_0: number;
          working_minutes: number;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          employee_id: string;
          id?: string;
          import_batch_id?: string | null;
          late_minutes?: number;
          payroll_period_id: string;
          updated_at?: string;
          absence_minutes?: number;
          early_leave_minutes?: number;
          leave_unpaid_minutes?: number;
          ot_minutes_1_0?: number;
          ot_minutes_1_5?: number;
          ot_minutes_2_0?: number;
          ot_minutes_2_5?: number;
          ot_minutes_3_0?: number;
          working_minutes?: number;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          employee_id?: string;
          id?: string;
          import_batch_id?: string | null;
          late_minutes?: number;
          payroll_period_id?: string;
          updated_at?: string;
          absence_minutes?: number;
          early_leave_minutes?: number;
          leave_unpaid_minutes?: number;
          ot_minutes_1_0?: number;
          ot_minutes_1_5?: number;
          ot_minutes_2_0?: number;
          ot_minutes_2_5?: number;
          ot_minutes_3_0?: number;
          working_minutes?: number;
        };
        Relationships: [
          {
            foreignKeyName: "employee_timesheets_employee_id_company_id_fkey";
            columns: ["employee_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "employee_timesheets_payroll_period_id_company_id_fkey";
            columns: ["payroll_period_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "payroll_periods";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      employees: {
        Row: {
          bank_account_no: string | null;
          bank_code: string | null;
          company_id: string;
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          employee_code: string;
          employment_status: string;
          first_name: string;
          hire_date: string;
          id: string;
          id_card_last4: string | null;
          last_name: string;
          phone: string | null;
          termination_date: string | null;
          title: string | null;
          updated_at: string;
          user_id: string | null;
          address: string | null;
        };
        Insert: {
          bank_account_no?: string | null;
          bank_code?: string | null;
          company_id: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          employee_code: string;
          employment_status?: string;
          first_name: string;
          hire_date: string;
          id?: string;
          id_card_last4?: string | null;
          last_name: string;
          phone?: string | null;
          termination_date?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string | null;
          address?: string | null;
        };
        Update: {
          bank_account_no?: string | null;
          bank_code?: string | null;
          company_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          employee_code?: string;
          employment_status?: string;
          first_name?: string;
          hire_date?: string;
          id?: string;
          id_card_last4?: string | null;
          last_name?: string;
          phone?: string | null;
          termination_date?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string | null;
          address?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      import_batches: {
        Row: {
          company_id: string;
          created_at: string;
          created_by: string | null;
          error_rows: number;
          errors: Json | null;
          file_name: string;
          id: string;
          import_type: string;
          payroll_period_id: string | null;
          status: string;
          storage_path: string | null;
          total_rows: number;
          updated_at: string;
          valid_rows: number;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          error_rows?: number;
          errors?: Json | null;
          file_name: string;
          id?: string;
          import_type: string;
          payroll_period_id?: string | null;
          status?: string;
          storage_path?: string | null;
          total_rows?: number;
          updated_at?: string;
          valid_rows?: number;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          error_rows?: number;
          errors?: Json | null;
          file_name?: string;
          id?: string;
          import_type?: string;
          payroll_period_id?: string | null;
          status?: string;
          storage_path?: string | null;
          total_rows?: number;
          updated_at?: string;
          valid_rows?: number;
        };
        Relationships: [
          {
            foreignKeyName: "import_batches_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_batches_payroll_period_id_company_id_fkey";
            columns: ["payroll_period_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "payroll_periods";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      payroll_adjustments: {
        Row: {
          adjustment_type: string;
          amount: number;
          company_id: string;
          created_at: string;
          employee_id: string;
          id: string;
          import_batch_id: string | null;
          is_ss_base: boolean;
          is_taxable: boolean;
          item_name: string;
          note: string | null;
          payroll_period_id: string;
          updated_at: string;
        };
        Insert: {
          adjustment_type: string;
          amount: number;
          company_id: string;
          created_at?: string;
          employee_id: string;
          id?: string;
          import_batch_id?: string | null;
          is_ss_base?: boolean;
          is_taxable?: boolean;
          item_name: string;
          note?: string | null;
          payroll_period_id: string;
          updated_at?: string;
        };
        Update: {
          adjustment_type?: string;
          amount?: number;
          company_id?: string;
          created_at?: string;
          employee_id?: string;
          id?: string;
          import_batch_id?: string | null;
          is_ss_base?: boolean;
          is_taxable?: boolean;
          item_name?: string;
          note?: string | null;
          payroll_period_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_adjustments_employee_id_company_id_fkey";
            columns: ["employee_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "payroll_adjustments_payroll_period_id_company_id_fkey";
            columns: ["payroll_period_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "payroll_periods";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      payroll_period_approvals: {
        Row: {
          acted_at: string;
          acted_by: string | null;
          action: string;
          company_id: string;
          from_status: string;
          id: string;
          note: string | null;
          payroll_period_id: string;
          to_status: string;
        };
        Insert: {
          acted_at?: string;
          acted_by?: string | null;
          action: string;
          company_id: string;
          from_status: string;
          id?: string;
          note?: string | null;
          payroll_period_id: string;
          to_status: string;
        };
        Update: {
          acted_at?: string;
          acted_by?: string | null;
          action?: string;
          company_id?: string;
          from_status?: string;
          id?: string;
          note?: string | null;
          payroll_period_id?: string;
          to_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_period_approvals_payroll_period_id_company_id_fkey";
            columns: ["payroll_period_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "payroll_periods";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      payroll_periods: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          closed_at: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          end_date: string;
          id: string;
          pay_date: string;
          period_name: string;
          start_date: string;
          status: string;
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          closed_at?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          end_date: string;
          id?: string;
          pay_date: string;
          period_name: string;
          start_date: string;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          closed_at?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          end_date?: string;
          id?: string;
          pay_date?: string;
          period_name?: string;
          start_date?: string;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_periods_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_result_items: {
        Row: {
          amount: number;
          code: string;
          company_id: string;
          employee_id: string;
          id: string;
          item_name: string;
          item_type: string;
          payroll_period_id: string;
          payroll_result_id: string;
          sort_order: number;
        };
        Insert: {
          amount: number;
          code: string;
          company_id: string;
          employee_id: string;
          id?: string;
          item_name: string;
          item_type: string;
          payroll_period_id: string;
          payroll_result_id: string;
          sort_order?: number;
        };
        Update: {
          amount?: number;
          code?: string;
          company_id?: string;
          employee_id?: string;
          id?: string;
          item_name?: string;
          item_type?: string;
          payroll_period_id?: string;
          payroll_result_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_result_items_employee_id_company_id_fkey";
            columns: ["employee_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "payroll_result_items_payroll_period_id_company_id_fkey";
            columns: ["payroll_period_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "payroll_periods";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "payroll_result_items_payroll_result_id_company_id_fkey";
            columns: ["payroll_result_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "payroll_results";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      payroll_results: {
        Row: {
          absence_deduction: number;
          bank_account_no: string | null;
          bank_code: string | null;
          base_salary_used: number;
          calc_version: string | null;
          calculated_at: string;
          calculated_by: string | null;
          company_id: string;
          employee_code: string;
          employee_id: string;
          employee_name: string;
          gross_salary: number;
          id: string;
          input_snapshot: Json | null;
          late_deduction: number;
          net_salary: number;
          ot_amount: number;
          other_deductions: number;
          payroll_period_id: string;
          social_security_amount: number;
          ss_rate_used: number;
          ss_wage_base: number;
          tax_amount: number;
          total_earnings: number;
          working_days: number | null;
        };
        Insert: {
          absence_deduction?: number;
          bank_account_no?: string | null;
          bank_code?: string | null;
          base_salary_used: number;
          calc_version?: string | null;
          calculated_at?: string;
          calculated_by?: string | null;
          company_id: string;
          employee_code: string;
          employee_id: string;
          employee_name: string;
          gross_salary: number;
          id?: string;
          input_snapshot?: Json | null;
          late_deduction?: number;
          net_salary: number;
          ot_amount?: number;
          other_deductions?: number;
          payroll_period_id: string;
          social_security_amount?: number;
          ss_rate_used?: number;
          ss_wage_base?: number;
          tax_amount?: number;
          total_earnings: number;
          working_days?: number | null;
        };
        Update: {
          absence_deduction?: number;
          bank_account_no?: string | null;
          bank_code?: string | null;
          base_salary_used?: number;
          calc_version?: string | null;
          calculated_at?: string;
          calculated_by?: string | null;
          company_id?: string;
          employee_code?: string;
          employee_id?: string;
          employee_name?: string;
          gross_salary?: number;
          id?: string;
          input_snapshot?: Json | null;
          late_deduction?: number;
          net_salary?: number;
          ot_amount?: number;
          other_deductions?: number;
          payroll_period_id?: string;
          social_security_amount?: number;
          ss_rate_used?: number;
          ss_wage_base?: number;
          tax_amount?: number;
          total_earnings?: number;
          working_days?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_results_employee_id_company_id_fkey";
            columns: ["employee_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "payroll_results_payroll_period_id_company_id_fkey";
            columns: ["payroll_period_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "payroll_periods";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      payslips: {
        Row: {
          company_id: string;
          employee_id: string;
          generated_at: string;
          id: string;
          payroll_period_id: string;
          payroll_result_id: string;
          storage_path: string;
        };
        Insert: {
          company_id: string;
          employee_id: string;
          generated_at?: string;
          id?: string;
          payroll_period_id: string;
          payroll_result_id: string;
          storage_path: string;
        };
        Update: {
          company_id?: string;
          employee_id?: string;
          generated_at?: string;
          id?: string;
          payroll_period_id?: string;
          payroll_result_id?: string;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_company_id_fkey";
            columns: ["employee_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "payslips_payroll_period_id_company_id_fkey";
            columns: ["payroll_period_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "payroll_periods";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "payslips_payroll_result_id_company_id_fkey";
            columns: ["payroll_result_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "payroll_results";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      statutory_rates: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          effective_from: string;
          effective_to: string | null;
          id: string;
          updated_at: string;
          value: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          effective_from: string;
          effective_to?: string | null;
          id?: string;
          updated_at?: string;
          value: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          id?: string;
          updated_at?: string;
          value?: number;
        };
        Relationships: [];
      };
      tax_brackets: {
        Row: {
          created_at: string;
          effective_from: string;
          effective_to: string | null;
          id: string;
          income_from: number;
          income_to: number | null;
          rate: number;
        };
        Insert: {
          created_at?: string;
          effective_from: string;
          effective_to?: string | null;
          id?: string;
          income_from: number;
          income_to?: number | null;
          rate: number;
        };
        Update: {
          created_at?: string;
          effective_from?: string;
          effective_to?: string | null;
          id?: string;
          income_from?: number;
          income_to?: number | null;
          rate?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      /** [PENDING 011] */
      log_bank_file_export: {
        Args: { p_bank?: string; p_count: number; p_format: string; p_period: string; p_total_satang: number };
        Returns: undefined;
      };
      change_payroll_period_status: {
        Args: { p_new_status: string; p_note?: string; p_period: string };
        Returns: Database["public"]["Tables"]["payroll_periods"]["Row"];
      };
      /** [PENDING 005] */
      change_salary: { Args: { p_employee: string; p_salary: Json }; Returns: string };
      /** [PENDING 005] */
      create_employees: { Args: { p_company: string; p_rows: Json }; Returns: number };
      /** [PENDING 005] */
      import_timesheets: { Args: { p_adjustments?: Json; p_period: string; p_rows: Json }; Returns: Json };
      /** [PENDING 004] */
      add_member:{ Args: { p_company?: string; p_email: string; p_role: string }; Returns: string };
      get_employee_id_card: { Args: { p_employee: string }; Returns: string };
      /** [PENDING 010] */
      claim_employee_account: { Args: Record<PropertyKey, never>; Returns: string };
      /** [PENDING 010] */
      link_employee_by_email: { Args: { p_employee: string }; Returns: string };
      /** [PENDING 004] */
      link_employee_account: {
        Args: { p_company: string; p_email: string; p_employee_code: string };
        Returns: string;
      };
      /** [PENDING 004] */
      list_access: {
        Args: Record<PropertyKey, never>;
        Returns: {
          kind: string;
          ref_id: string;
          user_id: string;
          email: string | null;
          role: string;
          company_id: string | null;
          company_name: string | null;
          display_name: string | null;
          is_active: boolean;
          last_sign_in_at: string | null;
        }[];
      };
      /** [PENDING 004] */
      remove_member: { Args: { p_member: string }; Returns: undefined };
      /** [PENDING 004] */
      set_member_active: { Args: { p_active: boolean; p_member: string }; Returns: undefined };
      /** [PENDING 004] */
      unlink_employee_account: { Args: { p_employee: string }; Returns: undefined };
      /** [PENDING 003] */
      save_payroll_results: {
        Args: { p_period: string; p_results: Json };
        Returns: number;
      };
      set_employee_id_card: {
        Args: { p_employee: string; p_id_card: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

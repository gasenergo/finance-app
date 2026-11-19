// src/types/database.ts

export type UserRole = 'admin' | 'user';
export type ParticipantType = 'partner' | 'percentage';
export type JobStatus = 'available' | 'invoiced' | 'paid';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';
export type TransactionType = 'income' | 'expense' | 'payout' | 'transfer';

export interface Account {
  id: string;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  tax_rate: number;
  fund_contribution_rate: number;
  fund_limit: number;
  current_fund_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  participant_type: ParticipantType | null;
  percentage_rate: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  inn: string | null;
  director_name: string | null;
  tax_rate: number | null;
  is_archived: boolean;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  slug: string | null;
  is_system: boolean;
  created_at: string;
}

export interface WorkType {
  id: string;
  name: string;
  default_price: number | null;
  unit: string;
  is_archived: boolean;
  created_at: string;
}

export interface Settings {
  id: number;
  tax_rate: number;
  fund_contribution_rate: number;
  fund_limit: number;
  updated_at: string;
}

export interface Fund {
  id: number;
  current_balance: number;
  updated_at: string;
}

export interface Job {
  id: string;
  account_id: string;
  client_id: string;
  created_by: string;
  description: string;
  work_type_id: string | null;
  custom_work_name: string | null;
  quantity: number;
  unit: string;
  amount: number;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  account?: Account;
  client?: Client;
  creator?: Profile;
  work_type?: WorkType;
}

export interface Invoice {
  id: string;
  account_id: string;
  invoice_number: string;
  client_id: string;
  total_amount: number;
  status: InvoiceStatus;
  paid_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  account?: Account;
  client?: Client;
  creator?: Profile;
  jobs?: Job[];
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  account_id: string;
  target_account_id: string | null;
  transfer_group_id: string | null;
  category_id: string | null;
  description: string | null;
  amount: number;
  related_invoice_id: string | null;
  related_user_id: string | null;
  created_by: string;
  created_at: string;
  account?: Account;
  target_account?: Account;
  category?: ExpenseCategory;
  related_user?: Profile;
}

export interface Balance {
  user_id: string;
  account_id: string;
  available_amount: number;
  total_earned: number;
  total_withdrawn: number;
  updated_at: string;
  user?: Profile;
  account?: Account;
}

export interface InvoiceParticipant {
  id: string;
  invoice_id: string;
  user_id: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  full_name: string;
  role: 'admin' | 'user';
  participant_type: 'partner' | 'percentage' | null;
  percentage_rate: number | null;
  is_active: boolean;
  balance: Array<{
    account_id: string;
    account_name?: string;
    available_amount: number;
    total_earned: number;
    total_withdrawn: number;
  }> | null;
}
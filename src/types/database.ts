export type UserRole = 'admin' | 'user';
export type ParticipantType = 'partner' | 'percentage';
export type JobStatus = 'available' | 'invoiced' | 'paid';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';
export type TransactionType = 'income' | 'expense' | 'payout';

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
  client_id: string;
  created_by: string;
  description: string;
  work_type_id: string | null;
  custom_work_name: string | null;
  amount: number;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  client?: Client;
  creator?: Profile;
  work_type?: WorkType;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  total_amount: number;
  status: InvoiceStatus;
  paid_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  client?: Client;
  creator?: Profile;
  jobs?: Job[];
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  category_id: string | null;
  description: string | null;
  amount: number;
  related_invoice_id: string | null;
  related_user_id: string | null;
  created_by: string;
  created_at: string;
  category?: ExpenseCategory;
  related_user?: Profile;
}

export interface Balance {
  user_id: string;
  available_amount: number;
  total_earned: number;
  total_withdrawn: number;
  updated_at: string;
  user?: Profile;
}
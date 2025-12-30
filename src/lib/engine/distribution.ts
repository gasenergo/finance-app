// src/lib/engine/distribution.ts 

import { roundMoney, calculateTax, calculateFundContribution } from './calculations';
import type { Settings } from '@/types/database';

export interface Participant {
  id: string;
  full_name: string;
  type: 'partner' | 'percentage';
  rate: number | null;
}

export interface DistributionBreakdown {
  grossAmount: number;
  taxAmount: number;
  afterTax: number;
  fundContribution: number;
  afterFund: number;
  percentagePayments: { userId: string; userName: string; amount: number }[];
  partnerPayments: { userId: string; userName: string; amount: number }[];
  totalDistributed: number;
  newFundBalance: number;
}

export interface BalanceUpdate {
  userId: string;
  amount: number;
}

export interface TransactionToCreate {
  type: 'income' | 'expense';
  categorySlug: 'income' | 'tax' | 'fund_contribution';
  description: string;
  amount: number;
}

export interface DistributionResult {
  breakdown: DistributionBreakdown;
  transactions: TransactionToCreate[];
  balanceUpdates: BalanceUpdate[];
}

export function calculateDistribution(
  invoiceAmount: number,
  settings: Settings,
  currentFundBalance: number,
  participants: Participant[],
  activeParticipantIds?: string[]  // ← новый параметр
): DistributionResult {
  const { tax_rate, fund_contribution_rate, fund_limit } = settings;

  // Фильтруем участников если указан список активных
  const activeParticipants = activeParticipantIds 
    ? participants.filter(p => activeParticipantIds.includes(p.id))
    : participants;

  const taxAmount = calculateTax(invoiceAmount, tax_rate);
  const afterTax = roundMoney(invoiceAmount - taxAmount);

  const fundContribution = calculateFundContribution(
    afterTax,
    fund_contribution_rate,
    currentFundBalance,
    fund_limit
  );
  const afterFund = roundMoney(afterTax - fundContribution);
  const newFundBalance = roundMoney(currentFundBalance + fundContribution);

  // Процентники — только активные
  const percentageParticipants = activeParticipants.filter(p => p.type === 'percentage');
  const percentagePayments = percentageParticipants.map(p => ({
    userId: p.id,
    userName: p.full_name,
    amount: roundMoney(afterFund * ((p.rate || 0) / 100))
  }));

  const totalPercentage = percentagePayments.reduce((sum, p) => sum + p.amount, 0);
  const afterPercentage = roundMoney(afterFund - totalPercentage);

  // Партнёры — только активные
  const partners = activeParticipants.filter(p => p.type === 'partner');
  let partnerPayments: { userId: string; userName: string; amount: number }[] = [];

  if (partners.length > 0) {
    const baseShare = roundMoney(afterPercentage / partners.length);
    partnerPayments = partners.map(p => ({
      userId: p.id,
      userName: p.full_name,
      amount: baseShare
    }));

    const distributed = partnerPayments.reduce((s, p) => s + p.amount, 0);
    const remainder = roundMoney(afterPercentage - distributed);
    if (remainder !== 0 && partnerPayments.length > 0) {
      partnerPayments[0].amount = roundMoney(partnerPayments[0].amount + remainder);
    }
  }

  const allPayments = [...percentagePayments, ...partnerPayments];
  const totalDistributed = allPayments.reduce((s, p) => s + p.amount, 0);

  const breakdown: DistributionBreakdown = {
    grossAmount: invoiceAmount,
    taxAmount,
    afterTax,
    fundContribution,
    afterFund,
    percentagePayments,
    partnerPayments,
    totalDistributed,
    newFundBalance
  };

  const transactions: TransactionToCreate[] = [
    { type: 'expense', categorySlug: 'tax', description: 'Налог', amount: taxAmount }
  ];

  if (fundContribution > 0) {
    transactions.push({
      type: 'expense',
      categorySlug: 'fund_contribution',
      description: 'Отчисление в фонд',
      amount: fundContribution
    });
  }

  const balanceUpdates: BalanceUpdate[] = allPayments.map(p => ({
    userId: p.userId,
    amount: p.amount
  }));

  return { breakdown, transactions, balanceUpdates };
}
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateTax(amount: number, taxRate: number): number {
  return roundMoney(amount * (taxRate / 100));
}

export function calculateFundContribution(
  amountAfterTax: number,
  fundRate: number,
  currentFundBalance: number,
  fundLimit: number
): number {
  if (currentFundBalance >= fundLimit) {
    return 0;
  }
  const maxContribution = fundLimit - currentFundBalance;
  const desiredContribution = roundMoney(amountAfterTax * (fundRate / 100));
  return Math.min(desiredContribution, maxContribution);
}
import type { Account } from "@shared/schema";

export interface FinancialTotals {
  totalCreditLimit: number;
  totalOwed: number;
  totalAvailableCredit: number;
  isOverLimit: boolean;
  overLimitAmount: number;
  totalCash: number;
  netWorth: number;
}

export function calculateFinancialTotals(accounts: Account[]): FinancialTotals {
  let totalCreditLimit = 0;
  let totalOwed = 0;
  let totalCash = 0;

  for (const account of accounts) {
    const balance = parseFloat(account.balance);

    if (account.category === "credit_card") {
      const creditLimit = account.creditLimit ? parseFloat(account.creditLimit) : 0;
      totalCreditLimit += creditLimit;
      totalOwed += balance;
    } else if (account.category === "loan") {
      totalOwed += balance;
    } else {
      totalCash += balance;
    }
  }

  const totalAvailableCredit = totalCreditLimit - totalOwed;
  const isOverLimit = totalAvailableCredit < 0;
  const overLimitAmount = isOverLimit ? Math.abs(totalAvailableCredit) : 0;
  const netWorth = totalCash - totalOwed;

  return {
    totalCreditLimit,
    totalOwed,
    totalAvailableCredit,
    isOverLimit,
    overLimitAmount,
    totalCash,
    netWorth,
  };
}

export function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

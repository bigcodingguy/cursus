import type { CharId, GameState, Loan } from '../../types';

export function cashOf(s: GameState, id: CharId): number {
  return s.money.accounts[id]?.cash ?? 0;
}

export function loansOwedBy(s: GameState, id: CharId): Loan[] {
  return s.money.loans.filter((l) => l.borrower === id);
}

export function loansHeldBy(s: GameState, id: CharId): Loan[] {
  return s.money.loans.filter((l) => l.lender === id);
}

export function debtOf(s: GameState, id: CharId): number {
  return loansOwedBy(s, id).reduce((a, l) => a + l.principal, 0);
}

/** Rough worth: cash + capitalised income (land at ~6%) + loans held − debts. */
export function netWorth(s: GameState, id: CharId): number {
  const a = s.money.accounts[id];
  if (!a) return 0;
  const lent = loansHeldBy(s, id).reduce((x, l) => x + l.principal, 0);
  return a.cash + a.income / 0.06 + lent - debtOf(s, id);
}

/** Total money in the world (cash only; loans are claims, not coin). */
export function totalCash(s: GameState): number {
  let t = 0;
  for (const a of Object.values(s.money.accounts)) t += a.cash;
  return t;
}

export const STANDARD_RATE = 0.01; // 1% a month, the usual Roman rate

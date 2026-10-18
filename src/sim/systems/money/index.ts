import { allChars } from '../../util';
import { emit, on } from '../../bus';
import { dateOf } from '../../calendar';
import type { SystemDef } from '../../core';
import type { CharId, GameState } from '../../types';
import { opinion } from '../network/api';
import { cashOf, STANDARD_RATE } from './api';
import { heirOf } from '../family/api';

export { heirOf };

export const money: SystemDef = {
  id: 'money',
  register() {
    on('transfer', (s, e) => {
      const amt = Math.round(e.amount);
      if (amt <= 0) return;
      const m = s.money;
      if (e.from) (m.accounts[e.from] ??= { cash: 0, income: 0, upkeep: 0 }).cash -= amt;
      else m.minted += amt;
      if (e.to) (m.accounts[e.to] ??= { cash: 0, income: 0, upkeep: 0 }).cash += amt;
      else m.burned += amt;
      if (!e.from || !e.to) m.flows[e.reason] = (m.flows[e.reason] ?? 0) + (e.from ? -amt : amt);
    });
    on('loan.make', (s, e) => {
      const amt = Math.round(e.amount);
      if (amt <= 0) return;
      if (!e.preexisting) {
        if (cashOf(s, e.lender) < amt) return;
        emit(s, 'transfer', { from: e.lender, to: e.borrower, amount: amt, reason: 'loan' });
      }
      s.money.loans.push({
        id: s.money.nextLoanId++, lender: e.lender, borrower: e.borrower, principal: amt,
        monthlyRate: e.monthlyRate ?? STANDARD_RATE, startDay: s.day, dueDay: s.day + Math.round(e.months * 30.4), called: false,
      });
    });
    on('loan.call', (s, e) => {
      const l = s.money.loans.find((x) => x.id === e.loanId);
      if (!l || l.called) return;
      l.called = true;
      l.callDeadline = s.day + 30;
      if (l.borrower === s.playerId) {
        emit(s, 'log', { text: `${name(s, l.lender)} calls in your loan of HS ${l.principal.toLocaleString('en-US')}. You have thirty days.`, kind: 'money', about: [l.lender] });
        emit(s, 'pause', { reason: 'loan called' });
      }
    });
    on('loan.forgiveCall', (s, e) => {
      const l = s.money.loans.find((x) => x.id === e.loanId);
      if (!l) return;
      l.called = false;
      l.callDeadline = undefined;
      l.dueDay = Math.max(l.dueDay, s.day + 365);
    });
    on('death', (s, e) => {
      const heir = heirOf(s, e.who);
      const cash = cashOf(s, e.who);
      const acct = s.money.accounts[e.who];
      if (heir) {
        if (cash > 0) emit(s, 'transfer', { from: e.who, to: heir, amount: cash, reason: 'inheritance' });
        const h = (s.money.accounts[heir] ??= { cash: 0, income: 0, upkeep: 0 });
        if (acct) {
          h.income += acct.income;
          h.upkeep = Math.max(h.upkeep, acct.upkeep);
          if (cash < 0) h.cash += cash, acct.cash = 0; // debts in arrears pass to the heir
          acct.income = 0;
          acct.upkeep = 0;
        }
        for (const l of s.money.loans) {
          if (l.borrower === e.who) l.borrower = heir;
          if (l.lender === e.who) l.lender = heir;
        }
        // Allowances end: the heir is his own master now.
        delete s.chars[heir].flags.allowance;
      } else {
        if (cash > 0) emit(s, 'transfer', { from: e.who, to: null, amount: cash, reason: 'estate dispersed' });
        if (cash < 0) emit(s, 'transfer', { from: null, to: e.who, amount: -cash, reason: 'debts of the dead written off' });
        if (acct) {
          acct.income = 0;
          acct.upkeep = 0;
        }
        s.money.loans = s.money.loans.filter((l) => l.borrower !== e.who && l.lender !== e.who);
      }
    });
    on('bankrupt', (s, e) => {
      if (!s.money.bankrupt.includes(e.who)) s.money.bankrupt.push(e.who);
    });
  },
  monthly(s) {
    const m = s.money;
    for (const [id, a] of Object.entries(m.accounts)) {
      const c = s.chars[id];
      if (!c?.alive) continue;
      if (a.income > 0) emit(s, 'transfer', { from: null, to: id, amount: a.income / 12, reason: 'estates' });
      if (a.upkeep > 0) emit(s, 'transfer', { from: id, to: null, amount: a.upkeep / 12, reason: 'household' });
      const allowance = c.flags.allowance ?? 0;
      const father = c.fatherId ? s.chars[c.fatherId] : undefined;
      if (allowance > 0 && father?.alive && cashOf(s, father.id) >= allowance)
        emit(s, 'transfer', { from: father.id, to: id, amount: allowance, reason: 'allowance' });
    }
    // Interest.
    for (const l of [...m.loans]) {
      const interest = Math.round(l.principal * l.monthlyRate);
      if (cashOf(s, l.borrower) >= interest) emit(s, 'transfer', { from: l.borrower, to: l.lender, amount: interest, reason: 'interest' });
      else l.principal += interest;
    }
    // Arrears: anyone in the red borrows from the nearest banker at a stiff rate.
    for (const [id, a] of Object.entries(m.accounts)) {
      if (a.cash >= 0 || !s.chars[id]?.alive) continue;
      const banker = allChars(s).find((c) => c.alive && c.flags.banker && c.id !== id && cashOf(s, c.id) > -a.cash + 1000);
      if (!banker) continue;
      const need = Math.ceil((-a.cash + 2000) / 1000) * 1000;
      emit(s, 'loan.make', { lender: banker.id, borrower: id, amount: need, months: 12, monthlyRate: 0.015 });
      if (id === s.playerId) emit(s, 'log', { text: `Your accounts are in arrears. ${name(s, banker.id)} advances you HS ${need.toLocaleString('en-US')} at one and a half percent a month.`, kind: 'money', about: [banker.id] });
    }
    if (dateOf(s.day).month % 3 === 0) m.history.push({ day: s.day, player: cashOf(s, s.playerId) });
  },
  daily(s) {
    for (const l of [...s.money.loans]) {
      if (!l.called && s.day >= l.dueDay) {
        // The lender decides whether to roll the loan over.
        const op = opinion(s, l.lender, l.borrower).total;
        const b = s.chars[l.borrower];
        const yearly = (s.money.accounts[l.borrower]?.income ?? 0) + (b?.flags.allowance ?? 0) * 12;
        const solvent = cashOf(s, l.borrower) + yearly > l.principal * 0.3;
        if (op >= -10 && solvent) l.dueDay = s.day + 365;
        else emit(s, 'loan.call', { loanId: l.id });
      } else if (l.called && l.callDeadline !== undefined && s.day >= l.callDeadline) {
        settle(s, l.id);
      }
    }
  },
};

export function repay(s: GameState, loanId: number, amount?: number): boolean {
  const l = s.money.loans.find((x) => x.id === loanId);
  if (!l) return false;
  const pay = Math.min(amount ?? l.principal, l.principal, cashOf(s, l.borrower));
  if (pay <= 0) return false;
  emit(s, 'transfer', { from: l.borrower, to: l.lender, amount: pay, reason: 'repayment' });
  l.principal -= Math.round(pay);
  if (l.principal <= 0) s.money.loans = s.money.loans.filter((x) => x.id !== loanId);
  return true;
}

function settle(s: GameState, loanId: number) {
  const l = s.money.loans.find((x) => x.id === loanId)!;
  const cash = Math.max(0, cashOf(s, l.borrower));
  if (cash >= l.principal) {
    repay(s, loanId);
    return;
  }
  if (cash > 0) emit(s, 'transfer', { from: l.borrower, to: l.lender, amount: cash, reason: 'repayment' });
  // The rest comes out of his land, sold at auction at a forced-sale price.
  const short = l.principal - cash;
  const acct = s.money.accounts[l.borrower];
  let covered = false;
  if (acct && acct.income > 0 && short > 0) {
    const landValue = (acct.income / 0.06) * 0.7;
    const sold = Math.min(1, short / landValue);
    covered = landValue >= short;
    emit(s, 'transfer', { from: null, to: l.lender, amount: Math.min(short, landValue), reason: 'estates sold at auction' });
    acct.income = Math.round(acct.income * (1 - sold));
  }
  s.money.loans = s.money.loans.filter((x) => x.id !== loanId);
  if (covered) {
    // A forced sale of land: a heavy loss and a humiliation, but not ruin.
    emit(s, 'charFlag', { who: l.borrower, key: 'soldLand', value: s.day });
    emit(s, 'standing', { who: l.borrower, kind: 'dignitas', value: -4, label: 'Forced to sell land to pay a debt', halfLife: 3000 });
    emit(s, 'standing', { who: l.borrower, kind: 'boni', value: -6, label: 'Forced to sell land to pay a debt' });
    emit(s, 'memory', { owner: l.borrower, about: l.lender, act: 'Forced me to sell my land', weight: -30, halfLife: 3650 });
    emit(s, 'log', { text: `${name(s, l.borrower)} cannot find the cash to pay ${name(s, l.lender)}, and sells land at auction to clear the debt.`, kind: 'money', about: [l.borrower, l.lender] });
    emit(s, 'news', { text: `${name(s, l.borrower)} has had to sell land at a bad price to pay his creditor.`, about: [l.borrower] });
    return;
  }
  emit(s, 'bankrupt', { who: l.borrower });
  emit(s, 'standing', { who: l.borrower, kind: 'dignitas', value: -15, label: 'Defaulted on a debt', halfLife: 0 });
  emit(s, 'standing', { who: l.borrower, kind: 'boni', value: -20, label: 'Defaulted on a debt' });
  emit(s, 'memory', { owner: l.lender, about: l.borrower, act: 'Defaulted on my loan', weight: -40, halfLife: 3650 });
  emit(s, 'log', { text: `${name(s, l.borrower)} cannot pay ${name(s, l.lender)}; his goods are seized and sold.`, kind: 'money', about: [l.borrower, l.lender] });
  emit(s, 'news', { text: `They say ${name(s, l.borrower)} is ruined: his creditor has had his goods put up for sale.`, about: [l.borrower] });
}

function name(s: GameState, id: CharId): string {
  const c = s.chars[id];
  return c ? [c.praenomen, c.nomen, c.cognomen].filter(Boolean).join(' ') : 'someone';
}

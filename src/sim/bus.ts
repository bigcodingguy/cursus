// Event bus. Systems communicate by emitting and handling these events;
// none of them mutates another system's slice directly.

import type { CharId, GameState, LogEntry, OfficeId, StandingKind } from './types';

export interface BusEvents {
  memory: { owner: CharId; about: CharId; act: string; weight: number; halfLife?: number };
  favor: { debtor: CharId; creditor: CharId; weight: number; reason: string };
  'favor.spend': { id: number };
  tie: { a: CharId; b: CharId; kind: 'amicus' | 'inimicus' | 'kin' };
  standing: { who: CharId; kind: StandingKind; value: number; label: string; halfLife?: number };
  /** from=null: money enters the world (source). to=null: it leaves (sink). */
  transfer: { from: CharId | null; to: CharId | null; amount: number; reason: string };
  death: { who: CharId; cause: string };
  exile: { who: CharId; reason: string };
  log: Omit<LogEntry, 'day'>;
  news: { text: string; truth?: 'true' | 'false' | 'unconfirmed'; delay?: number; about?: CharId[] };
  pause: { reason: string };
  'office.won': { who: CharId; office: OfficeId; yearBC: number };
  'governor.returned': { who: CharId; province: string; extorted: number };
  'trial.verdict': { caseId: string; verdict: 'convicted' | 'acquitted'; prosecutor: CharId; defender?: CharId; defendant: CharId };
  'trial.opened': { caseId: string; prosecutor: CharId; defendant: CharId };
  'election.held': { electionId: string; winners: CharId[] };
  'election.postpone': { office: OfficeId | 'mine'; days: number; reason: string };
  'action.done': { actor: CharId; action: string };
  pressure: { id: string; add: number };
  stability: { add: number; label: string };
  law: { key: string; value: string | number };
  lean: { who: CharId; add: number };
  skill: { who: CharId; skill: 'oratory' | 'law'; add: number };
  travel: { who: CharId; to: 'rome' | 'abroad' | 'arpinum' | 'exile'; until?: number };
  /** preexisting: an old debt, recorded without moving money now. */
  'loan.make': { lender: CharId; borrower: CharId; amount: number; months: number; monthlyRate?: number; preexisting?: boolean };
  'loan.call': { loanId: number };
  'loan.forgiveCall': { loanId: number };
  bankrupt: { who: CharId };
  flag: { key: string; value: number };
  'gossip.hear': Record<string, never>;
  occupy: { who: CharId; days: number };
  marry: { husband: CharId; wife: CharId; dowry?: number };
  divorce: { husband: CharId };
  adopt: { father: CharId; son: CharId };
  untie: { a: CharId; b: CharId; kind: 'amicus' | 'inimicus' | 'kin' };
  act: { who: CharId; action: string; params: Record<string, string | number> };
  charFlag: { who: CharId; key: string; value: number };
  patron: { client: CharId; patron: CharId | null };
  /** A named moment content events can listen for (see EventDef.hook). */
  hook: { name: string; roles: Record<string, CharId>; vars?: Record<string, string | number> };
  'law.proposed': { id: number; law: string; proposer: CharId };
  'law.passed': { id: number; law: string; proposer: CharId };
  'office.start': { who: CharId; office: OfficeId; yearBC: number };
  'event.trigger': { eventId: string; roles?: Record<string, CharId>; vars?: Record<string, string | number>; delay?: number };
}
export type BusType = keyof BusEvents;
export type Handler<K extends BusType> = (s: GameState, e: BusEvents[K]) => void;

const handlers: { [K in BusType]?: Handler<K>[] } = {};
let queue: { type: BusType; payload: unknown }[] = [];
let draining = false;

export function on<K extends BusType>(type: K, h: Handler<K>): void {
  ((handlers as Record<string, unknown[]>)[type] ??= []).push(h);
}

export function emit<K extends BusType>(s: GameState, type: K, payload: BusEvents[K]): void {
  queue.push({ type, payload });
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      const ev = queue.shift()!;
      const hs = handlers[ev.type] as Handler<BusType>[] | undefined;
      if (hs) for (const h of hs) h(s, ev.payload as never);
    }
  } finally {
    draining = false;
    queue = [];
  }
}

export function resetBus(): void {
  for (const k of Object.keys(handlers)) delete handlers[k as BusType];
}

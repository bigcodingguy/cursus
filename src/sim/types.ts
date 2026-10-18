// Plain serializable game state. No classes, no functions.
// Each system owns one slice (see src/sim/systems/<name>/).

import type { RngState } from './rng';

export type CharId = string;
export type PlaceId = 'forum' | 'capitol' | 'palatine' | 'subura' | 'campus' | 'aventine' | 'carinae' | 'boarium';
export type StandingKind = 'dignitas' | 'people' | 'boni';
export type Rank = 'senator' | 'eques' | 'plebs';
export type Location = 'rome' | 'abroad' | 'arpinum' | 'exile';

/** Every derived number carries its explanation. */
export interface Breakdown {
  total: number;
  parts: { label: string; value: number }[];
}

export interface Traits {
  ambition: number; // 0..1
  greed: number;
  boldness: number;
  loyalty: number;
  sociability: number;
  pride: number; // aristocratic hauteur toward new men
}

export interface Character {
  id: CharId;
  praenomen: string;
  nomen: string;
  cognomen?: string;
  female: boolean;
  familyId: string | null;
  bornBC: number;
  alive: boolean;
  died?: { day: number; cause: string };
  rank: Rank;
  traits: Traits;
  /** -1 popularis .. +1 optimate. Moves with what a man says and does. */
  lean: number;
  oratory: number; // 0..100
  law: number; // 0..100
  location: Location;
  home: PlaceId;
  tribe: string;
  fatherId?: CharId;
  patronId?: CharId | null;
  historical?: string;
  servedAbroad: number; // campaign seasons served
  busyUntil: number;
  action?: { id: string; params: ActionParams; endDay: number; startDay: number };
  nextThink: number;
  flags: Record<string, number>;
  bio?: string;
}

export interface Family {
  id: string;
  name: string; // e.g. "Sempronii Gracchi"
  patrician: boolean;
  consulAncestors: number; // imagines
  praetorAncestors: number;
  home: PlaceId;
}

export type ActionParams = Record<string, string | number | boolean | string[] | undefined>;

// ---------------- network ----------------
export interface Memory {
  about: CharId;
  act: string;
  day: number;
  weight: number;
  halfLife: number; // days; 0 = permanent
}
export interface Favor {
  id: number;
  debtor: CharId; // owes
  creditor: CharId;
  weight: number;
  reason: string;
  day: number;
}
export interface Tie {
  a: CharId;
  b: CharId;
  kind: 'amicus' | 'inimicus' | 'kin';
  since: number;
}
export interface NetworkState {
  memories: Record<CharId, Memory[]>;
  favors: Favor[];
  ties: Tie[];
  nextFavorId: number;
}

// ---------------- money ----------------
export interface Account {
  cash: number;
  income: number; // per year
  upkeep: number; // per year
}
export interface Loan {
  id: number;
  lender: CharId;
  borrower: CharId;
  principal: number;
  monthlyRate: number;
  startDay: number;
  dueDay: number;
  called: boolean;
  callDeadline?: number;
}
export interface MoneyState {
  accounts: Record<CharId, Account>;
  loans: Loan[];
  nextLoanId: number;
  minted: number;
  burned: number;
  flows: Record<string, number>; // by source/sink label
  bankrupt: CharId[];
  history: { day: number; player: number }[];
}

// ---------------- standing ----------------
export interface StandingEntry {
  kind: StandingKind;
  label: string;
  value: number;
  day: number;
  halfLife: number; // 0 = permanent
}
export interface StandingState {
  entries: Record<CharId, StandingEntry[]>;
}

// ---------------- offices ----------------
export type OfficeId = 'military_tribune' | 'quaestor' | 'tribune_pleb' | 'aedile' | 'praetor' | 'consul' | 'censor';
export interface OfficeRecord {
  who: CharId;
  office: OfficeId;
  yearBC: number;
}
export interface Governorship {
  who: CharId;
  province: string;
  departDay: number;
  returnDay: number;
  extorted: number;
  returned: boolean;
}
export interface Candidate {
  who: CharId;
  canvass: Record<string, number>; // tribe -> effort
  bribes: Record<string, number>; // tribe -> HS
  endorsements: CharId[];
  declaredDay: number;
}
export interface TribeResult {
  tribe: string;
  voters: number;
  votes: Record<CharId, number>;
  carried: CharId[];
}
export interface Election {
  id: string;
  office: OfficeId;
  forYearBC: number; // year of office
  seats: number;
  day: number; // voting day
  professioDeadline: number;
  candidates: Candidate[];
  status: 'open' | 'held';
  postponements: number;
  results?: { winners: CharId[]; tribes: TribeResult[]; tally: Record<CharId, { tribes: number; votes: number }>; forecastWin?: number };
}
export interface OfficesState {
  records: OfficeRecord[];
  governors: Governorship[];
  elections: Election[];
  /** Canvassing done before a man formally declares, by tribe. */
  groundwork: Record<CharId, Record<string, number>>;
}

// ---------------- courts ----------------
export type Strategy = 'facts' | 'character' | 'pity' | 'threat';
export interface Juror {
  id: string;
  charId?: CharId; // named juror from the cast
  label: string;
  cls: 'senator' | 'eques';
  bias: number; // logit bias toward conviction
  lean: number;
  known: boolean; // revealed by jury research
  bribedBy?: 'prosecution' | 'defense';
  rejected?: boolean;
}
export interface CasePrep {
  witnesses: number;
  documents: number;
  research: number;
  coCounsel?: CharId;
  tampering: number; // HS spent
  exposed: boolean;
}
export interface TrialRound {
  prosecution: Strategy;
  defense: Strategy;
  swing: number;
}
export interface Case {
  id: string;
  defendant: CharId;
  province: string;
  extorted: number;
  evidence: number; // 0..1 true strength of the evidence
  openedDay: number;
  expiresDay: number;
  status: 'open' | 'prep' | 'trial' | 'closed';
  prosecutor?: CharId;
  defender?: CharId;
  trialDay?: number;
  prosecutionPrep: CasePrep;
  defensePrep: CasePrep;
  jury: Juror[];
  rounds: TrialRound[];
  /** The NPC advocate's mixed plan for the coming round: probability of each strategy (STRATEGIES order). */
  npcMix?: number[];
  askedPlayer?: boolean;
  sway: number; // accumulated rhetorical swing (logit)
  verdict?: 'convicted' | 'acquitted';
  verdictDay?: number;
  votes?: { convict: number; acquit: number };
  juryClass: 'senator' | 'eques';
}
export interface CourtsState {
  cases: Case[];
  nextCaseId: number;
}

// ---------------- crisis ----------------
export interface CrisisState {
  pressures: Record<string, number>; // 0..100
  stability: number; // 0..100
  history: { day: number; stability: number; land: number; allies: number }[];
}

// ---------------- events (content runner) ----------------
export interface PendingEvent {
  uid: number;
  eventId: string;
  day: number;
  roles: Record<string, CharId>;
  vars: Record<string, string | number>;
  /** Set after a choice, when the event shows its outcome text. */
  outcome?: { text: string; roll?: { chance: number; success: boolean } };
}
export interface EventsState {
  fired: Record<string, number>; // id -> last day fired
  pending: PendingEvent[];
  nextUid: number;
  scheduled: { day: number; eventId: string; roles: Record<string, CharId>; vars?: Record<string, string | number> }[];
  /** Day the player last faced an event; opportunities are paced from it. */
  lastPrompt: number;
}

// ---------------- news ----------------
export interface Gossip {
  id: number;
  day: number; // day it reaches the Forum
  text: string;
  truth: 'true' | 'false' | 'unconfirmed';
  heard: boolean;
  about: CharId[];
}
export interface NewsState {
  items: Gossip[];
  nextId: number;
}

// ---------------- log ----------------
export interface LogEntry {
  day: number;
  text: string;
  kind: 'world' | 'player' | 'court' | 'election' | 'money' | 'death';
  about?: CharId[];
}

export interface GameState {
  version: number;
  seed: number;
  rng: RngState;
  day: number;
  startDay: number;
  endDay: number;
  playerId: CharId;
  chars: Record<CharId, Character>;
  families: Record<string, Family>;
  nextCharId: number;
  flags: Record<string, number>;
  laws: Record<string, string | number>;
  routine: 'receive' | 'attend' | 'none';
  network: NetworkState;
  money: MoneyState;
  standing: StandingState;
  offices: OfficesState;
  courts: CourtsState;
  crisis: CrisisState;
  events: EventsState;
  news: NewsState;
  log: LogEntry[];
  pauseRequests: string[];
  ended?: { day: number; reason: string };
}

import { createContext, useContext, useState, type ReactNode } from 'react';
import { auc, dateOf, plainDate, romanDate } from '../sim/calendar';
import { currentHolders } from '../sim/systems/offices/api';
import type { Breakdown, Character, GameState, PlaceId } from '../sim/types';
import { fullName, shortName } from '../sim/util';
import { displayName } from './people';

// ---------------- UI selection context ----------------
/** The four sidebar tabs. Older names (family, laws, case…) still work and map onto them. */
export type Tab = 'people' | 'house' | 'forum' | 'record' | 'person' | 'family' | 'laws' | 'favors' | 'gossip' | 'chronicle' | 'case' | 'election';
export function mainTab(t: Tab): 'people' | 'house' | 'forum' | 'record' {
  return t === 'person' || t === 'people' ? 'people' : t === 'family' || t === 'favors' || t === 'house' ? 'house' : t === 'chronicle' || t === 'record' ? 'record' : 'forum';
}
export interface UI {
  place: PlaceId;
  setPlace: (p: PlaceId) => void;
  person: string | null;
  showPerson: (id: string) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  /** Guests chosen for your next dinner, from anywhere in the UI. */
  guests: string[];
  setGuests: (g: string[]) => void;
}
export const UICtx = createContext<UI>(null as unknown as UI);
export const useUI = () => useContext(UICtx);

// ---------------- tooltips ----------------
const fmtV = (v: number, digits = 0) => {
  const r = digits ? v.toFixed(digits) : String(Math.round(v));
  return v > 0 ? `+${r}` : r;
};

export function BreakdownTable({ b, digits = 0, totalLabel = 'Total', asPct }: { b: Breakdown; digits?: number; totalLabel?: string; asPct?: boolean }) {
  return (
    <table>
      <tbody>
        {b.parts.map((p, i) => (
          <tr key={i}>
            <td>{p.label}</td>
            <td className="v">{asPct ? `${p.value > 0 ? '+' : ''}${Math.round(p.value * 100)}%` : fmtV(p.value, digits)}</td>
          </tr>
        ))}
        <tr className="total">
          <td>{totalLabel}</td>
          <td className="v">{asPct ? `${Math.round(b.total * 100)}%` : digits ? b.total.toFixed(digits) : Math.round(b.total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

/** Hover to see why a number is what it is. */
export function Why({ b, children, digits, asPct, note }: { b: Breakdown | null | undefined; children: ReactNode; digits?: number; asPct?: boolean; note?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  if (!b) return <>{children}</>;
  return (
    <span
      className="why"
      onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && (
        <span className="tip" style={{ left: Math.min(pos.x + 14, window.innerWidth - 370), top: Math.min(pos.y + 14, window.innerHeight - 200) }}>
          {note && <div style={{ marginBottom: 4 }}>{note}</div>}
          <BreakdownTable b={b} digits={digits} asPct={asPct} />
        </span>
      )}
    </span>
  );
}

export function Odds({ p }: { p: number }) {
  return <span className={`odds ${p < 0.4 ? 'low' : ''}`}>{p > 0 && p < 0.01 ? '<1%' : p < 1 && p > 0.99 ? '>99%' : `${Math.round(p * 100)}%`}</span>;
}

// ---------------- names and words ----------------
export function Name({ s, id, full }: { s: GameState; id: string | undefined | null; full?: boolean }) {
  const ui = useUI();
  const c = id ? s.chars[id] : undefined;
  if (!c) return <span className="muted">—</span>;
  if (c.id === s.playerId) return <span>you</span>;
  return (
    <a onClick={() => ui.showPerson(c.id)} title={fullName(c)}>
      {displayName(s, c, full)}
      {!c.alive && ' †'}
    </a>
  );
}

export function leanLabel(l: number): string {
  if (l <= -0.6) return 'a firm popularis';
  if (l <= -0.25) return 'leans to the people';
  if (l < 0.25) return 'keeps his own counsel';
  if (l < 0.6) return 'leans to the boni';
  return 'one of the boni, to the bone';
}

export function opinionWord(v: number): string {
  if (v >= 50) return 'devoted';
  if (v >= 25) return 'warm';
  if (v >= 8) return 'friendly';
  if (v > -8) return 'indifferent';
  if (v > -25) return 'cool';
  if (v > -50) return 'hostile';
  return 'implacable';
}

export function traitWords(c: Character): string[] {
  const t = c.traits;
  const w: string[] = [];
  if (t.ambition > 0.7) w.push('ambitious');
  else if (t.ambition < 0.3) w.push('unambitious');
  if (t.greed > 0.7) w.push('grasping');
  else if (t.greed < 0.25) w.push('honest with money');
  if (t.boldness > 0.7) w.push('bold');
  else if (t.boldness < 0.3) w.push('cautious');
  if (t.loyalty > 0.7) w.push('loyal');
  else if (t.loyalty < 0.3) w.push('fickle');
  if (t.sociability > 0.7) w.push('convivial');
  else if (t.sociability < 0.3) w.push('aloof');
  if (t.pride > 0.75) w.push('proud');
  return w;
}

export function skillWord(v: number): string {
  if (v >= 80) return 'masterly';
  if (v >= 60) return 'accomplished';
  if (v >= 40) return 'competent';
  if (v >= 25) return 'untried';
  return 'raw';
}

export function dateLine(s: GameState, day = s.day): string {
  const d = dateOf(day);
  return `${romanDate(day)} · ${plainDate(day)} · AUC ${auc(d.yearBC)}`;
}

export function consulsLine(s: GameState): string {
  const c = currentHolders(s, 'consul').map((id) => shortName(s.chars[id]));
  return c.length ? `consuls ${c.join(' and ')}` : '';
}

export function shortDate(day: number): string {
  const d = dateOf(day);
  return `${d.dom} ${['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Quint', 'Sext', 'Sep', 'Oct', 'Nov', 'Dec'][d.month]} ${d.yearBC}`;
}

/** A placeholder portrait: a colored tablet with initials. Real portraits come in the art phase. */
export function Portrait({ c }: { c: Character }) {
  const hue = c.lean < -0.25 ? 'var(--verdigris-dark)' : c.lean > 0.25 ? 'var(--red-dark)' : '#7a6a52';
  const ini = c.female ? c.nomen.slice(0, 2) : `${c.praenomen[0] ?? ''}${c.nomen[0]}`;
  return (
    <div className="portrait" style={{ background: hue }}>
      {ini}
    </div>
  );
}

/** A collapsible section: secondary things stay folded until wanted. */
export function Section({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="section" open={open}>
      <summary>{title}</summary>
      <div className="sectionBody">{children}</div>
    </details>
  );
}

import { useState } from 'react';
import { OFFICES } from '../content/offices';
import { dateOf } from '../sim/calendar';
import { convictionChance, evidenceTerm, jurorLean, playerCase, chargeLabel } from '../sim/systems/courts/api';
import { cashOf, debtOf, loansHeldBy, loansOwedBy } from '../sim/systems/money/api';
import { favorBalance, favorsOwed, memoriesAbout, opinion, tiesOf } from '../sim/systems/network/api';
import { ASK_LABELS, askBlocked, type Ask } from '../sim/systems/city';
import { ActionRow } from './PlacePanel';
import { recentlyRemembered, seenAs, stanceLine, whyMatters, youDid } from './people';
import { clientsOf } from '../sim/systems/news';
import { appealParts, assemblyOf, officesOf, openElection, openElections, profileOf, profiles, voteGap, voteOnce, winChance } from '../sim/systems/offices/api';
import { standingOf } from '../sim/systems/standing/api';
import type { GameState } from '../sim/types';
import { ageOf, fmtHS, fullName, shortName } from '../sim/util';
import { BreakdownTable, leanLabel, Name, Odds, opinionWord, Portrait, shortDate, skillWord, traitWords, useUI, Why } from './common';
import { run } from './store';

function rankWords(d: number): string {
  return d >= 80 ? 'one of the first men of Rome' : d >= 55 ? 'a man of high rank' : d >= 30 ? 'a man of some standing' : d >= 10 ? 'of modest standing' : 'of no standing yet';
}
function favorWords(v: number, who: string): string {
  return v >= 40 ? `a favorite of ${who}` : v >= 15 ? `liked by ${who}` : v > -15 ? `little known to ${who}` : v > -40 ? `disliked by ${who}` : `hated by ${who}`;
}

export function PersonPanel({ s, id }: { s: GameState; id: string | null }) {
  const ui = useUI();
  const c = id ? s.chars[id] : undefined;
  if (!c) return <p className="muted">Click a name to see what you know of him.</p>;
  const me = c.id === s.playerId;
  const fam = c.familyId ? s.families[c.familyId] : undefined;
  const op = opinion(s, c.id, s.playerId);
  const mine = opinion(s, s.playerId, c.id);
  const mems = memoriesAbout(s, c.id, s.playerId).sort((a, b) => b.day - a.day);
  const offs = officesOf(s, c.id);
  const ties = tiesOf(s, c.id).filter((t) => s.chars[t.other]?.alive);
  const owesMe = favorsOwed(s, c.id, s.playerId);
  const iOwe = favorsOwed(s, s.playerId, c.id);
  const dig = standingOf(s, c.id, 'dignitas');
  const people = standingOf(s, c.id, 'people');
  const boni = standingOf(s, c.id, 'boni');
  const why = me ? [] : whyMatters(s, c.id);
  return (
    <div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Portrait c={c} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ marginBottom: 0 }}>{fullName(c)}{!c.alive && ' †'}</h2>
          <div className="small muted">
            {c.female ? '' : `${ageOf(s, c)} years old · `}
            {c.rank === 'senator' ? 'senator' : c.rank === 'eques' ? 'of equestrian rank' : 'plebeian'} · {fam?.name ?? 'no great house'} · tribe {c.tribe}
            {c.location !== 'rome' && c.alive ? ` · ${c.location === 'abroad' ? 'abroad' : c.location}` : ''}
          </div>
          {c.died && <div className="small bad">Died {shortDate(c.died.day)}: {c.died.cause}.</div>}
          {why.length > 0 && (
            <div className="row small" style={{ marginTop: 4, gap: '0.3rem' }}>
              {why.slice(0, 5).map((r, i) => (
                <span key={i} className={`chip ${r.tone === 'good' ? 'green' : r.tone === 'bad' ? 'red' : ''}`}>{r.text}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      {me && <p><i>{seenAs(s)}</i></p>}
      {c.bio && <p>{c.bio}</p>}
      {!c.female && (
        <p className="small">
          {traitWords(c).join(', ') || 'unremarkable'}; {leanLabel(c.lean)}. Oratory: {skillWord(c.oratory)}{me ? ` (${Math.round(c.oratory)})` : ''}. Law: {skillWord(c.law)}{me ? ` (${Math.round(c.law)})` : ''}.
        </p>
      )}
      <div className="small">
        <Why b={dig} note="Dignitas: rank and honor.">{rankWords(dig.total)}</Why>; <Why b={people} note="Favor of the people.">{favorWords(people.total, 'the people')}</Why>; <Why b={boni} note="Favor of the boni.">{favorWords(boni.total, 'the boni')}</Why>.
      </div>
      {!me && c.alive && (
        <div className="card" style={{ marginTop: '0.6rem' }}>
          <Why b={op} note="What he thinks of you, and why (hover for the numbers).">
            <b>{stanceLine(s, c.id)}</b>
          </Why>
          {mems.length > 0 && (
            <ul className="list small" style={{ marginTop: 4 }}>
              {mems.slice(0, 6).map((m, i) => (
                <li key={i} className={m.now >= 0 ? 'good' : 'bad'}>
                  <Why b={{ total: Math.round(m.now * 10) / 10, parts: [{ label: `“${m.act}”, ${shortDate(m.day)}`, value: Math.round(m.now * 10) / 10 }] }} note={m.halfLife ? 'Fades with time.' : 'He will never forget it.'}>
                    {youDid(m.act).replace(/^./, (x) => x.toUpperCase())}
                  </Why>
                  <span className="muted"> · {shortDate(m.day)}</span>
                </li>
              ))}
            </ul>
          )}
          {owesMe.length > 0 && <div className="small good">He owes you: {owesMe.map((f) => f.reason.toLowerCase()).join('; ')}.</div>}
          {iOwe.length > 0 && <div className="small bad">You owe him: {iOwe.map((f) => f.reason.toLowerCase()).join('; ')}.</div>}
          <div className="small muted" style={{ marginTop: 4 }}>
            You think of him: <Why b={mine}>{opinionWord(mine.total).toLowerCase()}</Why>.
          </div>
        </div>
      )}
      {!me && c.alive && <PersonActions s={s} id={c.id} />}
      {me && <YourselfDetails s={s} />}
      {offs.length > 0 && (
        <>
          <h4>Career</h4>
          <div className="small">{offs.map((o) => `${OFFICES[o.office].label} ${o.yearBC}`).join(' · ')}</div>
        </>
      )}
      {(c.patronId || ties.length > 0 || clientsOf(s, c.id).length > 0) && <h4>Connections</h4>}
      <div className="small">
        {c.patronId && <div>Patron: <Name s={s} id={c.patronId} /></div>}
        {ties.map((t, i) => (
          <div key={i}>
            {t.kind === 'amicus' ? 'Friend of' : t.kind === 'inimicus' ? 'Enemy of' : 'Kin to'} <Name s={s} id={t.other} />
          </div>
        ))}
        {clientsOf(s, c.id).length > 0 && <div>Clients: {clientsOf(s, c.id).map((x) => <span key={x.id}><Name s={s} id={x.id} /> </span>)}</div>}
      </div>
      {!me && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="ghost" onClick={() => ui.setPlace(c.home)}>Show his district</button>
        </div>
      )}
    </div>
  );
}

/** Visit, ask, call in a favor, invite: the person is the interface. */
function PersonActions({ s, id }: { s: GameState; id: string }) {
  const ui = useUI();
  const [ask, setAsk] = useState<Ask>('none');
  const [amount, setAmount] = useState(10000);
  const pl = s.chars[s.playerId];
  const t = s.chars[id];
  const asks = (Object.keys(ASK_LABELS) as Ask[]).filter((a) => !askBlocked(s, pl, t, a));
  const cur = asks.includes(ask) ? ask : 'none';
  const owed = favorBalance(s, id, s.playerId);
  const invited = ui.guests.includes(id);
  return (
    <>
      <h3>Act</h3>
      <ActionRow s={s} id="visit" params={{ target: id, ask: cur, amount }} label={cur === 'none' ? `Call on ${shortName(t)}` : ASK_LABELS[cur]}>
        <div className="row small" style={{ marginTop: 3 }}>
          <select id={`ask-${id}`} value={cur} onChange={(e) => setAsk(e.target.value as Ask)}>
            {asks.map((a) => (
              <option key={a} value={a}>
                {ASK_LABELS[a]}
              </option>
            ))}
          </select>
          {cur === 'loan' && (
            <select value={amount} onChange={(e) => setAmount(Number(e.target.value))}>
              {[5000, 10000, 20000, 50000].map((v) => (
                <option key={v} value={v}>
                  {fmtHS(v)}
                </option>
              ))}
            </select>
          )}
        </div>
        {owed > 0 && cur !== 'none' && <div className="small good">He owes you; asking now calls in the favor if he grants it.</div>}
      </ActionRow>
      {t.rank !== 'plebs' && (
        <div className="row">
          <button className="ghost" disabled={invited || ui.guests.length >= 3} onClick={() => ui.setGuests([...ui.guests, id])}>
            {invited ? 'Invited to your next dinner' : 'Invite to your next dinner'}
          </button>
          {ui.guests.length > 0 && (
            <a className="small" onClick={() => ui.setPlace(pl.home)}>
              Your table: {ui.guests.map((g) => shortName(s.chars[g])).join(', ')} →
            </a>
          )}
        </div>
      )}
    </>
  );
}

function YourselfDetails({ s }: { s: GameState }) {
  const me = s.chars[s.playerId];
  const ui = useUI();
  const father = me.fatherId ? s.chars[me.fatherId] : undefined;
  const mother = Object.values(s.chars).find((c) => c.female && c.familyId === me.familyId);
  const recent = recentlyRemembered(s);
  const acct = s.money.accounts[me.id];
  return (
    <>
      <h3>Family</h3>
      <div className="small">
        {father ? (
          <div>
            Father: <Name s={s} id={father.id} />, {father.alive ? `${ageOf(s, father)}, at Arpinum.` : `died ${shortDate(father.died!.day)}.`}
            {father.alive && loansOwedBy(s, father.id).length > 0 && <span className="bad"> Owes {fmtHS(debtOf(s, father.id))}.</span>}
            {father.flags.soldLand ? <span className="bad"> Was forced to sell land.</span> : null}
          </div>
        ) : null}
        {mother && <div>Mother: {mother.nomen}, at Arpinum.</div>}
        <div className="muted">Wife, children and heir: see <a onClick={() => ui.setTab('family')}>the Family tab</a>.</div>
      </div>
      <h3>Lately, men remember</h3>
      {recent.length ? (
        <ul className="list small">
          {recent.map((r, i) => (
            <li key={i} className="spread">
              <span>
                <Name s={s} id={r.owner} />: “{r.act}” · {shortDate(r.day)}
              </span>
              <span className={r.value >= 0 ? 'good' : 'bad'}>{r.value > 0 ? '+' : ''}{r.value.toFixed(0)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">Nobody has had cause to remember you yet.</p>
      )}
      <h3>Your purse</h3>
      <div className="small">
        Cash {fmtHS(cashOf(s, me.id))} · debts {fmtHS(debtOf(s, me.id))}
        {me.flags.allowance ? ` · allowance from your father ${fmtHS(me.flags.allowance * 12)} a year` : ''}
        {acct?.income ? ` · estates ${fmtHS(acct.income)} a year` : ''} · household {fmtHS(acct?.upkeep ?? 0)} a year
      </div>
    </>
  );
}

export function PeoplePanel({ s }: { s: GameState }) {
  const [filter, setFilter] = useState<'all' | 'senators' | 'friends' | 'enemies' | 'young'>('all');
  const rows = Object.values(s.chars)
    .filter((c) => c.alive && c.id !== s.playerId && !c.female && ageOf(s, c) >= 16)
    .map((c) => ({ c, op: opinion(s, c.id, s.playerId).total, dig: standingOf(s, c.id, 'dignitas').total }))
    .filter((r) => (filter === 'senators' ? r.c.rank === 'senator' : filter === 'friends' ? r.op >= 10 : filter === 'enemies' ? r.op <= -10 : filter === 'young' ? ageOf(s, r.c) <= 32 : true))
    .sort((a, b) => b.dig - a.dig);
  return (
    <div>
      <div className="row" style={{ marginBottom: 6 }}>
        {(['all', 'senators', 'friends', 'enemies', 'young'] as const).map((f) => (
          <button key={f} className={`ghost ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <table className="t">
        <thead>
          <tr>
            <th>Name</th>
            <th>Age</th>
            <th>Dignitas</th>
            <th>Thinks of you</th>
            <th>Where</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ c, op, dig }) => (
            <tr key={c.id}>
              <td><Name s={s} id={c.id} /></td>
              <td>{ageOf(s, c)}</td>
              <td>{dig}</td>
              <td className={op >= 8 ? 'good' : op <= -8 ? 'bad' : ''}>{opinionWord(op)}</td>
              <td className="muted">{c.location === 'rome' ? c.home : c.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FavorsPanel({ s }: { s: GameState }) {
  const owed = s.network.favors.filter((f) => f.creditor === s.playerId);
  const owe = s.network.favors.filter((f) => f.debtor === s.playerId);
  const lent = loansHeldBy(s, s.playerId);
  const borrowed = loansOwedBy(s, s.playerId);
  return (
    <div>
      <h3>Owed to you</h3>
      {owed.length ? owed.map((f) => <div key={f.id} className="card green small"><Name s={s} id={f.debtor} />: {f.reason} <span className="muted">({shortDate(f.day)}, weight {f.weight})</span></div>) : <p className="small muted">No one owes you anything yet. Defend a man, lend him money, endorse him — and he will.</p>}
      <p className="small muted">Asking a man for something is easier when he owes you; if he grants it, the debt is spent.</p>
      <h3>You owe</h3>
      {owe.length ? owe.map((f) => <div key={f.id} className="card red small"><Name s={s} id={f.creditor} />: {f.reason} <span className="muted">({shortDate(f.day)}, weight {f.weight})</span></div>) : <p className="small muted">You owe no favors.</p>}
      <h3>Money lent and borrowed</h3>
      {lent.map((l) => <div key={l.id} className="small">You lent <Name s={s} id={l.borrower} /> {fmtHS(l.principal)} at {(l.monthlyRate * 100).toFixed(2)}% a month.</div>)}
      {borrowed.map((l) => <div key={l.id} className={`small ${l.called ? 'bad' : ''}`}>You owe <Name s={s} id={l.lender} /> {fmtHS(l.principal)} at {(l.monthlyRate * 100).toFixed(2)}% a month, due {shortDate(l.dueDay)}{l.called ? ` — called in, pay by ${shortDate(l.callDeadline!)}` : ''}.</div>)}
      {!lent.length && !borrowed.length && <p className="small muted">None.</p>}
      {(() => {
        const f = s.chars[s.playerId].fatherId;
        const fl = f ? loansOwedBy(s, f) : [];
        return fl.length ? (
          <>
            <h4>Your father’s debts</h4>
            {fl.map((l) => <div key={l.id} className={`small ${l.called ? 'bad' : ''}`}>He owes <Name s={s} id={l.lender} /> {fmtHS(l.principal)}{l.called ? ` — called in, due ${shortDate(l.callDeadline!)}` : ''}.</div>)}
          </>
        ) : null;
      })()}
    </div>
  );
}

export function GossipPanel({ s }: { s: GameState }) {
  const heard = s.news.items.filter((g) => g.heard).sort((a, b) => b.day - a.day);
  const waiting = s.news.items.filter((g) => !g.heard && g.day <= s.day).length;
  return (
    <div>
      <p className="small muted">Talk in the Forum. It runs ahead of the facts and is sometimes wrong. You hear it in the Forum, at dinner, or from your clients in the morning.</p>
      {waiting > 0 && <div className="card">There is fresh talk in the Forum you have not heard ({waiting}).</div>}
      {heard.map((g) => (
        <div key={g.id} className="card small">
          <div className="muted">{shortDate(g.day)}</div>
          {g.text}
        </div>
      ))}
    </div>
  );
}

export function ChroniclePanel({ s }: { s: GameState }) {
  const e = openElection(s);
  const pc = playerCase(s);
  const pl = s.chars[s.playerId];
  const upcoming: { day: number; text: string }[] = [];
  if (e) {
    for (const x of openElections(s)) {
      if (x.professioDeadline >= s.day && x === e) upcoming.push({ day: x.professioDeadline, text: 'Last day to declare a candidacy' });
      upcoming.push({ day: x.day, text: `Elections for ${OFFICES[x.office].label.toLowerCase()} on the Campus Martius` });
    }
  }
  if (pc?.trialDay) upcoming.push({ day: pc.trialDay, text: `Your trial: ${shortName(s.chars[pc.defendant])}` });
  if (pl.flags.returnDay) upcoming.push({ day: pl.flags.returnDay, text: 'You return to Rome' });
  const y = dateOf(s.day).yearBC;
  upcoming.push({ day: (133 - y + 1) * 365, text: 'New magistrates take office' });
  if (dateOf(s.day).month < 5) upcoming.push({ day: (133 - y) * 365 + 151, text: 'Candidacies for the quaestorship open' });
  for (const l of loansOwedBy(s, s.playerId)) upcoming.push({ day: l.called ? l.callDeadline! : l.dueDay, text: `Loan from ${shortName(s.chars[l.lender])} ${l.called ? 'must be repaid' : 'falls due'}` });
  upcoming.sort((a, b) => a.day - b.day);
  const log = [...s.log].reverse().slice(0, 150);
  return (
    <div>
      <h3>Coming</h3>
      <ul className="list small">
        {upcoming.map((u, i) => (
          <li key={i} className="spread">
            <span>{u.text}</span>
            <span className="muted">{shortDate(u.day)}</span>
          </li>
        ))}
      </ul>
      <h3>Chronicle</h3>
      <ul className="list small">
        {log.map((l, i) => (
          <li key={i}>
            <span className="muted">{shortDate(l.day)}</span> · <span className={l.kind === 'death' ? 'bad' : l.kind === 'player' ? '' : 'muted'}>{l.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CasePanel({ s }: { s: GameState }) {
  const c = playerCase(s);
  const ui = useUI();
  if (!c) {
    const past = s.courts.cases.filter((x) => x.verdict && (x.prosecutor === s.playerId || x.defender === s.playerId));
    return (
      <div>
        <p className="muted">You have no case in hand. Open cases are listed in the Forum.</p>
        {past.map((x) => (
          <div key={x.id} className="card small">
            {x.prosecutor === s.playerId ? 'You prosecuted' : 'You defended'} {shortName(s.chars[x.defendant])}: {x.verdict} ({x.votes?.convict}–{x.votes?.acquit}), {shortDate(x.verdictDay!)}.
          </div>
        ))}
      </div>
    );
  }
  const side = c.prosecutor === s.playerId ? 'prosecution' : 'defense';
  const prep = side === 'prosecution' ? c.prosecutionPrep : c.defensePrep;
  const theirs = side === 'prosecution' ? c.defensePrep : c.prosecutionPrep;
  const p = convictionChance(s, c);
  const win = side === 'prosecution' ? p : 1 - p;
  const ev = evidenceTerm(s, c);
  const rejected = c.jury.filter((j) => j.rejected && (j as { rejectedBy?: string }).rejectedBy === side).length;
  return (
    <div>
      <h2>{side === 'prosecution' ? 'Prosecuting' : 'Defending'} {shortName(s.chars[c.defendant])}</h2>
      <p className="small">
        Charge: {chargeLabel(c)} ({fmtHS(c.extorted)} claimed). Prosecutor <Name s={s} id={c.prosecutor} />; defender{' '}
        {c.defender ? <Name s={s} id={c.defender} /> : <span className="muted">not yet chosen</span>}. Jury of {c.jury.filter((j) => !j.rejected).length} {c.juryClass === 'senator' ? 'senators' : 'equites'}. Trial on <b>{shortDate(c.trialDay!)}</b>.
      </p>
      <div className="card green">
        If the jury voted today, your chance: <Why b={ev} digits={2} note="Evidence and preparation (log-odds). Each juror adds his own leanings."><Odds p={win} /></Why>
        <div className="small muted">Preparation: witnesses {prep.witnesses}/3, documents {prep.documents}/3, jury researched {prep.research ? 'yes' : 'no'}, co-counsel {prep.coCounsel ? shortName(s.chars[prep.coCounsel]) : 'none'}. The other side: witnesses {theirs.witnesses}, documents {theirs.documents}.</div>
        <div className="row" style={{ marginTop: 4 }}>
          <button className="ghost" onClick={() => ui.setPlace('forum')}>Prepare in the Forum →</button>
        </div>
        <div className="small muted">Interview witnesses, search the records and learn the jurors from the Forum; ask a skilled speaker to join you by calling on him.</div>
      </div>
      <h3>The jury</h3>
      {!prep.research && <p className="small muted">You do not know these men’s leanings. Learn the jurors to see them and to reject up to four.</p>}
      <table className="t">
        <thead>
          <tr>
            <th>Juror</th>
            <th>Leans</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {c.jury.map((j) => {
            const lean = jurorLean(s, c, j).total + ev.total + c.sway;
            const toward = side === 'prosecution' ? lean : -lean;
            return (
              <tr key={j.id} style={{ opacity: j.rejected ? 0.4 : 1 }}>
                <td>{j.charId ? <Name s={s} id={j.charId} /> : j.label}</td>
                <td>{prep.research ? <Why b={jurorLean(s, c, j)} digits={2}><span className={toward > 0.3 ? 'good' : toward < -0.3 ? 'bad' : ''}>{toward > 0.3 ? 'your way' : toward < -0.3 ? 'against you' : 'undecided'}</span></Why> : <span className="muted">?</span>}</td>
                <td>{prep.research > 0 && !j.rejected && c.status === 'prep' && rejected < 4 && <button className="ghost" onClick={() => run({ type: 'case.reject', jurorId: j.id })}>Reject</button>}{j.rejected ? 'rejected' : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ElectionPanel({ s }: { s: GameState }) {
  const open = openElections(s);
  const [pick, setPick] = useState<string | null>(null);
  const e = open.find((x) => x.id === pick) ?? openElection(s);
  const held = s.offices.elections.filter((x) => x.status === 'held');
  const lastYear = held.length ? held[held.length - 1].forYearBC : undefined;
  const chooser = open.length > 1 && (
    <div className="tabs">
      {open.map((x) => (
        <button key={x.id} className={`ghost ${x.id === e?.id ? 'on' : ''}`} onClick={() => setPick(x.id)}>
          {OFFICES[x.office].label}
        </button>
      ))}
    </div>
  );
  if (!e) {
    return (
      <div>
        <p className="muted">No election is open. Candidacies open on the Kalends of Iunius; the magistrates are elected in Quintilis, consuls first and quaestors last.</p>
        {lastYear !== undefined && <h3>Elected last summer, for {lastYear} BC</h3>}
        {held.filter((x) => x.forYearBC === lastYear && x.results).map((x) => (
          <div key={x.id} className="small">
            <b>{OFFICES[x.office].label}:</b> {x.results!.winners.map((w, i) => <span key={w}>{i ? ', ' : ''}<Name s={s} id={w} /></span>)}
          </div>
        ))}
      </div>
    );
  }
  const unit = assemblyOf(e.office) === 'centuriate' ? 'centuries' : 'tribes';
  const profs = profiles(s, e);
  const proj = voteOnce(e, profs, null);
  const mine = e.candidates.find((c) => c.who === s.playerId);
  const chance = mine ? winChance(s, e, s.playerId) : null;
  const gap = mine ? voteGap(s, e, s.playerId) : 0;
  const ranked = [...profs].sort((a, b) => proj.tally[b.who].tribes - proj.tally[a.who].tribes || proj.tally[b.who].votes - proj.tally[a.who].votes);
  const myProf = mine ? profileOf(s, mine) : null;
  return (
    <div>
      {chooser}
      <h2>{OFFICES[e.office].label} for {e.forYearBC} BC</h2>
      <p className="small">
        {e.seats} seat{e.seats > 1 ? 's' : ''}. Declare by {shortDate(e.professioDeadline)}. Vote on <b>{shortDate(e.day)}</b>
        {e.postponements ? ` (postponed ${e.postponements}×)` : ''}.{' '}
        {assemblyOf(e.office) === 'centuriate'
          ? 'The centuriate assembly: 193 centuries voting by wealth, the equites and the first class first. The richest centuries count for most.'
          : `The tribal assembly: each of the 35 tribes returns its top ${e.seats}; the men who carry the most tribes are elected.`}
      </p>
      {mine && (
        <div className="card green">
          Your chance of election: <Why b={{ total: chance!, parts: [{ label: `Share of ${200} simulated votes you win`, value: chance! }] }} asPct note="The real vote is one of these simulations, picked at random."><Odds p={chance!} /></Why>
          {gap > 0 && <div className="small">On the expected count you are about {gap.toLocaleString('en-US')} votes short in the tribes that would put you in.</div>}
          {myProf && unit === 'tribes' && (
            <div className="small">
              Your pull in a country tribe: <Why b={{ total: appealParts(myProf, 'Romilia').reduce((a, x) => a + x.value, 0), parts: appealParts(myProf, 'Romilia') }} digits={2}>Romilia</Why> · in a city tribe: <Why b={{ total: appealParts(myProf, 'Suburana').reduce((a, x) => a + x.value, 0), parts: appealParts(myProf, 'Suburana') }} digits={2}>Suburana</Why>
            </div>
          )}
        </div>
      )}
      <table className="t">
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Dignitas</th>
            <th>People</th>
            <th>Boni</th>
            <th>{unit === 'tribes' ? 'Tribes' : 'Centuries'} (expected)</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((p, i) => (
            <tr key={p.who} className={p.who === s.playerId ? 'me' : ''}>
              <td>{i < e.seats ? '● ' : '○ '}<Name s={s} id={p.who} /></td>
              <td>{p.dig}</td>
              <td>{p.people}</td>
              <td>{p.boni}</td>
              <td>{proj.tally[p.who].tribes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {mine && (
        <>
          <h3>{unit === 'tribes' ? 'Tribe by tribe' : 'Century by century'} (expected)</h3>
          <table className="t">
            <thead>
              <tr>
                <th>{unit === 'tribes' ? 'Tribe' : 'Century'}</th>
                <th>Your votes</th>
                <th>Last seat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {proj.tribes.map((t) => {
                const lastSeat = t.votes[t.carried[t.carried.length - 1]];
                const inn = t.carried.includes(s.playerId);
                return (
                  <tr key={t.tribe}>
                    <td>{t.tribe}</td>
                    <td>{t.votes[s.playerId]}</td>
                    <td className="muted">{lastSeat}</td>
                    <td className={inn ? 'good' : 'bad'}>{inn ? 'carried' : `short ${lastSeat - t.votes[s.playerId] + 1}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export { BreakdownTable };

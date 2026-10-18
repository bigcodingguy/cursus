import { useState } from 'react';
import { CAMPAIGNS, CANVASS_ZONES, OFFICES, type CanvassZone } from '../content/offices';
import { PLACES } from '../content/places';
import { checkAction, getAction } from '../sim/core';
import { availableIssues, bankers, creditLimit } from '../sim/systems/city';
import { playerCase, chargeLabel } from '../sim/systems/courts/api';
import { cashOf, loansOwedBy } from '../sim/systems/money/api';
import { opinion } from '../sim/systems/network/api';
import { campaignOpen } from '../sim/systems/offices';
import { candidacyOf, ineligibleFor, openElection, openElections } from '../sim/systems/offices/api';
import { clientsOf } from '../sim/systems/news';
import { standingOf } from '../sim/systems/standing/api';
import type { ActionParams, GameState, PlaceId } from '../sim/types';
import { ageOf, fmtHS, fullName, shortName } from '../sim/util';
import { relevance, whyMatters } from './people';
import { Name, Odds, opinionWord, shortDate, useUI, Why } from './common';
import { run } from './store';

export function ActionRow({ s, id, params, label, children }: { s: GameState; id: string; params: ActionParams; label?: string; children?: React.ReactNode }) {
  const def = getAction(id)!;
  const pl = s.chars[s.playerId];
  const err = checkAction(s, s.playerId, id, params);
  const odds = !err && def.odds ? def.odds(s, pl, params) : null;
  const cost = def.cost?.(s, pl, params) ?? 0;
  const days = def.duration(s, pl, params);
  return (
    <div className="card">
      <div className="action">
        <div>
          <div className="title">{label ?? def.label}</div>
          {def.blurb && <div className="small muted">{def.blurb}</div>}
          {children}
          <div className="small muted">
            {days ? `${days} day${days > 1 ? 's' : ''}` : 'at once'}
            {cost ? ` · ${fmtHS(cost)}` : ''}
          </div>
          {err && <div className="why-reason">{err}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          {odds && (
            <div className="small">
              <Why b={odds} asPct={odds.parts.every((p) => Math.abs(p.value) <= 1)} note="The chance shown is the chance used.">
                <Odds p={odds.total} />
              </Why>
            </div>
          )}
          <button disabled={!!err} onClick={() => run({ type: 'act', action: id, params })}>
            Go
          </button>
        </div>
      </div>
    </div>
  );
}

/** A household as a compact row: who he is to you, and a click opens his card. */
function PersonRow({ s, id }: { s: GameState; id: string }) {
  const ui = useUI();
  const c = s.chars[id];
  const why = whyMatters(s, id);
  const op = opinion(s, id, s.playerId).total;
  return (
    <li className="spread">
      <span>
        <Name s={s} id={id} /> <span className="muted small">{c.rank === 'senator' ? 'senator' : c.rank === 'eques' ? 'eques' : 'plebeian'}</span>
        {why.slice(0, 2).map((r, i) => (
          <span key={i} className={`chip ${r.tone === 'good' ? 'green' : r.tone === 'bad' ? 'red' : ''}`} style={{ marginLeft: 4 }}>
            {r.text}
          </span>
        ))}
      </span>
      <span className="small">
        <span className={op >= 8 ? 'good' : op <= -8 ? 'bad' : 'muted'}>{opinionWord(op)}</span> · <a onClick={() => ui.showPerson(id)}>open</a>
      </span>
    </li>
  );
}

function Households({ s, place }: { s: GameState; place: PlaceId }) {
  const [all, setAll] = useState(false);
  const residents = Object.values(s.chars)
    .filter((c) => c.alive && c.home === place && c.location === 'rome' && c.id !== s.playerId && ageOf(s, c) >= 16 && !c.female)
    .map((c) => ({ c, r: relevance(s, c.id) + standingOf(s, c.id, 'dignitas').total / 60 }))
    .sort((a, b) => b.r - a.r);
  if (!residents.length) return null;
  const shown = all ? residents : residents.slice(0, 6);
  return (
    <>
      <h3>Households here</h3>
      <p className="small muted">Those who matter to you first. Click a name to call on him, ask a favor or invite him to dine.</p>
      <ul className="list">
        {shown.map(({ c }) => (
          <PersonRow key={c.id} s={s} id={c.id} />
        ))}
      </ul>
      {residents.length > shown.length && (
        <a className="small" onClick={() => setAll(true)}>
          Show all {residents.length}
        </a>
      )}
    </>
  );
}

function Forum({ s }: { s: GameState }) {
  const ui = useUI();
  const issues = availableIssues(s);
  const [issue, setIssue] = useState(issues[0]?.id ?? '');
  const [stance, setStance] = useState<'for' | 'against'>('for');
  const cur = issues.find((i) => i.id === issue) ?? issues[0];
  const pc = playerCase(s);
  const open = s.courts.cases.filter((c) => c.status === 'open');
  const bs = bankers(s);
  const [lender, setLender] = useState(bs[0]?.id ?? '');
  const [amt, setAmt] = useState(10000);
  const loans = loansOwedBy(s, s.playerId);
  return (
    <>
      <ActionRow s={s} id="listen" params={{}} />
      <ActionRow s={s} id="observe" params={{}} />
      {cur && (
        <ActionRow s={s} id="speak" params={{ issue: cur.id, stance }}>
          <div className="row small" style={{ marginTop: 3 }}>
            <select value={cur.id} onChange={(e) => setIssue(e.target.value)}>
              {issues.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
            <select value={stance} onChange={(e) => setStance(e.target.value as 'for' | 'against')}>
              <option value="for">{cur.forLabel}</option>
              <option value="against">{cur.againstLabel}</option>
            </select>
            <span className="muted">The crowd favors: {cur.popular === 'for' ? cur.forLabel.toLowerCase() : cur.againstLabel.toLowerCase()}</span>
          </div>
        </ActionRow>
      )}
      <h3>The extortion court</h3>
      {pc && (
        <div className="card red">
          You have a case in hand: {pc.prosecutor === s.playerId ? 'prosecuting' : 'defending'} <Name s={s} id={pc.defendant} />. Trial on {shortDate(pc.trialDay!)}.{' '}
          <a onClick={() => ui.setTab('case')}>See the case and the jury →</a>
        </div>
      )}
      {pc && pc.status === 'prep' && <CasePrep s={s} caseId={pc.id} />}
      {!open.length && <p className="small muted">No governor stands accused just now. Cases open when men come home from the provinces and their victims follow them.</p>}
      {open.map((c) => (
        <ActionRow key={c.id} s={s} id="prosecute" params={{ caseId: c.id }} label={`Prosecute ${shortName(s.chars[c.defendant])}`}>
          <div className="small">
            Charged with {chargeLabel(c)}. {c.charge === 'ambitus' ? 'Said to have paid out' : 'The envoys claim'} {fmtHS(c.extorted)}. <Name s={s} id={c.defendant} /> · dignitas {standingOf(s, c.defendant, 'dignitas').total}
          </div>
          <div className="small muted">The envoys’ case looks {c.evidence > 0.7 ? 'strong' : c.evidence > 0.45 ? 'arguable' : 'thin'}. Juries are drawn from the {c.juryClass === 'senator' ? 'Senate' : 'equites'}.</div>
        </ActionRow>
      ))}
      <h3>The bankers’ stalls</h3>
      <ActionRow s={s} id="borrow" params={{ lender, amount: amt }}>
        <div className="row small" style={{ marginTop: 3 }}>
          <select value={lender} onChange={(e) => setLender(e.target.value)}>
            {bs.map((b) => (
              <option key={b.id} value={b.id}>
                {shortName(b)}
              </option>
            ))}
          </select>
          <select value={amt} onChange={(e) => setAmt(Number(e.target.value))}>
            {[5000, 10000, 20000, 50000, 100000].map((v) => (
              <option key={v} value={v}>
                {fmtHS(v)}
              </option>
            ))}
          </select>
          <span className="muted">They will lend you up to {fmtHS(creditLimit(s, s.playerId))} more.</span>
        </div>
      </ActionRow>
      {loans.map((l) => (
        <ActionRow key={l.id} s={s} id="repay" params={{ loanId: l.id }} label={`Repay ${shortName(s.chars[l.lender])}: ${fmtHS(l.principal)}`}>
          <div className="small muted">
            {Math.round(l.monthlyRate * 1000) / 10}% a month · due {shortDate(l.dueDay)} {l.called && <b className="bad">· CALLED IN: pay by {shortDate(l.callDeadline!)}</b>}
          </div>
        </ActionRow>
      ))}
    </>
  );
}

function CasePrep({ s, caseId }: { s: GameState; caseId: string }) {
  const c = s.courts.cases.find((x) => x.id === caseId)!;
  const jurors = c.jury.filter((j) => !j.rejected && !j.bribedBy);
  const [juror, setJuror] = useState(jurors[0]?.id ?? '');
  const [amount, setAmount] = useState(10000);
  return (
    <>
      <ActionRow s={s} id="case.research" params={{ caseId }} />
      <ActionRow s={s} id="case.witnesses" params={{ caseId }} />
      <ActionRow s={s} id="case.documents" params={{ caseId }} />
      <ActionRow s={s} id="case.tamper" params={{ caseId, jurorId: juror, amount }}>
        <div className="row small" style={{ marginTop: 3 }}>
          <select value={juror} onChange={(e) => setJuror(e.target.value)}>
            {jurors.map((j) => (
              <option key={j.id} value={j.id}>
                {j.charId ? shortName(s.chars[j.charId]) : j.label}
              </option>
            ))}
          </select>
          <select value={amount} onChange={(e) => setAmount(Number(e.target.value))}>
            {[5000, 10000, 20000, 40000].map((v) => (
              <option key={v} value={v}>
                {fmtHS(v)}
              </option>
            ))}
          </select>
        </div>
        <div className="small bad">Corrupting a jury is a crime, and a scandal if it comes out. Some men take the money and vote as they please.</div>
      </ActionRow>
      <p className="small muted">To find co-counsel, call on a good speaker who likes you and ask him to join you.</p>
    </>
  );
}

function Campus({ s }: { s: GameState }) {
  const [zone, setZone] = useState<CanvassZone>('campus');
  const [gifts, setGifts] = useState(0);
  const camps = CAMPAIGNS.filter((c) => campaignOpen(s, c.id));
  const [camp, setCamp] = useState(camps[0]?.id ?? '');
  const e = openElection(s);
  const open = openElections(s);
  const ui = useUI();
  const ladder = ['censor', 'consul', 'praetor', 'aedile', 'tribune_pleb', 'quaestor'];
  // Offer the offices you could stand for; if none, the quaestorship with the reason you cannot.
  const standable = open.filter((x) => !ineligibleFor(s, s.chars[s.playerId], x.office, x.forYearBC)).sort((a, b) => ladder.indexOf(a.office) - ladder.indexOf(b.office));
  return (
    <>
      {e && (
        <div className="card green">
          Elections: candidates declare by {shortDate(e.professioDeadline)}; the votes run from {shortDate(Math.min(...open.map((x) => x.day)))} to {shortDate(Math.max(...open.map((x) => x.day)))}. <a onClick={() => ui.setTab('election')}>See the fields →</a>
        </div>
      )}
      {candidacyOf(s, s.playerId) && <div className="card">You are a candidate. Canvass below, and look for endorsements among the senators.</div>}
      {!candidacyOf(s, s.playerId) && (standable.length ? standable : open.filter((x) => x.office === 'quaestor')).map((x) => (
        <ActionRow key={x.id} s={s} id="declare" params={{ office: x.office }} label={`Stand for ${OFFICES[x.office].label.toLowerCase()}`} />
      ))}
      {!open.length && <ActionRow s={s} id="declare" params={{}} />}
      <ActionRow s={s} id="exercise" params={{}} />
      <ActionRow s={s} id="canvass" params={{ zone, gifts }} label={CANVASS_ZONES[zone].label}>
        <div className="row small" style={{ marginTop: 3 }}>
          <select value={zone} onChange={(e) => setZone(e.target.value as CanvassZone)}>
            <option value="campus">Country voters (31 rustic tribes)</option>
            <option value="arpinum">Ride to Arpinum (your tribe and neighbors)</option>
          </select>
          {candidacyOf(s, s.playerId) && (
            <select value={gifts} onChange={(e) => setGifts(Number(e.target.value))}>
              <option value={0}>No gifts</option>
              <option value={5000}>Gifts to voters: HS 5,000</option>
              <option value={15000}>Gifts to voters: HS 15,000</option>
              <option value={40000}>Gifts to voters: HS 40,000</option>
            </select>
          )}
        </div>
        {gifts > 0 && <div className="small bad">Bribery (ambitus) is illegal. It buys votes and costs you with the boni; there may be a reckoning later.</div>}
      </ActionRow>
      <ActionRow s={s} id="serve" params={{ campaign: camp }}>
        <div className="row small" style={{ marginTop: 3 }}>
          <select value={camp} onChange={(e) => setCamp(e.target.value)}>
            {camps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} — {Math.round(c.risk * 100)}% risk of death
              </option>
            ))}
          </select>
        </div>
      </ActionRow>
    </>
  );
}

function Subura({ s }: { s: GameState }) {
  const [gifts, setGifts] = useState(0);
  return (
    <ActionRow s={s} id="canvass" params={{ zone: 'subura', gifts }} label={CANVASS_ZONES.subura.label}>
      {candidacyOf(s, s.playerId) && (
        <div className="row small" style={{ marginTop: 3 }}>
          <select value={gifts} onChange={(e) => setGifts(Number(e.target.value))}>
            <option value={0}>No gifts</option>
            <option value={5000}>Gifts to voters: HS 5,000</option>
            <option value={15000}>Gifts to voters: HS 15,000</option>
          </select>
        </div>
      )}
    </ActionRow>
  );
}

function DinnerPicker({ s }: { s: GameState }) {
  const ui = useUI();
  const [q, setQ] = useState('');
  const me = s.chars[s.playerId];
  const candidates = Object.values(s.chars).filter((c) => c.alive && c.location === 'rome' && c.id !== me.id && !c.female && ageOf(s, c) >= 16 && c.rank !== 'plebs' && !ui.guests.includes(c.id));
  const suggested = candidates
    .map((c) => ({ c, r: relevance(s, c.id) + standingOf(s, c.id, 'dignitas').total / 40 }))
    .sort((a, b) => b.r - a.r)
    .slice(0, 6)
    .map((x) => x.c);
  const found = q.length >= 2 ? candidates.filter((c) => fullName(c).toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const add = (id: string) => ui.guests.length < 3 && ui.setGuests([...ui.guests, id]);
  const row = (id: string) => {
    const why = whyMatters(s, id)[0];
    return (
      <li key={id} className="spread">
        <span>
          <Name s={s} id={id} /> {why && <span className="chip">{why.text}</span>}
        </span>
        <a className="small" onClick={() => add(id)}>
          invite
        </a>
      </li>
    );
  };
  return (
    <div className="small" style={{ marginTop: 4 }}>
      <div>
        At your table:{' '}
        {ui.guests.length ? (
          ui.guests.map((g) => (
            <span key={g} className="chip">
              {shortName(s.chars[g])} <a onClick={() => ui.setGuests(ui.guests.filter((x) => x !== g))}>×</a>
            </span>
          ))
        ) : (
          <span className="muted">nobody yet (up to three)</span>
        )}
      </div>
      {ui.guests.length < 3 && (
        <>
          <div className="muted" style={{ marginTop: 4 }}>Suggested: your patron’s circle, friends, and useful men</div>
          <ul className="list">{suggested.map((c) => row(c.id))}</ul>
          <input id="dinner-search" placeholder="Find someone else…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginTop: 4 }} />
          {found.length > 0 && <ul className="list">{found.map((c) => row(c.id))}</ul>}
        </>
      )}
    </div>
  );
}

function Home({ s }: { s: GameState }) {
  const ui = useUI();
  const [style, setStyle] = useState('modest');
  const pl = s.chars[s.playerId];
  const clients = clientsOf(s, pl.id);
  return (
    <>
      <div className="card">
        <div className="title">Mornings</div>
        <div className="small muted">Every Roman morning begins with the salutatio. This runs each day you are in Rome, whatever else you do.</div>
        <div className="row" style={{ marginTop: 4 }}>
          {(['attend', 'receive', 'none'] as const).map((r) => (
            <button key={r} className={`ghost ${s.routine === r ? 'on' : ''}`} onClick={() => run({ type: 'routine', value: r })}>
              {r === 'attend' ? 'Attend your patron' : r === 'receive' ? 'Receive your clients' : 'Lie in'}
            </button>
          ))}
        </div>
        <div className="small" style={{ marginTop: 4 }}>
          {s.routine === 'attend' && (pl.patronId ? <>You wait on <Name s={s} id={pl.patronId} /> at dawn and follow him to the Forum: he warms to you, and you learn the law by watching.</> : <span className="bad">You have no patron. Call on a senator and ask him.</span>)}
          {s.routine === 'receive' && (clients.length ? <>{clients.length} client{clients.length > 1 ? 's' : ''} at your door each morning. They bring you the city’s talk.</> : <span className="bad">You have no clients yet. Offer your protection to plebeians in the Subura or the Aventine.</span>)}
        </div>
      </div>
      <ActionRow s={s} id="dinner" params={{ guests: ui.guests, style }}>
        <div className="row small" style={{ marginTop: 3 }}>
          <select id="dinner-style" value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="modest">A modest table</option>
            <option value="fine">A fine dinner</option>
            <option value="lavish">A lavish feast</option>
          </select>
        </div>
        <DinnerPicker s={s} />
      </ActionRow>
    </>
  );
}

export function PlacePanel({ s, place }: { s: GameState; place: PlaceId }) {
  const def = PLACES.find((p) => p.id === place)!;
  const pl = s.chars[s.playerId];
  const busy = pl.action ? getAction(pl.action.id) : undefined;
  return (
    <div>
      <h2>{def.label}</h2>
      <p className="muted">{def.blurb}</p>
      {pl.location !== 'rome' && (
        <div className="card red">
          You are {pl.location === 'abroad' ? 'away with the army' : pl.location === 'arpinum' ? 'at Arpinum' : 'in exile'}
          {pl.flags.returnDay ? ` until ${shortDate(pl.flags.returnDay)}` : ''}. Let time run.
        </div>
      )}
      {busy && pl.location === 'rome' && (
        <div className="card">
          Busy: {busy.label.toLowerCase()} until {shortDate(pl.action!.endDay)}. Let time run.
        </div>
      )}
      {cashOf(s, s.playerId) < 0 && <div className="card red">Your accounts are in arrears.</div>}
      {place === 'forum' && <Forum s={s} />}
      {place === 'campus' && <Campus s={s} />}
      {place === 'subura' && <Subura s={s} />}
      {place === pl.home && <Home s={s} />}
      {place === 'palatine' && <ActionRow s={s} id="study" params={{}} />}
      <Households s={s} place={place} />
      {place === 'capitol' && <p className="small muted">The assemblies meet here for the tribunes’ elections and on high occasions. Nobody lives on the Capitol but the gods.</p>}
    </div>
  );
}

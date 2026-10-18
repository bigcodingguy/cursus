import { useState } from 'react';
import { ROUND_NAMES, STRATEGIES, convictionChance, optionOdds, playerCase, chargeLabel } from '../sim/systems/courts/api';
import { eventDef, eventText, visibleChoices } from '../sim/systems/events/api';
import { candidacyOf, openElection, voteGap, winChance } from '../sim/systems/offices/api';
import type { GameState } from '../sim/types';
import { shortName } from '../sim/util';
import { dateLine, Name, Odds, Why } from './common';
import { run } from './store';

function Paras({ text }: { text: string }) {
  return (
    <div className="text">
      {text.split('\n\n').map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export function EventModal({ s }: { s: GameState }) {
  const p = s.events.pending[0];
  if (!p) return null;
  const def = eventDef(p.eventId);
  const choices = visibleChoices(s, p);
  return (
    <div className="scrim">
      <div className="modal">
        <h2>{def?.title}</h2>
        <div className="date">{dateLine(s, p.day)}</div>
        <Paras text={eventText(s, p)} />
        {!p.outcome && (
          <div className="choices">
            {choices.map((c) => (
              <button key={c.index} onClick={() => run({ type: 'choose', uid: p.uid, choice: c.index })}>
                <span>{c.label}</span>
                {c.chance && (
                  <Why b={c.chance} asPct note="The chance shown is the chance used.">
                    <span className="odds">{Math.round(c.chance.total * 100)}%</span>
                  </Why>
                )}
              </button>
            ))}
            {!choices.length && <button onClick={() => run({ type: 'dismiss', uid: p.uid })}>Continue</button>}
          </div>
        )}
        {p.outcome && (
          <>
            <div className={`outcome ${p.outcome.roll && !p.outcome.roll.success ? 'fail' : ''}`}>
              {p.outcome.roll && (
                <div className="small muted">
                  Chance {Math.round(p.outcome.roll.chance * 100)}% — {p.outcome.roll.success ? 'it went your way' : 'it did not'}.
                </div>
              )}
              <Paras text={p.outcome.text} />
            </div>
            <div className="choices">
              <button onClick={() => run({ type: 'dismiss', uid: p.uid })}>Continue</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function TrialModal({ s }: { s: GameState }) {
  const c = playerCase(s);
  if (!c || c.status !== 'trial') return null;
  const side = c.prosecutor === s.playerId ? 'prosecution' : 'defense';
  const odds = optionOdds(s, c, side);
  const p = convictionChance(s, c);
  const now = side === 'prosecution' ? p : 1 - p;
  const opp = side === 'prosecution' ? c.defender : c.prosecutor;
  const round = c.rounds.length;
  const mix = c.npcMix ?? [0.25, 0.25, 0.25, 0.25];
  return (
    <div className="scrim">
      <div className="modal wide">
        <h2>The extortion court: {shortName(s.chars[c.defendant])}</h2>
        <div className="date">{dateLine(s)}</div>
        <p>
          In the Forum, before the praetor’s tribunal. {c.jury.filter((j) => !j.rejected).length} {c.juryClass === 'senator' ? 'senators' : 'equites'} sit as jurors. You speak for the {side}. Opposing you: <Name s={s} id={opp} />
          {opp === c.defendant ? ' (speaking for himself)' : ''}. The charge: {chargeLabel(c)}.
        </p>
        <div className="card green">
          If the jurors voted now: <Odds p={now} /> chance the verdict goes your way.
        </div>
        {c.rounds.map((r, i) => (
          <div key={i} className="small">
            {ROUND_NAMES[i]}: prosecution argued <b>{STRATEGIES.find((x) => x.id === r.prosecution)!.label.toLowerCase()}</b>, defense <b>{STRATEGIES.find((x) => x.id === r.defense)!.label.toLowerCase()}</b>.{' '}
            <span className={Math.abs(r.swing) < 0.1 ? 'muted' : (r.swing > 0) === (side === 'prosecution') ? 'good' : 'bad'}>{Math.abs(r.swing) < 0.1 ? 'Neither gained much.' : (r.swing > 0) === (side === 'prosecution') ? 'You had the better of it.' : 'They had the better of it.'}</span>
          </div>
        ))}
        <h3>
          {ROUND_NAMES[round]} (round {round + 1} of 3)
        </h3>
        <p className="small muted">
          Your opponent is likely to argue: {STRATEGIES.map((x, k) => `${x.label.toLowerCase()} ${Math.round(mix[k] * 100)}%`).join(', ')}. Each line beats one other: facts beat pity, pity beats threats, threats beat character, character beats facts.
        </p>
        <div className="choices">
          {STRATEGIES.map((st) => {
            const o = odds.find((x) => x.strategy === st.id)!;
            return (
              <button key={st.id} onClick={() => run({ type: 'trial.move', strategy: st.id })}>
                <span>
                  <b>{st.label}</b> — <span className="small">{st.blurb}</span>
                </span>
                <span className="odds" title="Chance the verdict goes your way if the jury voted after this round, over your opponent's likely lines.">{Math.round(o.win * 100)}%</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function VoteModal({ s }: { s: GameState }) {
  const e = openElection(s);
  const [busy, setBusy] = useState(false);
  if (!e || e.day > s.day || !candidacyOf(s, s.playerId) || s.events.pending.length) return null;
  const p = winChance(s, e, s.playerId);
  const gap = voteGap(s, e, s.playerId);
  return (
    <div className="scrim">
      <div className="modal">
        <h2>The Campus Martius</h2>
        <div className="date">{dateLine(s)}</div>
        <p>The tribes file into their enclosures. Each man crosses the narrow bridge and drops his tablet in the basket. The presiding consul draws lots for the order the tribes will be counted.</p>
        <div className="card green">
          Your chance of election: <Odds p={p} />
          {gap > 0 && <div className="small">On the expected count you are about {gap.toLocaleString('en-US')} votes short.</div>}
          <div className="small muted">The count is one of the simulated votes behind that number, picked by lot.</div>
        </div>
        <div className="choices">
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              run({ type: 'election.vote' });
              setBusy(false);
            }}
          >
            Hear the count
          </button>
        </div>
      </div>
    </div>
  );
}

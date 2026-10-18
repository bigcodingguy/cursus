// The family (marriage, children, heir, the tomb) and the laws before the people.
import { LAWS } from '../content/laws';
import { availableLaws, canPropose, lawDef, passChance, pendingProposals, proposalOf } from '../sim/systems/assembly/api';
import { daughtersOf, heirOf, isNobilis, marriageable, marriageOf, sonsOf, spouseOf } from '../sim/systems/family/api';
import { holdsOffice } from '../sim/systems/offices/api';
import type { GameState } from '../sim/types';
import { ageOf, allChars, fmtHS, fullName } from '../sim/util';
import { Name, Odds, shortDate, Why } from './common';
import { ActionRow } from './PlacePanel';
import { run } from './store';

export function FamilyPanel({ s }: { s: GameState }) {
  const me = s.chars[s.playerId];
  const house = me.familyId ? s.families[me.familyId] : undefined;
  const wife = spouseOf(s, me.id);
  const m = marriageOf(s, me.id);
  const sons = sonsOf(s, me.id);
  const daughters = daughtersOf(s, me.id);
  const heir = heirOf(s, me.id);
  const age = ageOf(s, me);
  const brides = !wife && marriageable(s, me)
    ? allChars(s)
        .filter((w) => w.female && marriageable(s, w) && w.familyId !== me.familyId)
        .map((w) => ({ w, house: w.familyId ? s.families[w.familyId] : undefined }))
        .sort((a, b) => (b.house?.consulAncestors ?? 0) - (a.house?.consulAncestors ?? 0))
        .slice(0, 6)
    : [];
  const adoptees = age >= 30 && sons.length < 2
    ? allChars(s)
        .filter((c) => !c.female && c.alive && ageOf(s, c) >= 10 && ageOf(s, c) <= 25 && c.fatherId && c.fatherId !== me.id && s.chars[c.fatherId]?.alive && sonsOf(s, c.fatherId).length >= 2)
        .slice(0, 4)
    : [];
  return (
    <div>
      <h2>The house of the {house?.name ?? me.nomen}</h2>
      <p className="small">
        {house?.consulAncestors
          ? `${house.consulAncestors} consul${house.consulAncestors > 1 ? 's' : ''} in the family: the masks stand in the atrium, and the house is noble.`
          : 'No consul in the family yet. A man who reaches the consulship makes his house noble, and his mask goes up in the atrium.'}
        {isNobilis(s, me) ? '' : ' To the old families you are a new man.'}
      </p>
      {s.family.line.length > 1 && (
        <div className="small muted">
          Heads of the house: {s.family.line.map((id, i) => <span key={id}>{i ? ' → ' : ''}<Name s={s} id={id} /></span>)}
        </div>
      )}

      <h3>Wife</h3>
      {wife ? (
        <div className="small">
          <Name s={s} id={wife.id} full />, {ageOf(s, wife)}.{m?.dowry ? ` Her dowry was ${fmtHS(m.dowry)}; it goes back to her family if you divorce.` : ''}
        </div>
      ) : (
        <div className="small muted">{marriageable(s, me) ? 'Unmarried. A wife brings a dowry and her family as your kin.' : 'Too young to marry (18).'}</div>
      )}
      {wife && <ActionRow s={s} id="divorce" params={{}} />}
      {brides.map(({ w, house: h }) => (
        <ActionRow key={w.id} s={s} id="propose_marriage" params={{ bride: w.id }} label={`Ask for the hand of ${fullName(w)}`}>
          <div className="small">
            {ageOf(s, w)}, of the {h?.name ?? w.nomen}
            {h?.consulAncestors ? ` (${h.consulAncestors} consul${h.consulAncestors > 1 ? 's' : ''})` : ''}. <Name s={s} id={w.fatherId} />
          </div>
        </ActionRow>
      ))}

      <h3>Children</h3>
      {!sons.length && !daughters.length && <div className="small muted">None yet.</div>}
      <ul className="list small">
        {[...sons, ...daughters].sort((a, b) => b.bornBC - a.bornBC).map((c) => (
          <li key={c.id}>
            <Name s={s} id={c.id} full />, {ageOf(s, c)}
            {c.adoptedFrom ? ' (adopted)' : ''}
            {c.spouseId ? <> · married to <Name s={s} id={c.spouseId} /></> : ''}
            {!c.female && (heir === c.id ? <b> · your heir</b> : <> · <a onClick={() => run({ type: 'family.setHeir', id: c.id })}>name heir</a></>)}
          </li>
        ))}
      </ul>
      <p className="small muted">Your heir takes the house, its money and debts, its friends and enemies when you die. If you name none, it is your eldest son.</p>
      {adoptees.map((c) => (
        <ActionRow key={c.id} s={s} id="adopt" params={{ son: c.id }} label={`Adopt ${fullName(c)}`}>
          <div className="small">{ageOf(s, c)}, a younger son of <Name s={s} id={c.fatherId} />.</div>
        </ActionRow>
      ))}

      {s.family.elogia.length > 0 && (
        <>
          <h3>The tomb</h3>
          {s.family.elogia.map((e) => (
            <div key={e.who + e.day} className="card elogium">
              {e.lines.map((l, i) => (
                <div key={i} className={i === 0 ? 'title' : 'small'}>{l}</div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export function LawsPanel({ s }: { s: GameState }) {
  const me = s.chars[s.playerId];
  const pending = pendingProposals(s);
  const mine = proposalOf(s, me.id);
  const tribune = holdsOffice(s, me.id, 'tribune_pleb');
  const canBring = !canPropose(s, me);
  const recent = s.assembly.proposals.filter((p) => p.status !== 'pending').slice(-8).reverse();
  return (
    <div>
      <h2>Laws before the people</h2>
      <p className="small muted">
        A tribune of the plebs or a consul may post a bill; the tribes vote on it 24 days later. Any tribune can stop it with a veto. The chance shown is the chance used on the day, as things stand now.
      </p>
      {!pending.length && <p className="small">No bill is posted.</p>}
      {pending.map((p) => {
        const law = lawDef(p.law)!;
        const odds = passChance(s, p);
        return (
          <div key={p.id} className="card">
            <div className="spread">
              <b>{law.label}</b>
              <span className="small">
                <Why b={odds} asPct note="Each tribune is asked in turn; then the tribes vote.">
                  <Odds p={odds.total} />
                </Why>
              </span>
            </div>
            <div className="small">{law.blurb}</div>
            <div className="small muted">
              Proposed by <Name s={s} id={p.proposer} />. Vote on {shortDate(p.voteDay)}. {p.spoke.length - 1} speech{p.spoke.length === 2 ? '' : 'es'} so far.
            </div>
            {p.proposer === me.id ? (
              <button className="ghost" onClick={() => run({ type: 'law.withdraw' })}>Withdraw it</button>
            ) : (
              <div className="row">
                {!p.spoke.includes(me.id) && <ActionRow s={s} id="speak_on_law" params={{ proposal: p.id, side: 'for' }} label="Speak for it" />}
                {!p.spoke.includes(me.id) && <ActionRow s={s} id="speak_on_law" params={{ proposal: p.id, side: 'against' }} label="Speak against it" />}
                {tribune && <ActionRow s={s} id="veto_law" params={{ proposal: p.id }} />}
              </div>
            )}
          </div>
        );
      })}
      {canBring && !mine && (
        <>
          <h3>Bring a bill</h3>
          {availableLaws(s).map((l) => (
            <ActionRow key={l.id} s={s} id="propose_law" params={{ law: l.id }} label={l.label}>
              <div className="small">{l.blurb}</div>
              <div className="small muted">{l.side < -0.3 ? 'A popular measure.' : l.side > 0.3 ? 'The Senate’s kind of measure.' : 'Neither side’s.'}{(l.equites ?? 0) > 0.3 ? ' The equites want it.' : ''}</div>
            </ActionRow>
          ))}
          {!availableLaws(s).length && <p className="small muted">No bill can be brought just now.</p>}
        </>
      )}
      {!canBring && <p className="small muted">{canPropose(s, me)}.</p>}
      {recent.length > 0 && (
        <>
          <h3>Lately</h3>
          <ul className="list small">
            {recent.map((p) => (
              <li key={p.id}>
                {LAWS.find((l) => l.id === p.law)?.label}, by <Name s={s} id={p.proposer} />: <b>{p.status === 'vetoed' ? <>vetoed by <Name s={s} id={p.vetoedBy} /></> : p.status}</b> ({shortDate(p.voteDay)})
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

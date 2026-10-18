// Your circle: the few people who matter now, each as a card with a plain line about where you stand.
import { useState } from 'react';
import { opinion } from '../sim/systems/network/api';
import type { GameState } from '../sim/types';
import { Portrait, useUI, Why } from './common';
import { circle, displayName } from './people';
import { run } from './store';

export function CircleCards({ s }: { s: GameState }) {
  const ui = useUI();
  const list = circle(s);
  return (
    <div>
      {!list.length && <p className="small muted">You know no one in Rome yet. Find a patron on the Palatine.</p>}
      <div className="circle">
        {list.map((e) => {
          const c = s.chars[e.id];
          const op = opinion(s, e.id, s.playerId);
          const away = c.location !== 'rome';
          return (
            <div key={e.id} className={`pcard tone-${e.tone}`} onClick={() => ui.showPerson(e.id)} role="button">
              <Portrait c={c} />
              <div className="pbody">
                <div className="prole">{e.role}</div>
                <div className="pname">{displayName(s, c)}</div>
                <div className="pline">
                  <Why b={op} note="What he thinks of you, and why.">
                    <span>{e.line}</span>
                  </Why>
                </div>
              </div>
              {!c.female && !away && c.id !== s.playerId && (
                <button
                  className="ghost small pact"
                  title="Call on him (a day)"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    run({ type: 'act', action: 'visit', params: { target: c.id, ask: 'none', amount: 0 } });
                  }}
                >
                  Call on
                </button>
              )}
              {away && <span className="small muted pact">{c.location === 'abroad' ? 'abroad' : c.location}</span>}
            </div>
          );
        })}
      </div>
      <Everyone s={s} />
    </div>
  );
}

/** Everyone in Rome, for reference: never needed to play. */
function Everyone({ s }: { s: GameState }) {
  const [open, setOpen] = useState(false);
  const ui = useUI();
  const [q, setQ] = useState('');
  if (!open) {
    return (
      <div className="small" style={{ marginTop: '0.6rem' }}>
        <a onClick={() => setOpen(true)}>Everyone in Rome (reference) →</a>
      </div>
    );
  }
  const men = Object.values(s.chars)
    .filter((c) => c.alive && c.id !== s.playerId && (!q || `${c.praenomen} ${c.nomen} ${c.cognomen ?? ''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.rank === 'senator' ? 1 : 0) - (a.rank === 'senator' ? 1 : 0) || a.nomen.localeCompare(b.nomen))
    .slice(0, 60);
  return (
    <div style={{ marginTop: '0.6rem' }}>
      <div className="spread">
        <input placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
        <a className="small" onClick={() => setOpen(false)}>close</a>
      </div>
      <ul className="list small">
        {men.map((c) => (
          <li key={c.id}>
            <a onClick={() => ui.showPerson(c.id)}>{displayName(s, c, true)}</a> <span className="muted">· {c.rank === 'senator' ? 'senator' : c.rank === 'eques' ? 'eques' : 'plebeian'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

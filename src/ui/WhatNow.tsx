import { useState } from 'react';
import { PLACES } from '../content/places';
import { careerStage } from '../sim/dsl';
import type { GameState } from '../sim/types';
import { useUI } from './common';
import { ambitions, currentActivity, dayLabel, keyDates } from './people';

// The note is shown once per head of the house: at a new game, and when an heir takes over.
const key = (s: GameState) => `cursus.note.${s.seed}.${s.playerId}`;
function seen(s: GameState): boolean {
  try {
    return localStorage.getItem(key(s)) === '1';
  } catch {
    return false;
  }
}

const NOTES: Record<string, { title: string; body: string[] }> = {
  youth: {
    title: 'How to get on in Rome',
    body: [
      'You are sixteen, new from Arpinum, and nobody knows you. Rome runs on people: who owes whom, who remembers what. The cards on the right are the few who matter to you now.',
      'Three things win votes: dignitas (rank and honor), the favor of the people, and the favor of the boni (the old families). They often pull against each other.',
      'The road: find a patron, serve a campaign abroad, make a name in the courts, then stand for quaestor at 27. Let time run — the city brings you offers and trouble, and pauses when it needs you.',
    ],
  },
  junior: {
    title: 'Your house now',
    body: ['You are head of the house. The people on the right are those who matter to you now: your family, your patron, your friends and enemies — many of them your father’s.', 'Your next step is shown above. Let time run.'],
  },
  senator: {
    title: 'Your house now',
    body: ['You sit in the Senate and head the house. Your circle on the right shows who matters now; the Forum tab holds the laws, the courts and the elections.', 'Your next step is shown above. Let time run.'],
  },
  elder: {
    title: 'Your house now',
    body: ['You are among the first men of Rome. What is left is to keep what the house has won, and to launch your sons. The Family is under House.', 'Let time run.'],
  },
};

export function WhatNow({ s }: { s: GameState }) {
  const ui = useUI();
  const [dismissed, setDismissed] = useState(() => seen(s));
  const [more, setMore] = useState(false);
  // Only at the start of a new game, or of a new head of the house.
  const fresh = s.day - s.startDay < 365 || s.family.line.length > 1;
  const close = () => {
    try {
      localStorage.setItem(key(s), '1');
    } catch {
      /* private window: it shows again next time */
    }
    setDismissed(true);
  };
  if (fresh && !dismissed && !seen(s)) {
    const n = NOTES[careerStage(s, s.chars[s.playerId])];
    return (
      <div className="whatnow">
        <div className="spread">
          <span className="now">{n.title}</span>
          <a onClick={close}>Got it</a>
        </div>
        {n.body.map((p, i) => (
          <p key={i} className="small" style={{ margin: '0.35rem 0' }}>
            {p}
          </p>
        ))}
      </div>
    );
  }
  const amb = ambitions(s);
  const dates = keyDates(s);
  const shown = more ? amb : amb.slice(0, 1);
  return (
    <div className="whatnow">
      <div className="now">Now</div>
      <div className="small">{currentActivity(s)}</div>
      <ul className="list small">
        {shown.map((a, i) => (
          <li key={i}>
            <b>{i === 0 ? 'Next: ' : ''}{a.title}.</b> {a.step}{' '}
            {a.place && !a.done && <a onClick={() => ui.setPlace(a.place!)}>→ {PLACES.find((p) => p.id === a.place)?.label}</a>}
          </li>
        ))}
      </ul>
      <div className="small muted">
        {dates.slice(0, 2).map((d, i) => (
          <span key={i}>
            {i ? ' · ' : 'Coming: '}
            {d.text}, {dayLabel(d.day)}
          </span>
        ))}
        {amb.length > 1 && <> · <a onClick={() => setMore(!more)}>{more ? 'fewer aims' : `${amb.length - 1} more aim${amb.length > 2 ? 's' : ''}`}</a></>}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { PLACES } from '../content/places';
import type { GameState } from '../sim/types';
import { useUI } from './common';
import { ambitions, currentActivity, dayLabel, keyDates } from './people';

const KEY = 'cursus.onboarded';
function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** First-time explanation of the three standings and how to make progress. */
function Onboarding({ onClose }: { onClose: () => void }) {
  return (
    <div className="card green small">
      <div className="spread">
        <b>How to get on in Rome</b>
        <a onClick={onClose}>Got it</a>
      </div>
      <p>
        <b>Dignitas</b> is your rank and honor: birth, offices, service, famous cases. <b>The people</b> and <b>the boni</b> (the establishment) are two kinds of favor that often pull against each other. All three win votes. The country tribes listen most to the boni, the city to the people.
      </p>
      <p>
        Every man in Rome remembers what you did for him and against him. Visits, dinners and favors build that up; the people who matter to you are listed first in each district.
      </p>
      <p>
        <b>The road:</b> find a patron, study and watch the courts, serve a campaign, make a name with a speech or a prosecution, then stand for quaestor at 27. The panel below always shows your next step. Let time run; the city will bring you offers and trouble.
      </p>
    </div>
  );
}

export function WhatNow({ s }: { s: GameState }) {
  const ui = useUI();
  const [onboarded, setOnboarded] = useState(seen);
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* private window: the note just comes back next time */
    }
    setOnboarded(true);
  };
  const [more, setMore] = useState(false);
  const amb = ambitions(s);
  const dates = keyDates(s);
  // The first-time note replaces the panel until dismissed, so the column never carries both.
  if (!onboarded) return <div className="whatnow"><Onboarding onClose={close} /></div>;
  const shown = more ? amb : amb.slice(0, 1);
  return (
    <div className="whatnow">
      <div className="small">
        <b>Now:</b> {currentActivity(s)}
      </div>
      <ul className="list small">
        {shown.map((a, i) => (
          <li key={i}>
            <b>{i === 0 ? 'Next: ' : ''}{a.title}.</b> {a.step}{' '}
            {a.place && !a.done && <a onClick={() => ui.setPlace(a.place!)}>→ {PLACES.find((p) => p.id === a.place)?.label}</a>}
          </li>
        ))}
      </ul>
      <div className="small muted">
        {amb.length > 1 && <a onClick={() => setMore(!more)}>{more ? 'fewer' : `${amb.length - 1} more aim${amb.length > 2 ? 's' : ''}`}</a>}
        {amb.length > 1 && dates.length ? ' · ' : ''}
        {dates.map((d, i) => (
          <span key={i}>
            {i ? ' · ' : 'Coming: '}
            {d.text} {dayLabel(d.day)}
          </span>
        ))}
      </div>
    </div>
  );
}

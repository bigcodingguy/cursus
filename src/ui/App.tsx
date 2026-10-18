import { OFFICES } from '../content/offices';
import { useEffect, useRef, useState } from 'react';
import { PRAENOMINA, PLAYER_NOMINA } from '../content/cast';
import { violenceLevel } from '../sim/systems/crisis/api';
import { cashOf, debtOf } from '../sim/systems/money/api';
import { standingOf } from '../sim/systems/standing/api';
import type { GameState, PlaceId } from '../sim/types';
import { ageOf, fmtHS } from '../sim/util';
import { CityMap } from './CityMap';
import { consulsLine, dateLine, mainTab, Section, UICtx, Why, type Tab } from './common';
import { EventModal, TrialModal, VoteModal } from './Modals';
import { CasePanel, ChroniclePanel, ElectionPanel, FavorsPanel, GossipPanel, PersonPanel } from './Panels';
import { CircleCards } from './Circle';
import { PlacePanel } from './PlacePanel';
import { WhatNow } from './WhatNow';
import { FamilyPanel, LawsPanel } from './HousePanels';
import { pendingProposals } from '../sim/systems/assembly/api';
import { playerCase } from '../sim/systems/courts/api';
import { electionOfCandidate, openElections } from '../sim/systems/offices/api';
import { exportSave, importSave, loadSlot, quit, saveSlot, setSpeed, slotInfo, SPEEDS, startNew, toast, useStore } from './store';
import { plainDate } from '../sim/calendar';
import { blockedBy } from '../sim/core';

export function App() {
  const st = useStore();
  return (
    <>
      {st.s ? <Game s={st.s} speed={st.speed} version={st.version} /> : <Title />}
      {st.toast && <div className="toast">{st.toast}</div>}
    </>
  );
}

function Title() {
  const [prae, setPrae] = useState('Marcus');
  const [nomen, setNomen] = useState('Gratidius');
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1e6)));
  const fileRef = useRef<HTMLInputElement>(null);
  const auto = slotInfo('auto');
  return (
    <div className="title-screen">
      <div className="title-card">
        <h1>CVRSVS</h1>
        <div className="tag">A Roman life through the fall of the Republic · 133–100 BC</div>
        <p>
          Spring, 133 BC. You are sixteen, a <i>novus homo</i> from Arpinum, the son of a modestly wealthy equestrian. No man of your family has ever sat in the Senate. Win people — patrons, clients, friends, enemies — and climb.
        </p>
        <div className="row">
          <div>
            <label>Praenomen</label>
            <select value={prae} onChange={(e) => setPrae(e.target.value)}>
              {PRAENOMINA.slice(0, 9).map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Nomen</label>
            <select value={nomen} onChange={(e) => setNomen(e.target.value)}>
              {PLAYER_NOMINA.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Seed</label>
            <input value={seed} onChange={(e) => setSeed(e.target.value)} size={9} />
          </div>
        </div>
        <div className="row" style={{ marginTop: '1rem' }}>
          <button onClick={() => startNew({ seed: /^\d+$/.test(seed) ? Number(seed) : seed, praenomen: prae, nomen })}>Begin</button>
          {auto && (
            <button className="green" onClick={async () => { const e = await loadSlot('auto'); if (e) toast(e); }}>
              Continue ({plainDate(Number(auto))})
            </button>
          )}
          <button className="ghost" onClick={() => fileRef.current?.click()}>Load a save file</button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const err = importSave(await f.text()); if (err) toast(err); } }} />
        </div>
        <p className="small muted" style={{ marginTop: '1rem' }}>
          Placeholder art. Saves stay in this browser (and in files you download). The game currently runs to the close of 100 BC.
        </p>
      </div>
    </div>
  );
}

function SaveMenu({ onClose }: { onClose: () => void }) {
  const slots = ['1', '2', '3'];
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Saves</h2>
        {slots.map((sl) => {
          const info = slotInfo(sl);
          return (
            <div key={sl} className="card spread">
              <span>Slot {sl}: {info ? plainDate(Number(info)) : <span className="muted">empty</span>}</span>
              <span className="row">
                <button onClick={async () => { const e = await saveSlot(sl); if (!e) toast('Saved'); onClose(); }}>Save</button>
                <button className="ghost" disabled={!info} onClick={async () => { const e = await loadSlot(sl); toast(e ?? 'Loaded'); onClose(); }}>Load</button>
              </span>
            </div>
          );
        })}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="ghost" onClick={() => {
            const t = exportSave();
            if (!t) return;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([t], { type: 'application/json' }));
            a.download = 'cursus-save.json';
            a.click();
          }}>Download save file</button>
          <button className="ghost" onClick={() => { if (confirm('Leave this game? It is saved to the autosave slot first.')) { void saveSlot('auto').then((e) => { if (!e) { quit(); onClose(); } }); } }}>Title screen</button>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
        <p className="small muted">The game also saves itself every month of game time.</p>
      </div>
    </div>
  );
}

function Help({ onClose }: { onClose: () => void }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>How to play</h2>
        <p><b>Time.</b> One day passes per tick. Use the speed buttons (or the space bar) to let time run; the game pauses itself when something needs you.</p>
        <p><b>The city.</b> Click a district on the map to act there: the Forum for speeches, courts and bankers; the Campus Martius for the army and the elections; your own house for your mornings and dinners.</p>
        <p><b>People.</b> The cards on the right are the few people who matter to you now. Click one to see what he remembers of you and to call on him, ask a favor, or invite him to dine. Everyone else is a click away under “Everyone in Rome”, but you never need it.</p>
        <p><b>Now.</b> The dark box at the top right always says what you are doing and what to do next.</p>
        <p><b>House, Forum, Record.</b> Your family and debts; the laws, your case, the elections and the gossip; the calendar and what has happened.</p>
        <p><b>Numbers.</b> Everything is said in words first. Hover over an underlined phrase to see the numbers behind it. When you gamble, the chance shown is the chance used.</p>
        <div className="choices"><button onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function TopBar({ s, speed }: { s: GameState; speed: number }) {
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const p = s.chars[s.playerId];
  const dig = standingOf(s, p.id, 'dignitas');
  const people = standingOf(s, p.id, 'people');
  const boni = standingOf(s, p.id, 'boni');
  const v = violenceLevel(s);
  const blocked = blockedBy(s);
  return (
    <div className="topbar">
      <div>
        <div className="date">{dateLine(s)}</div>
        <div className="sub">{consulsLine(s)}</div>
      </div>
      <div className="row">
        {SPEEDS.map((_, i) => (
          <button key={i} className={`ghost ${speed === i ? 'on' : ''}`} disabled={!!blocked && i > 0} onClick={() => setSpeed(i)} title={i ? `${SPEEDS[i]} days a second` : 'Pause'}>
            {i === 0 ? '❚❚' : '▶'.repeat(Math.min(i, 3)) + (i === 4 ? '+' : '')}
          </button>
        ))}
      </div>
      <div className="stat">
        {p.praenomen} {p.nomen}, {ageOf(s, p)} · <b>{fmtHS(cashOf(s, p.id))}</b>
        {debtOf(s, p.id) > 0 && <span> (debts {fmtHS(debtOf(s, p.id))})</span>}
      </div>
      <div className="stat">
        Dignitas <Why b={dig}><b>{dig.total}</b></Why> · People <Why b={people}><b>{people.total}</b></Why> · Boni <Why b={boni}><b>{boni.total}</b></Why>
      </div>
      <div className="stat">
        Republic: <Why b={{ total: Math.round(s.crisis.stability), parts: [{ label: 'Stability (0–100)', value: Math.round(s.crisis.stability) }, { label: 'Land question (pressure)', value: Math.round(s.crisis.pressures.land ?? 0) }, { label: 'Italian allies (pressure)', value: Math.round(s.crisis.pressures.allies ?? 0) }] }} note="Lower stability means more violent politics."><b>{v.label}</b></Why>
      </div>
      <div className="row" style={{ marginLeft: 'auto' }}>
        <button className="ghost" onClick={() => setHelp(true)}>Help</button>
        <button className="ghost" onClick={() => setMenu(true)}>Saves</button>
      </div>
      {menu && <SaveMenu onClose={() => setMenu(false)} />}
      {help && <Help onClose={() => setHelp(false)} />}
    </div>
  );
}

function Ended({ s }: { s: GameState }) {
  const p = s.chars[s.playerId];
  return (
    <div className="scrim">
      <div className="modal">
        <h2>{p.alive ? 'The end of the slice' : 'Here lies…'}</h2>
        <p>{s.ended!.reason}</p>
        <p>
          {p.praenomen} {p.nomen} of Arpinum, aged {ageOf(s, p)}. Dignitas {standingOf(s, p.id, 'dignitas').total}.{' '}
          {(() => {
            const held = [...new Set(s.offices.records.filter((r) => r.who === p.id && r.office !== 'military_tribune').map((r) => OFFICES[r.office].label))];
            return held.length ? `${held.join(', ')}.` : 'Never held a magistracy at Rome.';
          })()}{' '}
          {s.family.line.length > 1 ? `The ${s.family.line.length}th head of the house to play.`.replace('2th', 'second').replace('3th', 'third') : ''}
        </p>
        <p className="small muted">The wider Mediterranean, the Social War and Sulla arrive in the next phase.</p>
        <div className="choices">
          <button onClick={() => quit()}>Title screen</button>
        </div>
      </div>
    </div>
  );
}

function Game({ s, speed, version }: { s: GameState; speed: number; version: number }) {
  const [place, setPlaceRaw] = useState<PlaceId>(s.chars[s.playerId].home);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const [tab, setTabRaw] = useState<Tab>('people');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setSpeed(speed ? 0 : 2);
      }
      if (e.code === 'Escape') setPlaceOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [speed]);
  const [guests, setGuests] = useState<string[]>([]);
  const setPlace = (p: PlaceId) => {
    setPlaceRaw(p);
    setPlaceOpen(true);
  };
  const setTab = (t: Tab) => {
    setTabRaw(mainTab(t));
    if (t !== 'person') setPerson(null);
  };
  const ui = { place, setPlace, person, showPerson: (id: string) => { setPerson(id); setTabRaw('people'); }, tab, setTab, guests, setGuests };
  const heardNew = s.news.items.filter((g) => !g.heard && g.day <= s.day).length;
  const active = (playerCase(s) ? 1 : 0) + (openElections(s).length ? 1 : 0) + pendingProposals(s).length;
  const cur = mainTab(tab);
  const tabs: [Tab, string][] = [
    ['people', 'People'],
    ['house', 'House'],
    ['forum', `Forum${active ? ` · ${active}` : heardNew ? ` · ${heardNew} new` : ''}`],
    ['record', 'Record'],
  ];
  return (
    <UICtx.Provider value={ui}>
      <div className="app">
        <TopBar s={s} speed={speed} />
        <div className="main">
          <div className="stage">
            <CityMap s={s} selected={place} onSelect={setPlace} version={version} />
            {!placeOpen && <div className="maphint">Click a district to act there.</div>}
            {placeOpen && (
              <div className="placeDrawer">
                <button className="ghost close" onClick={() => setPlaceOpen(false)} title="Close (Esc)">×</button>
                <PlacePanel s={s} place={place} />
              </div>
            )}
          </div>
          <aside className="side">
            <WhatNow s={s} />
            <div className="tabs">
              {tabs.map(([t, label]) => (
                <button key={t} className={`ghost ${cur === t ? 'on' : ''}`} onClick={() => setTab(t)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="panel">
              {cur === 'people' && (person ? (
                <>
                  <a className="small" onClick={() => setPerson(null)}>← Your circle</a>
                  <PersonPanel s={s} id={person} />
                </>
              ) : (
                <>
                  <div className="spread">
                    <h3 style={{ marginTop: 0 }}>Your circle</h3>
                    <a className="small" onClick={() => setPerson(s.playerId)}>You →</a>
                  </div>
                  <CircleCards s={s} />
                </>
              ))}
              {cur === 'house' && (
                <>
                  <FamilyPanel s={s} />
                  <Section title="Favors and debts">
                    <FavorsPanel s={s} />
                  </Section>
                </>
              )}
              {cur === 'forum' && (
                <>
                  {playerCase(s) && <Section title="Your case" open><CasePanel s={s} /></Section>}
                  {openElections(s).length > 0 && <Section title="The elections" open={!!electionOfCandidate(s, s.playerId)}><ElectionPanel s={s} /></Section>}
                  <Section title={`Laws before the people${pendingProposals(s).length ? ` (${pendingProposals(s).length})` : ''}`} open={pendingProposals(s).length > 0}><LawsPanel s={s} /></Section>
                  <Section title={`Gossip${heardNew ? ` (${heardNew} new)` : ''}`} open={!playerCase(s) && !pendingProposals(s).length}><GossipPanel s={s} /></Section>
                </>
              )}
              {cur === 'record' && <ChroniclePanel s={s} />}
            </div>
          </aside>
        </div>
      </div>
      <EventModal s={s} />
      <TrialModal s={s} />
      <VoteModal s={s} />
      {s.ended && !s.events.pending.length && <Ended s={s} />}
    </UICtx.Provider>
  );
}

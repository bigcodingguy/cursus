import { useEffect, useRef, useState } from 'react';
import { PRAENOMINA, PLAYER_NOMINA } from '../content/cast';
import { violenceLevel } from '../sim/systems/crisis/api';
import { cashOf, debtOf } from '../sim/systems/money/api';
import { standingOf } from '../sim/systems/standing/api';
import type { GameState, PlaceId } from '../sim/types';
import { ageOf, fmtHS } from '../sim/util';
import { CityMap } from './CityMap';
import { consulsLine, dateLine, UICtx, Why, type Tab } from './common';
import { EventModal, TrialModal, VoteModal } from './Modals';
import { CasePanel, ChroniclePanel, ElectionPanel, FavorsPanel, GossipPanel, PeoplePanel, PersonPanel } from './Panels';
import { PlacePanel } from './PlacePanel';
import { WhatNow } from './WhatNow';
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
            <button className="green" onClick={() => { const e = loadSlot('auto'); if (e) toast(e); }}>
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
                <button onClick={() => { toast(saveSlot(sl) ? 'Saved' : 'Could not save'); onClose(); }}>Save</button>
                <button className="ghost" disabled={!info} onClick={() => { const e = loadSlot(sl); toast(e ?? 'Loaded'); onClose(); }}>Load</button>
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
          <button className="ghost" onClick={() => { if (confirm('Leave this game? Unsaved progress since the last autosave is lost.')) { saveSlot('auto'); quit(); onClose(); } }}>Title screen</button>
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
        <p><b>Places.</b> Click a district on the map to see what you can do there and who lives there. The Forum has speeches, courts and bankers; the Campus Martius has the army and the elections; your house in the Carinae is where you set your mornings and give dinners.</p>
        <p><b>People.</b> Everyone remembers what you did. Hover over any underlined number to see where it comes from. Favors owed make requests easier — and are spent when used.</p>
        <p><b>The road.</b> Serve a campaign abroad. Make a name — a prosecution of a corrupt governor is the classic way. At 27 you may stand for quaestor (the vote is each 25 Quintilis). Win and you enter the Senate.</p>
        <p><b>Odds.</b> When you gamble, the chance shown is the chance used.</p>
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
          {p.praenomen} {p.nomen} of Arpinum, aged {ageOf(s, p)}. Dignitas {standingOf(s, p.id, 'dignitas').total}. {s.offices.records.filter((r) => r.who === p.id && r.office === 'quaestor').length ? 'Quaestor. Senator.' : 'Never held a magistracy at Rome.'}
        </p>
        <p className="small muted">Heirs, the full cursus and the wider Mediterranean arrive in the next phase.</p>
        <div className="choices">
          <button onClick={() => quit()}>Title screen</button>
        </div>
      </div>
    </div>
  );
}

function Game({ s, speed, version }: { s: GameState; speed: number; version: number }) {
  const [place, setPlace] = useState<PlaceId>('carinae');
  const [person, setPerson] = useState<string | null>(s.playerId);
  const [tab, setTab] = useState<Tab>('person');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setSpeed(speed ? 0 : 2);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [speed]);
  const [guests, setGuests] = useState<string[]>([]);
  const ui = { place, setPlace, person, showPerson: (id: string) => { setPerson(id); setTab('person'); }, tab, setTab, guests, setGuests };
  const heardNew = s.news.items.filter((g) => !g.heard && g.day <= s.day).length;
  const tabs: [Tab, string][] = [['person', 'Person'], ['people', 'People'], ['favors', 'Favors & debts'], ['gossip', `Gossip${heardNew ? ` (${heardNew} unheard)` : ''}`], ['chronicle', 'Calendar'], ['case', 'Case'], ['election', 'Election']];
  return (
    <UICtx.Provider value={ui}>
      <div className="app">
        <TopBar s={s} speed={speed} />
        <div className="main">
          <div className="left">
            <div className="mapwrap">
              <CityMap s={s} selected={place} onSelect={setPlace} version={version} />
              <div className="mapnote">Placeholder plan of Rome. Click a district.</div>
            </div>
            <div className="place">
              <PlacePanel s={s} place={place} />
            </div>
          </div>
          <div className="right">
            <WhatNow s={s} />
            <div className="tabs">
              {tabs.map(([t, label]) => (
                <button key={t} className={`ghost ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
                  {label}
                </button>
              ))}
              <button className="ghost" onClick={() => { setPerson(s.playerId); setTab('person'); }}>You</button>
            </div>
            <div className="panel">
              {tab === 'person' && <PersonPanel s={s} id={person} />}
              {tab === 'people' && <PeoplePanel s={s} />}
              {tab === 'favors' && <FavorsPanel s={s} />}
              {tab === 'gossip' && <GossipPanel s={s} />}
              {tab === 'chronicle' && <ChroniclePanel s={s} />}
              {tab === 'case' && <CasePanel s={s} />}
              {tab === 'election' && <ElectionPanel s={s} />}
            </div>
          </div>
        </div>
      </div>
      <EventModal s={s} />
      <TrialModal s={s} />
      <VoteModal s={s} />
      {s.ended && !s.events.pending.length && <Ended s={s} />}
    </UICtx.Provider>
  );
}

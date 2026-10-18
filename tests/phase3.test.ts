import { describe, expect, it } from 'vitest';
import { emit } from '../src/sim/bus';
import { command, startAction, tick } from '../src/sim/core';
import { newGame } from '../src/sim/setup';
import { availableLaws, passChance, proposalOf } from '../src/sim/systems/assembly/api';
import { heirOf } from '../src/sim/systems/family/api';
import type { GameState } from '../src/sim/types';
import { ageOf, yearBC } from '../src/sim/util';

function game(): GameState {
  return newGame({ seed: 4242, praenomen: 'Marcus', nomen: 'Gratidius' });
}

/** Play the father instead of the son: a grown man with a grown heir. */
function asFather(s: GameState) {
  const son = s.chars[s.playerId];
  s.playerId = son.fatherId!;
  s.family.line = [s.playerId];
  return { father: s.chars[s.playerId], son };
}

describe('laws before the people', () => {
  it('the shown chance is the vote times the chance no tribune vetoes, and the bill is decided on the day', () => {
    const s = game();
    const pl = s.chars[s.playerId];
    pl.bornBC = 170;
    s.offices.records.push({ who: pl.id, office: 'tribune_pleb', yearBC: yearBC(s) });
    s.day += 365 * 14; // into the 110s, when the bills in the list are open
    s.events.pending = [];
    const law = availableLaws(s)[0];
    expect(law).toBeDefined();
    s.offices.records.push({ who: pl.id, office: 'tribune_pleb', yearBC: yearBC(s) });
    expect(command(s, { type: 'act', action: 'propose_law', params: { law: law.id } })).toBeNull();
    for (let i = 0; i < 3; i++) tick(s);
    const p = proposalOf(s, pl.id)!;
    expect(p).toBeDefined();
    const odds = passChance(s, p);
    const sum = odds.parts.reduce((a, x) => a + x.value, 0);
    expect(Math.abs(sum - odds.total)).toBeLessThan(1e-9);
    expect(odds.total).toBeGreaterThan(0);
    expect(odds.total).toBeLessThan(1);
    while (s.day <= p.voteDay) {
      s.events.pending = [];
      s.pauseRequests = [];
      tick(s);
    }
    expect(p.status).not.toBe('pending');
  });
});

describe('acceptance moment 8', () => {
  it('a client the player made tribune can veto his law in public', () => {
    const s = game();
    const pl = s.chars[s.playerId];
    pl.bornBC = 170;
    s.day += 365 * 14;
    s.events.pending = [];
    const y = yearBC(s);
    s.offices.records.push({ who: pl.id, office: 'tribune_pleb', yearBC: y });
    const client = Object.values(s.chars).find((c) => c.alive && !c.female && c.id !== pl.id && c.location === 'rome' && ageOf(s, c) >= 30)!;
    client.patronId = pl.id;
    s.offices.records.push({ who: client.id, office: 'tribune_pleb', yearBC: y });
    const law = availableLaws(s)[0];
    expect(command(s, { type: 'act', action: 'propose_law', params: { law: law.id } })).toBeNull();
    for (let i = 0; i < 3; i++) tick(s);
    const p = proposalOf(s, pl.id)!;
    expect(startAction(s, client.id, 'veto_law', { proposal: p.id })).toBeNull();
    expect(p.status).toBe('vetoed');
    tick(s);
    expect(s.events.pending.some((x) => x.eventId === 'client_veto')).toBe(true);
  });
});

describe('family and dynasty', () => {
  it('when the player dies, his son carries on with the house', () => {
    const s = game();
    const { father, son } = asFather(s);
    expect(heirOf(s, father.id)).toBe(son.id);
    emit(s, 'death', { who: father.id, cause: 'a fever' });
    tick(s);
    expect(s.playerId).toBe(son.id);
    expect(s.ended).toBeUndefined();
    expect(s.family.line).toEqual([father.id, son.id]);
    expect(s.family.elogia.some((e) => e.who === father.id)).toBe(true);
  });

  it('exile is a setback, not the end, when a grown son can take the house', () => {
    const s = game();
    const { father, son } = asFather(s);
    emit(s, 'exile', { who: father.id, reason: 'after his conviction for extortion' });
    tick(s);
    expect(s.ended).toBeUndefined();
    expect(s.playerId).toBe(son.id);
    expect(s.chars[father.id].alive).toBe(true);
    expect(s.chars[father.id].location).toBe('exile');
  });
});

describe('letters', () => {
  it('a kinsman who dies in a far province is known in Rome only when the letter comes', () => {
    const s = game();
    const pl = s.chars[s.playerId];
    const father = s.chars[pl.fatherId!];
    father.location = 'abroad';
    s.offices.governors.push({ who: father.id, province: 'hisp_ult', departDay: s.day, returnDay: s.day + 365, extorted: 0, returned: false });
    emit(s, 'death', { who: father.id, cause: 'a fever' });
    tick(s);
    const letter = s.events.scheduled.find((x) => x.eventId === 'letter_death');
    expect(letter).toBeDefined();
    expect(letter!.day - s.day).toBeGreaterThanOrEqual(28);
    expect(s.log.some((l) => l.kind === 'death' && l.about?.includes(father.id))).toBe(false);
  });
});

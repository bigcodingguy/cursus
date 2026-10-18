// The assembly: tribunes and consuls put laws to the people; other tribunes may veto.
// Player and NPC magistrates use the same actions. Pass odds are computed in api.ts and used as-is.

import { emit, on } from '../../bus';
import { registerAction, registerCommand, type SystemDef } from '../../core';
import { applyEffects } from '../../dsl';
import { rand } from '../../rng';
import type { GameState, Proposal } from '../../types';
import { allChars, fullName, shortName } from '../../util';
import { opinion } from '../network/api';
import { holdsOffice } from '../offices/api';
import { availableLaws, canPropose, lawDef, NOTICE_DAYS, pendingProposals, proposalOf, speechWeight, vetoChance, vetoers, voteChance } from './api';

function proposal(s: GameState, id: unknown): Proposal | undefined {
  return s.assembly.proposals.find((p) => p.id === Number(id) && p.status === 'pending');
}

function post(s: GameState, proposerId: string, lawId: string) {
  const law = lawDef(lawId)!;
  const c = s.chars[proposerId];
  const p: Proposal = { id: s.assembly.nextId++, law: lawId, proposer: proposerId, proposedDay: s.day, voteDay: s.day + NOTICE_DAYS, status: 'pending', swing: 0, spoke: [proposerId] };
  s.assembly.proposals.push(p);
  if (s.assembly.proposals.length > 60) s.assembly.proposals = s.assembly.proposals.filter((x) => x.status === 'pending' || s.day - x.voteDay < 1500);
  emit(s, 'log', { text: `${fullName(c)} posts ${law.label.toLowerCase()}. The people will vote in ${NOTICE_DAYS} days.`, kind: proposerId === s.playerId ? 'player' : 'world', about: [proposerId] });
  emit(s, 'news', { text: `${shortName(c)} has posted a bill: ${law.blurb}`, truth: 'true', delay: 0, about: [proposerId] });
  emit(s, 'law.proposed', { id: p.id, law: lawId, proposer: proposerId });
  // A man who owes an equestrian a vote hears from him when the business class wants something.
  const pl = s.chars[s.playerId];
  const cred = allChars(s).find((x) => x.alive && x.flags.holdsVoteOf);
  if (cred?.alive && (law.equites ?? 0) >= 0.4 && proposerId !== s.playerId && pl.location === 'rome') {
    emit(s, 'event.trigger', { eventId: 'vote_called', roles: { creditor: cred.id, proposer: proposerId }, vars: { law: law.label.toLowerCase(), proposal: p.id } });
  }
}

function veto(s: GameState, p: Proposal, tribuneId: string) {
  const law = lawDef(p.law)!;
  const t = s.chars[tribuneId];
  p.status = 'vetoed';
  p.vetoedBy = tribuneId;
  emit(s, 'log', { text: `${fullName(t)} vetoes ${law.label.toLowerCase()}.`, kind: tribuneId === s.playerId || p.proposer === s.playerId ? 'player' : 'world', about: [tribuneId, p.proposer] });
  emit(s, 'memory', { owner: p.proposer, about: tribuneId, act: 'Vetoed my law', weight: -35, halfLife: 4000 });
  emit(s, 'standing', { who: tribuneId, kind: law.side < 0 ? 'boni' : 'people', value: 5, label: 'Vetoed a bill' });
  if (law.side < 0) emit(s, 'standing', { who: tribuneId, kind: 'people', value: -5, label: 'Vetoed a popular bill' });
  if (p.proposer === s.playerId && t.patronId === s.playerId) {
    emit(s, 'event.trigger', { eventId: 'client_veto', roles: { client: tribuneId }, vars: { law: law.label.toLowerCase() } });
  }
  danger(s, tribuneId);
}

/** In violent years, a bill fought over brings the street to a magistrate's door. */
function danger(s: GameState, who: string) {
  const st = s.crisis.stability;
  if (st >= 45) return;
  const p = (45 - st) / 300;
  if (who === s.playerId) {
    if (rand(s.rng) < 0.5) emit(s, 'event.trigger', { eventId: 'mob_at_door', roles: {}, vars: { risk: Math.round(p * 300) } });
    return;
  }
  if (rand(s.rng) < p) emit(s, 'death', { who, cause: 'beaten to death by a gang in the Forum' });
}

function resolve(s: GameState, p: Proposal) {
  const law = lawDef(p.law)!;
  const proposer = s.chars[p.proposer];
  if (!proposer?.alive) {
    p.status = 'withdrawn';
    return;
  }
  for (const t of vetoers(s, p)) {
    if (rand(s.rng) < vetoChance(s, p, t).total) return veto(s, p, t.id);
  }
  const ok = rand(s.rng) < voteChance(s, p).total;
  p.status = ok ? 'passed' : 'failed';
  if (ok) {
    s.assembly.passed[law.id] = s.day;
    applyEffects(s, law.passed, { roles: { proposer: p.proposer }, vars: {} });
    emit(s, 'log', { text: `The people pass ${law.label.toLowerCase()}, carried by ${fullName(proposer)}.`, kind: p.proposer === s.playerId ? 'player' : 'world', about: [p.proposer] });
    emit(s, 'law.passed', { id: p.id, law: law.id, proposer: p.proposer });
  } else {
    emit(s, 'standing', { who: p.proposer, kind: 'dignitas', value: -3, label: 'Lost a vote in the assembly' });
    emit(s, 'log', { text: `The tribes vote down ${law.label.toLowerCase()}.`, kind: p.proposer === s.playerId ? 'player' : 'world', about: [p.proposer] });
  }
  if (law.side <= -0.5) danger(s, p.proposer);
}

export const assembly: SystemDef = {
  id: 'assembly',
  register() {
    registerAction({
      id: 'propose_law',
      label: 'Put a law to the people',
      place: () => 'forum',
      duration: () => 2,
      check: (s, a, p) => {
        const why = canPropose(s, a);
        if (why) return why;
        if (!availableLaws(s).some((l) => l.id === p.law)) return 'That bill cannot be brought now';
        return null;
      },
      complete: (s, a, p) => {
        if (!canPropose(s, a)) post(s, a.id, String(p.law));
      },
      npc: (s, a) => {
        if (canPropose(s, a)) return [];
        if (rand(s.rng) > 0.25) return [];
        const out = [];
        for (const law of availableLaws(s)) {
          const agree = law.side * -a.lean; // >0: a man of the people with a popular bill, or an optimate with the Senate's
          const sponsor = law.sponsor && a.historical === law.sponsor ? 3 : 0;
          const u = 0.6 + 2.2 * agree + a.traits.ambition + sponsor + (law.appeal - 0.5) * 2;
          if (u > 1.5) out.push({ params: { law: law.id }, utility: u });
        }
        return out;
      },
    });

    registerAction({
      id: 'speak_on_law',
      label: 'Speak on a bill',
      place: () => 'forum',
      duration: () => 1,
      check: (s, a, p) => {
        const pr = proposal(s, p.proposal);
        if (!pr) return 'No such bill';
        if (pr.spoke.includes(a.id)) return 'You have spoken on it already';
        if (a.location !== 'rome') return 'Must be in Rome';
        return null;
      },
      complete: (s, a, p) => {
        const pr = proposal(s, p.proposal);
        if (!pr || pr.spoke.includes(a.id)) return;
        const dir = p.side === 'against' ? -1 : 1;
        pr.spoke.push(a.id);
        pr.swing += dir * speechWeight(a);
        const law = lawDef(pr.law)!;
        emit(s, 'memory', { owner: pr.proposer, about: a.id, act: dir > 0 ? 'Spoke for my law' : 'Spoke against my law', weight: dir * 12, halfLife: 2000 });
        emit(s, 'standing', { who: a.id, kind: law.side * dir < 0 ? 'people' : 'boni', value: 2, label: `Spoke ${dir > 0 ? 'for' : 'against'} ${law.label.toLowerCase()}` });
        if (a.id === s.playerId) emit(s, 'log', { text: `You speak ${dir > 0 ? 'for' : 'against'} ${law.label.toLowerCase()} from the Rostra.`, kind: 'player', about: [pr.proposer] });
        else if (pr.proposer === s.playerId && dir < 0 && a.patronId === s.playerId) emit(s, 'log', { text: `${fullName(a)}, your own client, speaks against your bill in public.`, kind: 'player', about: [a.id] });
      },
      npc: (s, a) => {
        if (a.rank === 'plebs' || rand(s.rng) > 0.3) return [];
        const out = [];
        for (const pr of pendingProposals(s)) {
          if (pr.spoke.includes(a.id)) continue;
          const law = lawDef(pr.law)!;
          const op = opinion(s, a.id, pr.proposer).total;
          const lean = law.side * -a.lean + op / 60;
          if (Math.abs(lean) < 0.35) continue;
          out.push({ params: { proposal: pr.id, side: lean > 0 ? 'for' : 'against' }, utility: 0.8 + Math.abs(lean) * 1.5 + a.traits.ambition * 0.5 });
        }
        return out;
      },
    });

    registerAction({
      id: 'veto_law',
      label: 'Interpose your veto',
      place: () => 'forum',
      duration: () => 0,
      check: (s, a, p) => {
        const pr = proposal(s, p.proposal);
        if (!pr) return 'No such bill';
        if (!holdsOffice(s, a.id, 'tribune_pleb')) return 'Only a tribune of the plebs can veto';
        if (pr.proposer === a.id) return 'It is your own bill';
        if (a.location !== 'rome') return 'Must be in Rome';
        return null;
      },
      complete: (s, a, p) => {
        const pr = proposal(s, p.proposal);
        if (pr) veto(s, pr, a.id);
      },
      // NPC vetoes are rolled on the day of the vote with the chance shown (vetoChance).
    });

    registerCommand('law.withdraw', (s) => {
      const pr = proposalOf(s, s.playerId);
      if (!pr) return 'You have no bill posted';
      pr.status = 'withdrawn';
      emit(s, 'standing', { who: s.playerId, kind: 'dignitas', value: -2, label: 'Withdrew a bill' });
      return null;
    });

    on('hook', (s, e) => {
      // An event may have the player argue for a bill (e.g. a vote called in by a creditor).
      if (e.name === 'speak_for_called' || e.name === 'speak_against_called') {
        const pr = proposal(s, e.vars?.proposal);
        const pl = s.chars[s.playerId];
        if (!pr || pr.spoke.includes(pl.id)) return;
        pr.spoke.push(pl.id);
        pr.swing += (e.name === 'speak_for_called' ? 1 : -1) * speechWeight(pl);
      }
    });
  },

  daily(s) {
    for (const p of pendingProposals(s)) {
      if (s.day >= p.voteDay) resolve(s, p);
    }
  },
};



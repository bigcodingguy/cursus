# Status

_Updated 2026-10-18 — end of the Phase 1 + Phase 2 session._

## Where things stand

**Phase 1 (setup) — done.** Vite + React + TypeScript (strict) + PixiJS. Pure, deterministic sim core in `src/sim/`: seeded RNG in state, fixed daily tick, event bus, action registry shared by player and NPCs, condition/effect DSL for content, save format `{version, seed, state}` with migrations. Vitest suite. CI workflow (typecheck, tests, build, 20-run bot smoke). GitHub Pages deploy workflow.

**Phase 2 (playable slice) — done, ready for Blake to play.** Rome only, Kal. Mart. 133 BC to the end of 120 BC.

What works:
- **City view**: placeholder plan of Rome (PixiJS), eight clickable districts. Each place lists its actions and the households there.
- **Time**: daily tick, five speeds (space bar toggles), auto-pause on events, trials, election day, loans called, returning home.
- **Cast**: ~90 characters at the start (Gracchi, Cornelia, Scipio Aemilianus, Scipio Nasica, Opimius, Appius Claudius, Scaevola, Piso, Metelli, Carbo, Fulvius Flaccus, Scaurus, Marius… plus generated sons, bankers, city folk), 14 houses. Men from outside houses enter the cast when they stand for office.
- **Network**: opinion = ties + politics + rank + memory ledger of specific acts (each decays at its own rate; hover for the breakdown); favors owed and spent; patron/client; friendship and enmity.
- **Money**: cash, estates, household costs, father’s allowance, loans at 1%/month, creditors who roll over or call loans, arrears, default, forced sale of land, inheritance (debts included). Money is conserved except through named sources/sinks (tested).
- **Standing**: dignitas, favor of the people, favor of the boni — all with breakdowns; favor saturates.
- **Offices**: consuls/praetors/tribunes from the fasti where the man is alive (otherwise filled from the living), governors sent to provinces who extort and come home; military service abroad (“served abroad”); the **quaestorian election** simulated tribe by tribe (35 tribes, canvassing by district, gifts/bribery, endorsements, postponement by omen) with exact odds and a tribe-by-tribe projection.
- **Courts**: extortion cases open when greedy governors return; prosecute or be asked to defend; 40 days of preparation (witnesses, records, learning and rejecting jurors, co-counsel, bribing jurors with exposure risk); a three-round trial screen with strategies, the opponent’s likely lines in percentages, exact odds; consequences for everyone involved. The 123 BC jury law moves juries to the equites and doubles restitution.
- **Crisis clock**: land and allies pressures, stability (debate → riots → political murder), and the Gracchan arc as conditional events: the veto, Octavius deposed, Pergamum, the Capitol (133), the consuls’ court, Nasica’s exile and death, “rightly slain”, Carbo, Crassus in Asia, Scipio and the allies, Scipio found dead (129), Fulvius’s citizenship bill and Fregellae (125), Gaius’s laws, the jury law, Junonia and Drusus, Antyllius, the Senate’s last decree and the Aventine (121), Opimius tried (120).
- **News**: Forum gossip — true, false and unconfirmed — heard in the Forum, at dinner, from clients, or following your patron.
- **Actions**: morning salutatio (attend patron / receive clients), visit (with requests: patronage, protection, endorsement, co-counsel, loan), dinner, speak at a contio, take a case, lend/borrow/repay, canvass, declare, serve abroad.
- **UI**: top bar (Roman date, AUC, consuls, speed, purse, standing, Republic), character panel with opinion breakdown and memory ledger, people list, favors and debts, gossip, calendar/chronicle, case, election; event modal with honest odds; trial screen; election day screen; saves (3 slots + autosave monthly + download/upload file); help.
- **Bots**: 3 strategies (orator, populist, establishment) × N lifetimes through the same commands as the UI; metrics in `docs/balance.md`.

Acceptance moments verified (in bot runs and in my own UI playthrough):
1. On the Capitol with your patron among the killers — every establishment-bot run; in my playthrough with Metellus Macedonicus as patron.
2. Prosecuting an ex-governor who is a friend of your father’s main creditor — 40–65% of orator/populist runs, median age 23; in my playthrough at 19 (Aquillius; the banker called my father’s loan and ruined him).
4. A rival’s ally reports an omen, the election is postponed a week, “you are about N votes short” — in a majority of orator/populist runs.

## How to verify
- `npm test` — 13 tests: RNG, calendar, jury odds (exact vs brute force; sampled verdicts match shown odds), whole-lifetime invariants for each bot strategy, determinism, save/load mid-game continuity, monthly invariant checks.
- `npm run bots -- --runs 1000 --write` — refreshes `docs/balance.md` (~35 min on 4 cores).
- Playthrough: I played 133–129 BC through the UI in headless Chromium (patron choice, the veto and deposition votes, the Capitol, service in Spain/Sicily, contio speeches, a prosecution with the creditor’s threat, trial, borrowing, Scipio’s death) and fixed what broke.

## Deploy
- CI (`.github/workflows/ci.yml`) is green on the working branch.
- GitHub Pages (`.github/workflows/deploy.yml`) builds and tests fine but cannot publish: Pages is not enabled for the repository (it is private; Pages on a private repo needs a paid GitHub plan, otherwise the repo must be public). Once Blake enables Pages with source “GitHub Actions”, re-run the workflow; the site will be at https://bigcodingguy.github.io/cursus/ . If the `github-pages` environment only allows `main`, merge the branch to `main`.
- Meanwhile the same build is published as a private claude.ai artifact: https://claude.ai/artifact/Bkug8jpRPE4FyivAZYDozg (saves stay in the browser; the “download save file” button does not work inside the artifact frame).

## Known issues / rough edges
- Placeholder art throughout (by design until Phase 4).
- The slice ends at the close of 120 BC; there is no heir system yet, so the player cannot die of natural causes (a deliberate slice rule) and a violent death ends the run.
- Ambitus (bribery) builds a record (`flags.ambitus`) but there is no bribery court yet; it only costs boni favor now.
- The 16–18 years are thin: you can visit, dine, take clients, borrow, and live through the Gracchan crisis, but cannot speak (18), serve (17) or prosecute (19) yet.
- Balance: the establishment strategy wins the quaestorship most reliably; the tribal assembly weights the 31 country tribes, where the boni’s favor counts. Orator bots who defy their father’s creditor often see the family ruined. See `docs/balance.md`.
- The bot runner takes ~2.5 s per lifetime; 3×1000 runs take ~35 minutes on 4 cores.

## Next (Phase 3, after Blake has played this)
Full cursus (aedile, tribune, praetor, consul), the 122 BC jury shift’s wider effects, family and heir succession, crisis clock into the 80s BC, news travel (letters), the Mediterranean map.

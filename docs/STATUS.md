# Status

_Updated 2026-10-18 — Phase 3a (a full life) done and deployed; 3b waits for Blake’s go._

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

## Polish pass (2026-10-18)
- **The world comes to you.** Ten kinds of opportunity arrive unasked after a quiet spell — roughly one every one to two months: a task or a canvass from your patron, junior counsel in someone else’s extortion case, a client in trouble, a dinner invitation, a banker’s cargo share or loan, a friend’s quarrel, a noble’s sneer, letters from your father, an old senator taking notice. Each is a real choice through existing systems (memories, favors, money, skills, courts).
- **What now.** An always-visible panel: what you are doing, two or three ambitions with the next step and a link to the place, and the next key dates. A first-time note explains dignitas, the people and the boni (dismissable).
- **People are the interface.** Any name opens a card with why he matters to you (patron, creditor, owes you a favor, juror in your case…), and buttons to call on him, ask, call in a favor, or invite him to dinner. Districts list the households that matter to you first. Dinner suggests a short list and has search.
- **Ages 16–18.** Lessons with a Greek rhetor (Palatine), watching the courts and Senate doors (Forum), riding with young nobles (Campus), and a commander’s staff from 16.
- **The legions** prompt is a real choice each spring until you have served: a named commander and war, a quieter garrison, or not this year.
- **Stability** recovers after bloodshed: political murder after 133, riots by 131, debate by about 126, and down again 123–121.
- **Balance**: the three bot paths now reach the quaestorship in similar shares; debts that land can cover end in a forced sale, not ruin.
- **Person panel** for yourself: how Rome sees you, ambitions, family (father’s health, debts, letters), what men lately remember of you.
- **Mortality** age-weighted with varied causes.

## Phase 3a — a full life (2026-10-18)
Authorized by Blake without playing first. The game now runs from 133 BC to the end of **100 BC**.
- **Family and dynasty.** Marry (the bride’s guardian weighs your standing; a dowry comes with her and her family becomes your kin), divorce (dowry returned), adopt (a younger son of a house with sons to spare takes your name). Children are born to married couples and can die young; women can die in childbirth. Everyone ages and dies of age-weighted causes. Name your heir in the **Family** tab; on death you continue as him with the house’s money, debts, loans, favors, friendships and enmities, and men remember the father in the son. Each death of the line writes a Scipionic-style **elogium** in the tomb. A consulship puts a mask in the atrium and makes the house noble. Exile hands the house to a grown son. NPC houses marry, breed and adopt by the same actions.
- **The full cursus.** Every magistracy is elected each July: tribal assembly for quaestor/tribune/aedile, centuriate (193 centuries by wealth) for praetor/consul/censor, with minimum ages, the order of offices, a year between, ten years between consulships, and a shown handicap for a new man seeking the consulship. Powers: tribunes and consuls **propose laws** and any tribune can **veto** (honest odds: each tribune’s veto chance, then the vote); speeches move the vote; vetoes are dangerous in violent years. **Aediles** give games (modest, generous, or borrowed and lavish). **Praetors** preside over every trial in their year and may tilt it. Ex-praetors and ex-consuls are offered **provinces** (light, usual or hard hand; a city’s “gift”), and consuls a **war command** with a shown chance of victory. **Censors** may strike an enemy from the Senate or enroll a client. Governors who squeezed their province, and winners who bought their votes (**ambitus**), can be prosecuted when they come home — including you, defending yourself.
- **Letters.** A death in a far province, or any death while you are abroad, reaches you by letter weeks late (Sicily 9 days … Asia 35); gossip arrives first and may be wrong. Abroad, Rome’s news comes late.
- **History to 100 BC** as ripening pressures (Numidia, the northern peoples), not a script: Micipsa’s death, Cirta, war with Jugurtha, the bought peace, “a city for sale”, Suthul, the Mamilian court (a law the people must pass), Metellus and Marius, the head count, Jugurtha’s capture, Noreia, Silanus, the Tigurini, the gold of Tolosa, Arausio (Marius may then be re-elected), Aquae Sextiae, Vercellae, Saturninus’s laws, the oath, Memmius murdered, the tiles of the Curia. 17 new historical men (Sulla, Saturninus, Glaucia, Memmius, Catulus, Caepio, Rutilius, Crassus the orator, Antonius, Jugurtha…), consuls and other magistrates from the record to 100 BC, new campaigns.
- **UI.** Family and Laws tabs; the Elections tab covers every office (tribe-by-tribe or century-by-century); declare for any office you qualify for at the Campus; the right column shows one “Next” step (others on request) and the first-time note replaces it until dismissed; ambitions no longer repeat on your own card; Case and Elections tabs appear only when there is one.
- Acceptance moments now possible: **3** (games debt and an equestrian’s loan for an unnamed vote, later called in), **5** (a letter from a province, weeks late), **6** (your daughter’s suitors), **8** (a client tribune vetoes your law in public), **10** (consul in the family; the mask goes up). Their frequency in bot runs is in `docs/balance.md`.

## How to verify
- `npm test` — 18 tests: RNG, calendar, jury odds (exact vs brute force; sampled verdicts match shown odds), whole 133–100 BC lifetimes with invariants for each bot strategy, determinism, save/load mid-game continuity, monthly invariant checks, passive-player pacing, law odds (parts sum to the shown chance; the bill is decided on its day), succession, exile to a grown son, late letters.
- `npm run bots -- --runs 200 --write` — refreshes `docs/balance.md` (~45 min on 4 cores; a 33-year lifetime takes ~20 s headless). 1000 runs per strategy takes ~4 h.
- Playthrough: I played 133–129 BC through the UI in headless Chromium (patron choice, the veto and deposition votes, the Capitol, service in Spain/Sicily, contio speeches, a prosecution with the creditor’s threat, trial, borrowing, Scipio’s death) and fixed what broke.
- Phase 3a playthrough: 133 BC to spring 128 BC again through the UI (no console errors), plus saved games loaded at 108 BC (a consular candidate with a wife and the family tomb) to check the Family, Laws, Elections and Campus panels. Fixed on the way: an NPC could adopt the player; a dinner host listed as his own guest; office names in charges.

## Deploy
- Live at https://bigcodingguy.github.io/cursus/ (GitHub Pages, deployed from `main` by `.github/workflows/deploy.yml`; the `github-pages` environment only accepts `main`).
- CI (`.github/workflows/ci.yml`) runs on every push.

## Known issues / rough edges
- Placeholder art throughout (by design until Phase 4).
- Bots default on a loan at least once in roughly a third of 33-year runs (they borrow whenever short and own no land to sell); real players can avoid it, but debt is harsher over a long career than in the slice.
- Moments in 200-run bot samples: 3 (games debt, an unnamed vote) ~77%, 5 (late letter) ~65%, 10 (consul in the family) 10–50% by strategy; 6 (daughter’s suitors) ~1% — a daughter must come of age before 100 BC; 8 (client tribune vetoes your law) 0% in bot runs because bots almost never carry laws — it is covered by a test and can happen in play.
- Bots rarely carry laws; NPC magistrates do, and many popular bills die by veto. The Mamilian court passes in about a quarter of runs, and with it the condemnations of Bestia, Albinus and Opimius.
- The heir is named in advance (Family tab), not chosen at the deathbed. Recall from exile is not modelled. Daughters can only be married through the suitors event, not by your own proposal.
- History diverges a lot after 110 BC: the Gracchan arc fires in ~80% of runs, but Marius reaches his consulships in only about a quarter to a third (the head count 29%, Jugurtha captured 19%, Vercellae 24%); when he isn’t elected the Cimbri stay a threat to 100 BC. Saturninus dies on the Curia roof in ~48%.

## Next (Phase 3b, after Blake says go)
The Mediterranean map; the crisis clock into the 80s BC (Social War, Sulla, proscriptions); the 122 BC jury shift as a lasting equites-vs-Senate fault line.

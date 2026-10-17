# Cursus — Design

Source of truth for design. The shared design doc on claude.ai is the discussion copy; this file is what the code follows.

## Pitch
You live a Roman life through the fall of the Republic. You start in spring 133 BC, age 16, a *novus homo* from a country town (Arpinum by default), son of a modestly wealthy equestrian. You climb by winning people — patrons, clients, friends, enemies — in the Forum, the courts, the elections, and on campaign. When you die, your heir continues the family.

Not Crusader Kings: you never own what you rule. Offices last a year; afterward you can be prosecuted for what you did. The state is an institution you climb inside. The Republic itself is the second protagonist, and it is coming apart.

## Pillars
1. **Power is people.** Every resource runs through relationships. Characters remember specific acts.
2. **The world says no.** Rivals use the same rules. Scarcity of time, money, law. Risky choices show honest odds and the sim honors them.
3. **Every office ends.** Power comes in one-year windows; what matters is what you do with them and surviving after.
4. **History with room.** Real pressures drive events that are likely, not scripted.
5. **Deep but readable.** Every number explains itself. You act through places and people, not tabs of stats.
6. **Long runs, many endings.** A life is 6–10 hours; a dynasty 20–40.

## Time and loop
- Real time with pause, one tick per day, speed controls, auto-pause on important events.
- Roman calendar shown (Kalends/Nones/Ides, consular year and AUC alongside BC).
- Year rhythm: magistrates take office Jan 1; campaign season spring–autumn; elections in summer on the Campus Martius; courts, festivals, and games through the year.
- **The scarce resource is the player's time and presence.** Most actions take days or weeks and you can only be in one place.
- Player actions (v1): morning salutatio (receive clients / attend patron), visit, host a dinner, speak (contio in the Forum; Senate once a senator), take a case (prosecute/defend), lend/borrow/invest, campaign for office, serve (military tribune, later), travel/study (later).
- Loop: set goals → start plans that take time → plans collide with NPC plans → outcomes change relationships, standing, money → openings (scandals, vacancies, crises) appear with short windows.

## Core systems (v1)
### People and network
- ~200–300 simulated characters in full v1 (~80 in the slice): ~30 senatorial families, equestrians, tribunes, clients.
- Each: traits, ambitions, career, family, and an opinion of the player built from a **memory ledger of specific acts** (e.g. "defended my son, 128 BC", weight, decay).
- Relationship types: patron, client, amicus, inimicus, kin by marriage.
- **Favor ledger** (officium): who owes whom. Calling in a favor spends goodwill.
- NPCs pursue careers with the same actions and rules (utility AI).

### Money
- Sesterces. Income: estates, loans, partnerships, gifts and legacies (advocates cannot charge fees — Lex Cincia). Expenses: household, dowries, games, campaigns.
- Debt is political: creditors gain leverage (they can call loans or request votes). Falling below census thresholds risks rank.

### Standing
- **Dignitas** (rank/honor from offices and deeds), **Favor of the people**, **Favor of the boni** (establishment). The latter two often conflict; factional identity emerges from play.

### Offices and elections
- Ladder: military tribune → quaestor → aedile / tribune of the plebs → praetor → consul → censor, with minimum ages (Lex Villia Annalis).
- Elections simulated from voting blocs (centuriate assembly weighted by wealth class, richest vote first; tribal assembly for tribunes/quaestors).
- Campaigning: canvassing, endorsements, games, timing, bribery (ambitus — wins votes, creates prosecution risk).
- Each office grants specific powers (quaestor: finances; tribune: veto, propose laws; praetor: preside over a court; consul: preside, command).

### Courts
- Set-piece trials. Start with the extortion court (quaestio de repetundis, 149 BC); more courts open with history.
- Preparation phase (weeks): witnesses, documents, jury research, co-counsel, optional tampering.
- Trial: choose rhetorical strategies (facts, character, pity, political threat) against jury composition, opposing advocate, and public mood. Odds shown.
- 122 BC: Gaius Gracchus moves juries from senators to equestrians — changes who you must persuade.
- Prosecuting a famous man is the classic young man's route to fame.

### The city
- Map of Rome as the main interface: Forum, Curia, Rostra, Campus Martius, Palatine, Subura, Capitol, temples. Places are where actions happen.
- Your house is a status asset; moving to the Palatine is a statement.

### Crisis clock
- Pressures accumulate: land question, Italian allies, army/manpower, grain supply, slave revolts, foreign wars.
- Each ripens toward historical events (likely, not scripted) and can be defused or accelerated by the player and NPCs.
- Overall **stability** sets how violent politics gets: debate → riots → political murder → armies.
- Real historical figures are characters with historical tendencies; they can be helped, blocked, or killed.

### Family and dynasty
- Marriage = alliance; divorce common; adoption normal.
- Children educated, married, launched.
- On death: the player chooses the heir among sons and adopted sons. Debts and enemies are inherited.
- Ancestor masks (imagines): each consulship adds one. The family becomes *nobilis* when someone reaches the consulship.

### News and information
- Letters and messengers travel at realistic speeds. Forum gossip runs ahead of facts and is sometimes wrong. Clients are your early-warning network. Kept light: suspense, not confusion.

## Failure and endings
- Setbacks (not run-ending): lost elections, lost trials, exile (with a way back), expulsion from the Senate, death (continue as heir).
- Run ends: family extinct; scenario end ~27 BC; or the player retires the dynasty.
- Each death generates an elogium (Scipionic-tomb style: offices, deeds, a line of memory). The run's record = elogia, imagines, wealth, and where the family stood when the Republic fell.

## Ten moments the systems must be able to produce (acceptance test)
1. Your first summer, you are on the Capitol when senators kill Tiberius Gracchus. Your patron was among them.
2. At 24 you prosecute an ex-governor for extortion; he is a friend of your father's main creditor.
3. Your aedile's games leave you in debt; an equestrian offers to cover it for one unnamed future vote.
4. A rival's ally announces a bad omen; the election is postponed; you have a week to find 300 votes.
5. A letter from Spain arrives 30 days late; the man you backed is already dead.
6. Your daughter can marry a fading old family or a rising popularis; either choice makes an enemy.
7. As governor, a city offers a "gift"; take it and your debts vanish; your successor will report either way.
8. A client you made tribune twenty years ago votes against your law in public.
9. A rumor says your name is on the proscription list; flee, petition, or gamble.
10. Your grandson becomes consul; the family is noble; your mask goes up in the atrium.

## Modules (after v1)
| Module | Adds | Depends on |
|---|---|---|
| Provinces | Governorship sub-game; extraction vs order; trial on return | core, courts |
| War and command | Strategy-level campaigns (objective, posture, supply), abstract resolution, soldier loyalty, triumphs | provinces |
| The villa | Develop country estates; land laws bite | money |
| Religion | Priesthoods, augury, omens as weapons | offices |
| Publicani | Tax-farming company shares; equestrian lobby | provinces, money |
| Civil war | Soldier loyalty + deadlock → march on Rome | war, crisis |
| Greek East | Rhodes, embassies, client kings | news |
| More starts | Patrician / noble starts; 100 BC, 70 BC | core |
| Principate | Continue past 27 BC | all |

## Presentation
- Look: Roman inscription and Pompeian fresco. Cinzel + classical serif. Pompeian red, ochre, black, plaster white, verdigris.
- City: Lanciani's Forma Urbis Romae (public domain) restyled, or a generated painted view; clickable districts.
- Mediterranean: Natural Earth + AWMC data rendered in our own aged style; messengers move in real time.
- Portraits: AI-generated Fayum-style encaustic portraits with age variants (consistent and period-authentic).
- Events: public-domain 19th-c. history painting (Gérôme, Alma-Tadema, Maccari) + generated fresco-style scenes.
- Icons: game-icons.net.
- No hand-coded SVG illustration.

## Resolved decisions (defaults Blake accepted)
- Real historical figures: yes, with divergence.
- Tone: realistic and unflinching about slavery, violence, corruption; not gratuitous.
- One start in v1: novus homo, 133 BC.
- Heir: player chooses among sons and adopted sons.
- Working title: Cursus.
- Target: 6–10 h per lifetime.

## Phase 2 slice — exact scope
Goal: is the core loop fun? Everything else is placeholder.
- Rome city map (simple placeholder: districts as clickable regions on a plain plan).
- Time: 133 BC → 120 BC, daily tick, speed controls, auto-pause.
- ~80 characters across ~12 families + clients, generated from content tables, with the Gracchi, Scipio Aemilianus, Scipio Nasica, Opimius as historical figures.
- Systems: network (memory ledger, favors), money, standing, offices (military tribune flagged as "served abroad" abstractly; quaestorship election real), courts (extortion trials only, full prep + trial flow), crisis clock (land question + Gracchan events: 133 Tiberius, 129 Scipio's death, 123–121 Gaius incl. jury law), news (Forum gossip only).
- Actions: salutatio, visit, dinner, speak (contio), take case, lend/borrow, canvass.
- UI: city view, character panel with opinion breakdown and memory ledger, ledger of favors, calendar/timeline, event modal with honest odds, trial screen, election screen, save/load.
- Bots: 3 strategies (orator, populist, establishment climber) × 1000 runs → metrics in `docs/balance.md`.
- Done when: Blake can play from 133 BC to his first quaestorship campaign (~30–45 min of real play) and moments 1, 2, and 4 can happen.

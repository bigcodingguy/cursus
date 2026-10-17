# Cursus — project guide for Claude Code

Cursus is a real-time-with-pause strategy/life sim: you live a Roman career through the fall of the Republic (start 133 BC, a 16-year-old *novus homo*), and continue as your heir. Full design: `docs/DESIGN.md`. Read it before any design-affecting work. If code and design disagree, flag it to Blake rather than silently picking one.

## Owner and working style
- Blake (the owner) is not coding. He plays builds and gives feedback. You do everything else: design implementation, code, content, tests, deploys.
- Budget is limited (~$100 of usage total). Be efficient: plan before large changes, avoid rewrites, don't re-read large files needlessly, keep sessions focused on one phase task.
- Ask Blake only for decisions that are genuinely his (taste, scope, direction). Make sensible engineering calls yourself and note them in `docs/DECISIONS.md` (one line each, dated).
- At the end of every session: update `docs/STATUS.md` (what works, what's next, known issues) and make sure the game builds and the bot suite passes.

## Stack
- TypeScript (strict), Vite, React for UI panels, PixiJS for maps. No backend. Must run as a static site (GitHub Pages).
- Tests: Vitest. Bot runner: a Node script that runs the sim headless.
- Package manager: npm.

## Architecture rules (non-negotiable)
1. **The sim core is pure.** `src/sim/` has no DOM, no React, no `Date.now()`, no `Math.random()`. All randomness through the seeded RNG in state. Same seed + same commands = same game, always.
2. **Fixed daily tick.** The world advances one day per tick. UI speed controls just change how many ticks per real second. The game auto-pauses on events flagged `pause: true`.
3. **State is plain serializable data** (no classes with methods in state). Saves = `{version, seed, state}`. Every save-format change gets a migration in `src/sim/migrations.ts`.
4. **Systems are modules.** Each system lives in `src/sim/systems/<name>/`, registers tick handlers and event listeners with the core, and owns its slice of state. Systems talk through the event bus, not by importing each other's internals. New features = new module, not edits to the core.
5. **Content is data.** Characters, families, offices, events, laws, historical pressures live in `src/content/` as typed data. Events use a small condition/effect DSL (`src/sim/dsl/`). Adding content must never require engine changes.
6. **NPCs play by the player's rules.** NPCs choose from the same action set as the player via utility scoring (goals × traits × situation). No AI cheats, no special-case rules.
7. **Every number explains itself.** Derived values (opinion, election odds, trial odds, standing) are computed with a breakdown (`{total, parts:[{label, value}]}`) that the UI shows on hover.
8. **Honest odds.** When the player faces a risky choice, the UI shows the real probability from the sim, and the outcome uses exactly that probability.

## Layout
```
src/
  sim/            core: state, scheduler, rng, event bus, actions, dsl, migrations
    systems/      network, money, standing, offices, courts, city, crisis, family, news
  content/        data tables (characters, families, offices, events, laws, pressures)
  ui/             React panels, PixiJS map views, hover breakdowns
  assets/         images (see Art rules)
tools/
  bots.ts         headless runner: N lifetimes with bot strategies → metrics report
  assets/         image-generation pipeline (later phase)
docs/
  DESIGN.md  STATUS.md  DECISIONS.md
```

## Verification (do this, don't ask Blake to)
- `npm test` — unit tests for systems, plus invariants (no negative populations, no character in two offices, ages monotonic, money conserved except via defined sources/sinks, etc.).
- `npm run bots -- --runs 1000` — reports: distribution of highest office reached, death/exile/bankruptcy rates, wealth curves, years until key historical pressures fire, Republic stability over time. Keep a baseline in `docs/balance.md` and note changes.
- Before handing a build to Blake: run the game in a browser, play the first 5 in-game years yourself via the UI, and fix anything broken or confusing.

## Writing and tone
- In-game text: grounded, specific, period-plausible. Realistic about slavery, violence, and corruption; never gratuitous. No anachronistic slang.
- Real historical figures (the Gracchi, Marius, Sulla, etc.) appear with their historical tendencies; history can diverge.
- UI copy: short and plain.

## Art rules
- Placeholder art until the art phase. Never hand-draw illustrations in SVG; SVG is only for UI chrome and icons.
- Fonts: Cinzel (headings), EB Garamond or similar (body). Palette: Pompeian red, ochre, black, plaster white, verdigris.
- Art phase: Fayum-style AI portraits via a scripted pipeline with a fixed style prompt; public-domain history paintings for events; Lanciani's Forma Urbis Romae as the city base; Natural Earth + AWMC data for the Mediterranean map; game-icons.net icons (CC BY 3.0, keep attribution in `CREDITS.md`).

## Build phases (see DESIGN.md for detail)
1. Setup: scaffold, core, CI, deploy to GitHub Pages.
2. Playable slice: Rome only, 133–120 BC, ~80 characters, network, money, standing, quaestorship election, extortion trials, Gracchan pressures, bot runner. Placeholder art.
3. Core depth: full cursus, 122 BC jury shift, family and heir succession, crisis clock to the 80s BC, news travel, Mediterranean map.
4. Art and polish.
5. Modules (provinces, war, villa, religion, publicani, civil war, …).

Do one phase at a time. Don't start the next phase until Blake has played the current one.

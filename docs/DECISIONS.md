# Decisions

- 2026-10-17: Stack is TypeScript + Vite + React + PixiJS, static site on GitHub Pages.
- 2026-10-17: Open design questions resolved with defaults (see DESIGN.md).
- 2026-10-18: Calendar is a 365-day year with Julian month lengths and Republican month names (Quintilis, Sextilis); no intercalation. Day 0 = Kal. Ian. 133 BC; the game starts Kal. Mart.
- 2026-10-18: Systems may import another system's `api.ts` for pure queries (opinion, standing, cash); all mutation goes through bus events. Bus events emitted inside a handler are queued and run after it.
- 2026-10-18: Quaestorship rules for the slice: age 27 in the year of office, at least one campaign season served abroad. Military service is abstract (200 days away, a death risk shown up front).
- 2026-10-18: 8 quaestors a year. When the cast is short of candidates, men from houses outside the cast come forward at the declaration deadline; they become full characters and play by the same rules.
- 2026-10-18: Elections are run 200 times from a seed fixed by the election; the shown chance is the share you win, and the real vote is one of those runs picked by lot — so the odds are exact. NPC-only elections use one run.
- 2026-10-18: Trials: 32 jurors (up to 14 named from the cast), 3 rounds of strategy, the opposing advocate plays a mixed strategy shown as percentages, and the jury has a shared "mood" drawn from 5 Gauss–Hermite points. Shown odds integrate over exactly those points; the verdict draws from them. Ties acquit.
- 2026-10-18: Favor of the people and of the boni saturate (each act moves you less as you approach ±100). Dignitas from speeches removed; dignitas comes from birth, rank, offices, service and verdicts.
- 2026-10-18: Slice rule: the player does not die of natural causes (no heirs until Phase 3). He can still die by choice (risky choices with shown odds) and on campaign. NPCs age and die normally.
- 2026-10-18: Historical figures have tendencies, not scripts: events fire on conditions and daily hazards. If a key man is dead, a role may be filled by whoever fits (e.g. the hard-line consul of 121 BC).
- 2026-10-18: Placeholder art: Pixi-drawn district shapes on a plain plan; portraits are colored tablets with initials (lean-colored). No illustration.
- 2026-10-18: GitHub Pages deploy runs from `main` and the working branch via Actions (`deploy.yml`). Pages must be enabled in the repo settings with source "GitHub Actions".

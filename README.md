# Cursus

A strategy game about a Roman life through the fall of the Republic. See `docs/DESIGN.md`.

```
npm install
npm run dev        # play locally at http://localhost:5173
npm test           # unit tests and whole-run invariants
npm run bots -- --runs 100            # headless bot lifetimes → metrics
npm run bots -- --runs 1000 --write   # refresh docs/balance.md
npm run build      # static site in dist/
```

Status and next steps: `docs/STATUS.md`. Engineering decisions: `docs/DECISIONS.md`. Balance baseline: `docs/balance.md`.

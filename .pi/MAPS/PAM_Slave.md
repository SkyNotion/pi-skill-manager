# 🗺️ PAM Slave Map — pi-skill-deck

> Visual map of `pi-skill-deck`'s internal structure.
> Files and folders that the program actually uses to run are starred.
> For the human-readable narrative see [`ReadMyAss.md`](./ReadMyAss.md).
> For this project's architectural significance to the global system see [`ASS_SLAVE.md`](./ASS_SLAVE.md).
> For internal-only architectural significance see [`PASS.md`](./PASS.md).

**Last synced:** `2026-05-29`
**Stack:** TypeScript, Pi extension API, Bun
**README size:** 1,247 bytes

## Legend

- ⭐ **ASS** — In-use at runtime; affects how the program runs
- 🟡 **PASS-only** — Internally important (tests, configs, dev tooling)
- ⚪ Neither — archived, scratch, generated, or not directly used

## Map

```text
pi-skill-deck/
├── ⭐ index.ts                 (Pi extension entry point)
├── ⭐ overlay.ts               (two-pane overlay UI wired to core)
├── ⭐ body.ts                  (main scrollable content area)
├── ⭐ categories.ts            (skill-specific category labels + EXPLICIT_MAP)
├── ⭐ groupings.ts             (8 group-by strategies)
├── ⭐ scan.ts                  (walk ~/.pi/agent/skills/, parse JSDoc)
├── ⭐ tags.ts                  (tagging + search logic)
├── ⭐ state.ts                 (bookmark persistence, frecency tracking)
├── ⭐ source.ts                (source attribution)
├── ⭐ package.json             (published to npm as pi-skill-deck)
├── ⭐ tsconfig.json
├── 🟡 justfile                 (Bun task runner)
├── 🟡 .eslintrc.json
├── 🟡 .prettierrc.json
├── 🟡 .npmignore
├── ⚪ node_modules/
├── ⚪ .git/
├── ⚪ dist/                    (compiled output)
└── 📄 README.md
```

## Nested READMEs in this project

- `README.md` — Project overview, git history, usage

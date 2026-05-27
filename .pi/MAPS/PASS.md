# PASS — pi-skill-deck

> Project Adjacency & Surface Score — who touches what.
> Maintained by PAM. Last sync: 2026-05-22.

## Surface area

| Surface | Details |
|---------|---------|
| **CLI commands** | `/skills` (Pi overlay) |
| **Keyboard shortcuts** | `Ctrl+B` bookmark toggle (inside overlay only) |
| **State files** | `~/.pi/agent/skill-usage.json`, `skill-bookmarks.json`, `skill-suggestion.json` |
| **Ports** | None |
| **Env vars** | None |
| **Config files** | `categories.ts` — `EXPLICIT_MAP` for custom category overrides |

## Adjacency map

```
pi-skill-deck
  ├── reads ──→ ~/.pi/agent/skills/*        (scanned by pi-spec-tator-harness installer)
  ├── reads ──→ ~/.agents/skills/*           (marketing, producthunt, oss-launch)
  ├── reads ──→ npm global skills/           (context-mode, pi-interactive-shell, etc.)
  ├── writes ─→ ~/.pi/agent/skill-*.json     (state — non-destructive)
  └── depends → Pi SDK                       (runtime)
```

## Cluster membership

**Pi runtime stack — DX tooling layer.** Same cluster as `pi-spec-tator-harness`
(installer / pipeline) and `pi-pager` (notification infra). Not load-bearing.

## Conflict potential

- **None identified.** State files use unique names (`skill-usage.json`,
  `skill-bookmarks.json`, `skill-suggestion.json`) — no collision with
  existing `~/.pi/agent/` files.
- Skill scanning is read-only — cannot corrupt or modify skill content.

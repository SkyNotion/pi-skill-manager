# ASS_SLAVE — pi-skill-deck

> Architectural Significance Score — local project file.
> Maintained by PAM. Last sync: 2026-05-22.

## Identity

| Field | Value |
|-------|-------|
| **Project** | pi-skill-deck |
| **Repo** | `CymaticAPPS/pi-skill-deck` |
| **Remote** | `https://github.com/CymatiStatic/pi-skill-deck.git` |
| **Stack** | TypeScript, Pi extension API |
| **Version** | 0.1.0 |
| **Significance** | ⚙️ utility |

## What it does

Two-pane categorized TUI skill browser for Pi. Replaces the flat alphabetical
wall of 150+ skills with a navigable, categorized overlay. Features:

- **Category-grouped left pane** with multi-layer auto-categorization (parent dir → name prefix → explicit overrides → description keywords)
- **Detail right pane** with full skill description + SKILL.md content
- **Bookmarks** (Ctrl+B inside overlay)
- **Frecency tracking** — usage counts + recency weighting
- **Daily AI-free suggestions** — surfaces underused skills

## Entry point

- `index.ts` — Pi extension registered via `package.json` → `pi.extensions`
- Command: `/skills` opens the overlay

## State files

All persisted in `~/.pi/agent/`:

| File | Schema |
|------|--------|
| `skill-usage.json` | `{ [name]: { count, lastUsedAt } }` |
| `skill-bookmarks.json` | `string[]` |
| `skill-suggestion.json` | `{ date, picks: [{ name, reason }] }` |

## Contracts

- **No ports, no HTTP services, no env vars.**
- **Reads** skill directories: `~/.pi/agent/skills/`, `~/.pi/skills/`, `./.pi/skills/`, `~/.codex/skills/`, `~/.claude/skills/`, `./.claude/skills/`, `~/.agents/skills/`, npm global `node_modules/*/skills/`
- **Writes** state files to `~/.pi/agent/` (non-destructive — additive JSON)

## Dependencies (inbound)

None — nothing depends on pi-skill-deck.

## Dependencies (outbound)

| Dependency | Nature |
|------------|--------|
| Pi SDK (`@mariozechner/pi-coding-agent`) | Runtime — extension API + TUI components |
| `~/.pi/agent/skills/` content | Read-only scan — populated by `pi-spec-tator-harness` installer and npm packages |

## Ripple radius

**Zero.** Removing pi-skill-deck breaks nothing. Users fall back to the
built-in `/skills` list or manual `/skill:<name>` invocation.

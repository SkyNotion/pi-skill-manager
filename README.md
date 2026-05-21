# pi-skill-deck

Two-pane categorized skill browser for [Pi](https://github.com/badlogic/pi-mono) with bookmarks, frecency tracking, and daily suggestions.

Replaces the flat alphabetical wall of 150+ skills with a navigable, categorized overlay.

## Features

- **Two-pane browser** — categories on the left, skills + detail on the right
- **★ Top 10 most used** — pinned at the top, ranked by frecency (frequency × recency)
- **📌 Bookmarks** — `Ctrl+B` to save skills for later
- **💡 Daily suggestions** — 1-3 underused skills that match your activity patterns, refreshed daily
- **13 auto-categories** — Design & UI, Marketing & GTM, Product Hunt, Video & Media, Memory & Brain, Pi Meta, Open Design, Obsidian, Baoyu Tools, Context-Mode, OSS Launch, Cloud & Deploy, Product
- **Search** — press `/` to filter skills by name or description
- **Skill queueing** — selected skill is injected alongside your next message

## Installation

```bash
pi install npm:pi-skill-deck
```

Restart Pi to activate.

> **Note:** If you have `pi-skill-palette` installed, both can coexist.
> `/skill` opens the quick fuzzy palette, `/skills` opens the two-pane deck.

## Usage

```
/skills           Open the two-pane browser
/skill-deck       Alias for /skills
```

### Keyboard shortcuts (inside overlay)

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate within focused pane |
| `Tab` | Switch focus between left/right panes |
| `←` / `→` | Switch panes |
| `Enter` | Queue selected skill (right pane) / Focus right pane (left pane) |
| `Ctrl+B` | Toggle bookmark on highlighted skill |
| `/` | Start search |
| `Esc` | Close overlay / Exit search |
| `Backspace` | Delete search character |

## How it works

### Categorization

Skills are auto-categorized using a multi-pass heuristic:

1. **Parent directory** — skills under `.../marketing/` → Marketing & GTM
2. **Name prefix** — `baoyu-*` → Baoyu Tools, `ph-*` → Product Hunt, etc.
3. **Explicit map** — hand-curated overrides for non-obvious skills
4. **Description keywords** — fallback pattern matching
5. **"Other"** — last resort

### Frecency tracking

Every time you queue a skill, its usage count increments and timestamp updates. The frecency score decays with a 7-day half-life, so recently-used skills rank higher than historically-popular-but-stale ones.

### Daily suggestions

Once per day, the suggestion engine:

1. Pools all skills with 0-1 total uses
2. Scores by category affinity (prefer underused skills in categories you already use)
3. Adds light randomization for variety
4. Picks top 1-3

No LLM calls — runs entirely on local usage data.

### Skill scanning

Scans these directories (matching Pi's loading order):

1. `~/.codex/skills/` (recursive)
2. `~/.claude/skills/` (one level)
3. `${cwd}/.claude/skills/` (one level)
4. `~/.pi/agent/skills/` (recursive)
5. `~/.pi/skills/` (recursive)
6. `${cwd}/.pi/skills/` (recursive)
7. `~/.agents/skills/` (recursive)
8. npm global packages with `skills/` directories

## State files

All stored in `~/.pi/agent/`:

| File | Contents |
|------|----------|
| `skill-usage.json` | `{ skillName: { count, lastUsedAt } }` |
| `skill-bookmarks.json` | `["skillName", ...]` |
| `skill-suggestion.json` | `{ date: "YYYY-MM-DD", picks: [...] }` |

## Configuration

### Custom category overrides

Edit `~/.pi/agent/skill-deck-config.json` (optional):

```json
{
  "categoryOverrides": {
    "my-custom-skill": "Design & UI"
  }
}
```

## License

MIT

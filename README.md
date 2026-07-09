# 🃏 pi-skill-manager

> Skill enable/disable manager for [Pi](https://github.com/earendil-works/pi) — control which skills appear in the system prompt, add skills from custom paths, and toggle categories per-session.

[![npm version](https://img.shields.io/npm/v/pi-skill-manager.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/pi-skill-manager)
[![license](https://img.shields.io/npm/l/pi-skill-manager.svg?color=blue)](LICENSE)
[![node](https://img.shields.io/node/v/pi-skill-manager.svg?color=339933&logo=node.js)](package.json)
[![github](https://img.shields.io/badge/repo-SkyNotion%2Fpi--skill--manager-181717?logo=github)](https://github.com/SkyNotion/pi-skill-manager)

![pi-skill-manager preview](preview.png)

## ✨ Features

- **Skill gating** — all skills disabled by default; enable only the categories you need
- **Per-session toggling** — open the overlay, press `c` to toggle a category on/off, changes persist to that session only
- **Custom skill paths** — add skills from outside Pi's standard locations with full control over naming and categorization
- **Provider grouping** — tag skill collections by provider (Anthropic, Vercel, Figma, Flutter, etc.) and view them grouped in the overlay
- **Two-pane browser** — sections on the left, skills + detail on the right
- **8 group-by modes** — `g` cycles, `G` opens a picker: **Category** · **Source** · **Framework** · **Creator** · **Location** · **Tag** · **Usage Tier** · **Flat**
- **Source attribution** — every skill carries `source`, `framework`, and `creator` metadata
- **Inline summaries** — one-line description per skill for fast scanning
- **★ Top 10 most used** — pinned at the top, ranked by frecency (frequency × recency)
- **📌 Bookmarks** — `Ctrl+B` to save skills for quick access
- **💡 Daily suggestions** — 1–3 underused skills matching your activity patterns
- **Search** — press `/` to filter by name or description
- **Skill queueing** — selected skill is injected alongside your next message

## 📦 Installation

**Requires:** [Pi](https://github.com/earendil-works/pi) ≥ 0.1 and Node.js ≥ 18.

### Option 1 — from npm (recommended)

```sh
npm install pi-skill-manager
```

### Option 2 — from GitHub 

```sh
npm install SkyNotion/pi-skill-manager
```

### Option 3 — manual settings

Add to `~/.pi/agent/settings.json` `packages` array:

```json
{
  "packages": [
    "npm:pi-skill-manager",
    "github:SkyNotion/pi-skill-manager"
  ]
}
```

Then start a new Pi session. You should see a `🎴 Skill Manager: N skills loaded` notice.

### Verify the install

```sh
pi --version && pi extensions list | grep pi-skill-manager
```

### Uninstall

```sh
pi uninstall pi-skill-manager
```

## 🚀 Usage

Type `/skill-manager` (or `/skills`) inside any Pi session to open the browser.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Tab` / `← →` | Switch focus between panes |
| `↑ ↓` | Navigate within the focused pane |
| `Enter` | Queue the selected skill for your next message |
| `c` | Toggle the selected category on/off (category mode only) |
| `Ctrl+B` | Toggle bookmark on highlighted skill |
| `g` | Cycle group-by mode |
| `G` | Open group-by picker menu |
| `t` / `T` | Inline / modal tag editor |
| `/` | Start search |
| `?` | Toggle keyboard reference |
| `Esc` | Close overlay |

## ⚙️ Configuration

### Global config: `~/.pi/agent/skill-manager-config.json`

```json
{
  "enabledCategories": ["Design & UI", "Marketing & GTM"],
  "customSkills": [
    {
      "path": "/home/user/my-skills",
      "recurse": true,
      "provider": "My Team"
    },
    {
      "path": "/home/user/legacy-skill",
      "name": "deploy-checklist",
      "parentDir": "devops",
      "fileName": "deploy.md",
      "provider": "Legacy"
    }
  ]
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabledCategories` | `string[]` | `[]` (all disabled) | Categories to enable. Empty = nothing in system prompt. Omit = all enabled (backward compat). |
| `customSkills` | `CustomSkillEntry[]` | `[]` | Skill paths outside Pi's standard locations. |

#### `CustomSkillEntry` fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | `string` | **required** | Absolute or relative path to the skill directory. |
| `recurse` | `boolean` | `false` | When true, recursively scan all subdirectories for `SKILL.md` files. Use for entire skill collections. |
| `provider` | `string` | `"Custom"` | Provider label for grouping in "Framework" group-by mode. |
| `name` | `string` | from YAML or filename | Override the skill name. Only applies when `recurse` is false. |
| `parentDir` | `string` | — | Directory hint for category detection (e.g. `"marketing"` → Marketing & GTM). |
| `fileName` | `string` | `"SKILL.md"` | Skill file to read. Ignored when `recurse` is true. |

### Name resolution order (non-recursive mode)

1. Config entry has `name`? → use it
2. Skill file has YAML frontmatter `name:`? → use that
3. Derive from filename stem

### Per-session override

Changes made inside the `/skill-manager` overlay are stored in the session file via `pi.appendEntry()`. This means:
- Toggles survive `/resume` (tied to the session file)
- Cleared on `/new` (fresh session, global defaults apply)
- Independent of the global config file

## 🔍 How it works

### Skill filtering

On every user prompt, the `before_agent_start` event fires. The extension:
1. Reads the global config + per-session override
2. Computes the effective enabled-categories list
3. Parses the system prompt's `<skills>` XML block
4. Removes skills whose category is not enabled
5. Injects custom skills from config paths
6. Returns the filtered system prompt

### Custom skill scanning

Two modes:
- **`recurse: true`** — walks the directory tree looking for `SKILL.md` files (same as Pi's native scanner)
- **`recurse: false`** — reads a single file (defaults to `SKILL.md`, overridable via `fileName`)

### State files

All persisted in `~/.pi/agent/`:

| File | Purpose |
|------|---------|
| `skill-manager-config.json` | Global configuration |
| `skill-usage.json` | Per-skill `{ count, lastUsedAt }` |
| `skill-bookmarks.json` | Array of bookmarked skill names |
| `skill-suggestion.json` | `{ date, picks: [{ name, reason }] }` |
| `skill-tags.json` | Per-skill tag arrays |
| `skill-deck-prefs.json` | Group-by mode + last-used editor style |

## 🤝 Contributing

PRs welcome! See [`AGENTS.md`](AGENTS.md) for the project's architecture overview.

## 📄 License

[MIT](LICENSE) — maintained by [@SkyNotion](https://github.com/SkyNotion)

# pi-skill-manager — Agent Guide

> Architecture overview for AI agents working with this project.

## What it is

A [Pi](https://github.com/earendil-works/pi) extension that controls which skills appear in the system prompt. By default all skills are disabled; users enable categories (e.g. "Design & UI", "Marketing & GTM") via a config file or from the TUI overlay. Skills from custom file paths can also be added.

## Key files

| File | Role |
|------|------|
| `index.ts` | Extension entry point. Registers `/skill-manager` command, wires `before_agent_start` handler for system prompt filtering. |
| `overlay.ts` | `SkillDeckOverlay` class — two-pane TUI with category toggling, bookmarks, search, tagging. |
| `scan.ts` | Discovers skills from Pi's standard locations (`loadAllSkills()`). Also `loadCustomSkills()` for config-defined paths. |
| `config.ts` | Reads/writes `~/.pi/agent/skill-manager-config.json`. Types for `SkillManagerConfig`, `CustomSkillEntry`. |
| `session.ts` | Per-session override via `pi.appendEntry()`. Reads override data from `ctx.sessionManager.getEntries()`. |
| `categories.ts` | 14 category definitions + 5-layer categorization strategy (dir → prefix → explicit → keyword → Other). |
| `source.ts` | Detects skill origin (pi-agent, claude-user, npm, etc.), framework, and creator from file path. |
| `state.ts` | Persistence for usage tracking, bookmarks, daily suggestions, and UI prefs. |
| `groupings.ts` | 8 group-by modes (category, source, framework, creator, location, tag, usage, flat). |
| `tags.ts` | Free-form user-applied tags stored in `~/.pi/agent/skill-tags.json`. |
| `body.ts` | SKILL.md body extraction for the "What it does" excerpt in the DETAILS box. |

## Data flow

```
User opens /skill-manager
  → overlay shows [✓]/[ ] category toggles
  → pressing c toggles a category
  → on close, pi.appendEntry() saves to session

Next prompt:
  → before_agent_start fires
  → reads global config + session override
  → computes effectiveCategories
  → parses <skills> XML from systemPrompt
  → removes disabled skills
  → injects custom skills (if any)
  → returns { systemPrompt: filtered }
```

## Config file (`~/.pi/agent/skill-manager-config.json`)

```json
{
  "enabledCategories": ["Design & UI"],
  "customSkills": [
    {
      "path": "/absolute/or/relative/path",
      "recurse": true,
      "provider": "My Provider"
    }
  ]
}
```

- `enabledCategories: []` = all disabled
- `enabledCategories` absent = all enabled (backward compat)
- `customSkills[].recurse: true` = recursively scan for SKILL.md (like Pi's native scanner)
- `customSkills[].recurse: false` (default) = read one file
- `customSkills[].provider` = sets the skill's `source.framework` for grouping

## Custom skill name resolution

1. Config entry `name` field → overrides everything
2. YAML frontmatter `name:` in the file
3. Filename stem (basename without extension)

## Per-session overrides

- Stored via `pi.appendEntry("skill-manager-override", { enabledCategories })`
- Read back in `session_start` via `getSessionOverride(ctx)`
- Survives `/resume`, cleared on `/new`

## Skill interface

```typescript
interface Skill {
  name: string;
  description: string;
  filePath: string;
  category: string;
  source: SkillSource;   // { origin, location, framework, creator, installRoot }
  bodyExcerpt: string;
  bodyIsThin: boolean;
  hasExplicitSection: boolean;
  isCustom: boolean;     // true if from config.customSkills
}
```

## Categorization strategy

From `categories.ts`:

1. Parent directory name matches `DIR_CATEGORY` map
2. Skill name prefix (`baoyu-`, `ph-`, `ctx-`, `gr-`)
3. Explicit override map (`EXPLICIT_MAP`)
4. Description keyword matching
5. "Other" fallback

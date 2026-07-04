# pi-skill-manager — Agent Guide

> Architecture overview for AI agents working with this project.

## What it is

A [Pi](https://github.com/earendil-works/pi) extension that controls which skills appear in the system prompt. By default all skills are disabled; users enable composite categories (e.g. "Anthropic: Frontend & Design", "Vercel: DevOps & Cloud") via a config file or from the TUI overlay. Skills from custom file paths can also be added.

Categories are **composite** — `"{Provider}: {Domain}"` — so you can toggle skills at the provider+domain granularity (e.g., enable only "Anthropic: Frontend & Design" without enabling "Anthropic: AI & LLMs" or "Vercel: Frontend & Design").

## Key files

| File | Role |
|------|------|
| `index.ts` | Extension entry point. Registers `/skill-manager` command, wires `before_agent_start` handler for system prompt filtering. |
| `overlay.ts` | `SkillDeckOverlay` class — two-pane TUI with category toggling, bookmarks, search, tagging. |
| `scan.ts` | Discovers skills from Pi's standard locations (`loadAllSkills()`). Also `loadCustomSkills()` for config-defined paths. **Creates composite categories** by prepending `source.framework` to the domain. |
| `config.ts` | Reads/writes `~/.pi/agent/skill-manager-config.json`. Types for `SkillManagerConfig`, `CustomSkillEntry`. |
| `session.ts` | Per-session override via `pi.appendEntry()`. Reads override data from `ctx.sessionManager.getEntries()`. |
| `categories.ts` | 13 domain definitions + `getCategoryDef()` helper for composite names + 5-layer categorization strategy (dir → prefix → explicit → keyword → Other). |
| `source.ts` | Detects skill origin (pi-agent, claude-user, npm, etc.), framework, and creator from file path. |
| `state.ts` | Persistence for usage tracking, bookmarks, daily suggestions, and UI prefs. |
| `groupings.ts` | 8 group-by modes (category, source, framework, creator, location, tag, usage, flat). Uses `getCategoryDef()` for composite category lookups. |
| `tags.ts` | Free-form user-applied tags stored in `~/.pi/agent/skill-tags.json`. |
| `body.ts` | SKILL.md body extraction for the "What it does" excerpt in the DETAILS box. |

## Data flow

```
User opens /skill-manager
  → overlay shows [✓]/[ ] composite category toggles (e.g. "Anthropic: Frontend & Design")
  → pressing c toggles a category
  → on close, pi.appendEntry() saves composite category list to session

Next prompt:
  → before_agent_start fires
  → reads global config + session override
  → computes effectiveCategories (composite names)
  → parses <skills> XML from systemPrompt
  → removes disabled skills (matched against composite category)
  → injects custom skills (if any)
  → returns { systemPrompt: filtered }
```

## Composite categories

Every skill gets a category in the form **`"{Provider}: {Domain}"`**:

- **Provider** comes from `source.framework` — e.g. `"Anthropic"`, `"Vercel"`, `"Figma"`, `"Flutter"`, `"Baoyu"`, `"Pi Agent"`, `"npm:pi-subagents"`
- **Domain** comes from `categorizeSkill()` — e.g. `"Frontend & Design"`, `"Backend & API"`, `"Documents & Office"`

When no provider is detected (`framework === "—"`), only the domain is used.

### Available domains

| # | Domain | Icon | Sort |
|---|--------|------|------|
| 1 | Frontend & Design | 🎨 | 1 |
| 2 | Backend & API | ⚙️ | 2 |
| 3 | DevOps & Cloud | ☁️ | 3 |
| 4 | Databases & Storage | 🗄️ | 4 |
| 5 | Security | 🔒 | 5 |
| 6 | AI & LLMs | 🤖 | 6 |
| 7 | Scientific & Research | 🔬 | 7 |
| 8 | Documents & Office | 📄 | 8 |
| 9 | Marketing & Business | 📈 | 9 |
| 10 | Productivity & Automation | ⚡ | 10 |
| 11 | Enterprise & Compliance | 🏢 | 11 |
| 12 | Platform & Ecosystem | 🔌 | 12 |
| 99 | Other | · | 99 |

## Config file (`~/.pi/agent/skill-manager-config.json`)

```json
{
  "enabledCategories": ["Anthropic: Frontend & Design", "Vercel: DevOps & Cloud"],
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
- `enabledCategories` entries are composite names — `"{Provider}: {Domain}"`
- `customSkills[].recurse: true` = recursively scan for SKILL.md (like Pi's native scanner)
- `customSkills[].recurse: false` (default) = read one file
- `customSkills[].provider` = sets the skill's `source.framework` for composite category

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
  category: string;         // Composite: "{Provider}: {Domain}" or just "{Domain}" for unclassified
  source: SkillSource;      // { origin, location, framework, creator, installRoot }
  bodyExcerpt: string;
  bodyIsThin: boolean;
  hasExplicitSection: boolean;
  isCustom: boolean;        // true if from config.customSkills
}
```

## Categorization strategy

From `categories.ts`:

1. **Parent directory name** matches `DIR_CATEGORY` map (e.g., `scientific/` → "Scientific & Research", `security/` → "Security")
2. **Skill name prefix** (`9router-`, `baoyu-`, `ph-`, `ctx-`, `gr-`)
3. **Explicit name override** (`EXPLICIT_MAP` — 410+ skills mapped by name, case-insensitive normalized)
4. **Description keyword matching** (13 domain-specific keyword lists)
5. **"Other" fallback**

The domain is then combined with the provider/framework to form the composite category: `"{framework}: {domain}"`.

## See also

- `categories.ts` — full domain definitions, DIR_CATEGORY, EXPLICIT_MAP, keyword rules
- `source.ts` — provider/framework detection logic
- `groupings.ts` — `getCategoryDef()` for resolving composite names back to metadata

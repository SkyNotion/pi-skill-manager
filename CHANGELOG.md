# Changelog

All notable changes to **pi-skill-deck** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.1] — 2026-05-28

### Added
- **Discoverable key hints** — every interactive feature now shows its key
  chip inline:
  - Header right side: `group: <mode> [g]/[G] change  [?] help`
  - DETAILS box tags row: `tags: ...  [t] inline  [T] modal`
  - Footer keys are now in bright cyan `[...]` chips instead of dim text.
- **`?` keyboard reference panel** — sectioned modal (Navigation · Group-by
  · Skill actions · Search & exit). Toggle from anywhere with `?` or `Esc`.

### Changed
- Footer contrast inverted: keys are now the eye-catcher, labels are dim.
- `keyHint()` helper centralizes chip rendering across header / footer /
  details / modals so the visual style is consistent.

---

## [0.2.0] — 2026-05-27

### Added
- **8 group-by modes** — cycle with `g`, pick from menu with `G`:
  - Category (default) · Source · Framework · Creator · Location · Tag
    · Usage Tier (Power/Active/Tried/Unused) · Flat
  - Selection persisted to `~/.pi/agent/skill-deck-prefs.json`.
- **Per-skill tagging** — free-form tags, two editor styles available
  simultaneously:
  - `t` · inline editor (replaces footer)
  - `T` (shift+t) · modal editor (floating centered box)
  - Tags stored in `~/.pi/agent/skill-tags.json`. Can drive group-by.
- **Source attribution** — every skill now carries
  `{ origin, location, framework, creator }`:
  - Detected from npm-package path > known install root > agents-pack
    sub-library > name-prefix hint.
  - Sub-libraries mapped: `marketing/` → Corey Haines, `producthunt/`
    → yoanbernabeu, `oss-launch/` → gingiris, `microsoft-foundry/`
    → Microsoft.
  - Name hints: `baoyu-*` → 宝玉 (baoyu), `ctx-*` → Mario Zechner /
    context-mode, `ph-*` → yoanbernabeu, `gr-*` → gingiris.
- **Expanded DETAILS box** — now shows source row, framework + creator
  row, tags row, separated **Description** block (frontmatter), and a
  **What it does** block (SKILL.md body excerpt).
- **⚠ Thin-body flag** — surfaces skills whose SKILL.md body is missing
  or fragmentary (just code/lists/heading). Visible as a `⚠` next to
  the skill name in the list AND inside the DETAILS box. Current scan
  flags ~20 of ~157 skills.

### Internal
- New files: `source.ts`, `body.ts`, `tags.ts`, `groupings.ts`.
- `scan.ts` now attaches `source` + body excerpt to every Skill.
- `state.ts` gains `getPrefs` / `setPrefs` for persistent preferences.
- `overlay.ts` rewritten: pluggable section building, dual tag editors,
  group-by picker modal, expanded detail-box renderer.
- `body.ts:extractBodyFromContent()` prefers an explicit About / Overview
  / What-it-does / Purpose / Summary / Usage heading, then falls back to
  the first 1-2 prose paragraphs (skipping code, lists, blockquotes,
  tables, headings, metadata lines).

### Backward compatibility
- Old state files (`skill-usage.json`, `skill-bookmarks.json`,
  `skill-suggestion.json`) are read as-is. No migration needed.
- New prefs files are created lazily on first write.
- Default group-by is still Category, so first-time experience for
  upgrading users is identical to 0.1.x.

---

## [0.1.1] — 2026-05-27

### Added
- **Inline short summaries** — each skill row in `/skills` now shows a one-line
  summary (derived from the SKILL.md frontmatter description) right after the
  skill name, so you can scan a category without selecting each entry. Layout
  is `marker · name col (≤24 chars) · ┊ · summary col (flex) · 📌 ★N`.
- **Boxed DETAILS window** — the bottom detail panel is now drawn as a proper
  `┌─┐` framed window labeled `DETAILS: <skill-name>`. Body shows category +
  usage stats and the **full** description wrapped to fit (previously capped
  at 3 lines).
- **Cross-shell install instructions** in the README (bash, PowerShell, zsh,
  cmd.exe).
- `CHANGELOG.md` (this file).
- npm-tarball `files` allow-list in `package.json` — only the four `.ts` source
  files + README/LICENSE/CHANGELOG/preview ship to consumers (≈30 KB unpacked).
- `engines.node >=18` and explicit `peerDependencies` on
  `@mariozechner/pi-coding-agent` and `@mariozechner/pi-tui`.

### Changed
- `detailH` bumped 6 → 10 rows to host the boxed window. Falls back to 6 when
  the terminal is shorter than 22 rows (graceful degradation).
- Top-of-file docblock in `overlay.ts` now diagrams the new row + box layout.

### Internal
- Added `shortSummary(desc, maxLen)` helper that extracts the first sentence
  (or first N chars) of a SKILL.md description for inline rendering.

---

## [0.1.0] — 2026-05-21

### Added
- Initial public release.
- Two-pane categorized skill browser overlay for [Pi](https://github.com/mariozechner/pi).
- Left pane: ★ Top 10 → 📌 Bookmarks → 💡 Suggested → 13+ auto-categories.
- Right pane: skill list for the active section + detail panel.
- Frecency tracking with a 7-day half-life (`count × 0.5^(age_days / 7)`).
- `Ctrl+B` to toggle bookmarks; `/` to search by name or description.
- Daily AI-free suggestions (1–3 underused skills, refreshed once per day).
- Scans 8 standard Pi/Claude/Codex/Agents skill locations + npm global packages.
- `/skills` and `/skill-deck` slash commands.
- Selected skill is injected as a context message before the next agent turn.

[0.2.1]: https://github.com/CymatiStatic/pi-skill-deck/releases/tag/v0.2.1
[0.2.0]: https://github.com/CymatiStatic/pi-skill-deck/releases/tag/v0.2.0
[0.1.1]: https://github.com/CymatiStatic/pi-skill-deck/releases/tag/v0.1.1
[0.1.0]: https://github.com/CymatiStatic/pi-skill-deck/releases/tag/v0.1.0

# Changelog

All notable changes to **pi-skill-deck** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.1]: https://github.com/CymatiStatic/pi-skill-deck/releases/tag/v0.1.1
[0.1.0]: https://github.com/CymatiStatic/pi-skill-deck/releases/tag/v0.1.0

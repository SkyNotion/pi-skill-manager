/**
 * Two-pane TUI overlay for the pi-skill-manager.
 *
 * Left pane:  ★ Top 10 → 📌 Bookmarks → 💡 Suggested → [Grouped sections per current group-by mode]
 * Right pane: Skill list (each row = name + inline short summary + indicators)
 *             + boxed DETAILS window at the bottom with full source attribution,
 *               description, and a "What it does" body excerpt.
 *
 * Keys:
 *   Tab / ← →   switch focus between panes
 *   ↑ ↓         navigate within focused pane
 *   Enter       queue selected skill (in right pane) / focus right pane (in left pane)
 *   Ctrl+B      toggle bookmark on highlighted skill
 *   c           toggle selected category on/off (category mode only)
 *   g           cycle group-by mode (Category → Source → Framework → Creator → Location → Tag → Usage → Flat)
 *   G           open group-by picker
 *   t           edit tags — INLINE editor (replaces footer)
 *   T           edit tags — MODAL editor (centered floating box)
 *   /           start search
 *   ?           toggle keyboard reference panel
 *   Esc         close (or exit search / tag editor / picker / help)
 *   Backspace   delete search/tag-editor char
 */

import { matchesKey } from "@mariozechner/pi-tui";
import type { Skill } from "./scan.ts";
import { getCategoryDef } from "./categories.ts";
import {
  getUsageData,
  topSkills,
  getBookmarks,
  toggleBookmark,
  isBookmarked,
  getDailySuggestions,
  frecencyScore,
  getPrefs,
  setPrefs,
  type SuggestionPick,
} from "./state.ts";
import {
  buildGroups,
  nextGroupByMode,
  isValidGroupByMode,
  ALL_GROUP_BY_MODES,
  GROUP_BY_LABELS,
  GROUP_BY_HINTS,
  type GroupByMode,
  type GroupedSection,
} from "./groupings.ts";
import { getTags, setTags, parseTagInput } from "./tags.ts";
import { isCategoryEnabled } from "./config.ts";

// ═══════════════════════════════════════════════════════════════════════════
// ANSI helpers
// ═══════════════════════════════════════════════════════════════════════════

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const fg = (code: string, text: string) => (code ? `${ESC}${code}m${text}${RESET}` : text);
const bold = (s: string) => `${ESC}1m${s}${ESC}22m`;
const dim = (s: string) => `${ESC}2m${s}${RESET}`;
const reverse = (s: string) => `${ESC}7m${s}${RESET}`;
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
const visLen = (s: string) => stripAnsi(s).length;
const pad = (s: string, len: number) => s + " ".repeat(Math.max(0, len - visLen(s)));
const truncate = (s: string, max: number) => {
  const raw = stripAnsi(s);
  if (raw.length <= max) return s;
  let vis = 0;
  let i = 0;
  while (i < s.length && vis < max - 1) {
    if (s[i] === "\x1b") {
      const end = s.indexOf("m", i);
      if (end !== -1) { i = end + 1; continue; }
    }
    vis++;
    i++;
  }
  return s.slice(0, i) + RESET + "…";
};

// ═══════════════════════════════════════════════════════════════════════════
// Section types
// ═══════════════════════════════════════════════════════════════════════════

interface Section {
  type: "top10" | "bookmarks" | "suggested" | "group";
  label: string;
  icon: string;
  ansi: string;
  skills: Skill[];
  suggestions?: SuggestionPick[];
  count: number;
}

export type OverlayResult = {
  skill: Skill | null;
  action: "select" | "cancel" | "categories-changed";
  bookmarkToggled?: string;
  enabledCategories?: string[] | null;
};

// ═══════════════════════════════════════════════════════════════════════════
// Overlay
// ═══════════════════════════════════════════════════════════════════════════

export class SkillDeckOverlay {
  // Layout
  private focusPane: "left" | "right" = "left";
  private leftIdx = 0;
  private rightIdx = 0;
  private rightScroll = 0;
  private query = "";
  private isSearching = false;

  // Modal states
  private groupByPickerOpen = false;
  private groupByPickerIdx = 0;
  private tagEditMode: "none" | "inline" | "modal" = "none";
  private tagEditValue = "";
  private helpOpen = false;

  // Group-by mode
  private groupBy: GroupByMode;

  // Data
  private sections: Section[] = [];
  private allSkills: Skill[];
  private usage = getUsageData();
  private inactivityTimeout: ReturnType<typeof setTimeout> | null = null;
  private requestRender: (() => void) | null = null;

  private static readonly INACTIVITY_MS = 120_000;

  constructor(
    skills: Skill[],
    private done: (result: OverlayResult) => void,
    private enabledCategories: string[] | null = null,
  ) {
    this.allSkills = skills;
    const prefs = getPrefs();
    this.groupBy = isValidGroupByMode(prefs.groupBy) ? prefs.groupBy : "category";
    this.buildSections();
    this.resetInactivity();
  }

  setRequestRender(fn: () => void): void {
    this.requestRender = fn;
  }

  // ─── Section building ──────────────────────────────────────────────

  private buildSections(): void {
    const sections: Section[] = [];
    const bookmarkNames = getBookmarks();
    const suggestions = getDailySuggestions(this.allSkills);

    // ★ Top 10 (always pinned)
    const top = topSkills(this.allSkills, 10);
    if (top.length > 0) {
      sections.push({
        type: "top10", label: "★ TOP 10", icon: "★", ansi: "33",
        skills: top, count: top.length,
      });
    }

    // 📌 Bookmarks (always pinned)
    const bmSkills = bookmarkNames
      .map((n) => this.allSkills.find((s) => s.name === n))
      .filter(Boolean) as Skill[];
    sections.push({
      type: "bookmarks", label: "📌 BOOKMARKS", icon: "📌", ansi: "36",
      skills: bmSkills, count: bmSkills.length,
    });

    // 💡 Suggested (always pinned, when available)
    if (suggestions.length > 0) {
      const sugSkills = suggestions
        .map((p) => this.allSkills.find((s) => s.name === p.name))
        .filter(Boolean) as Skill[];
      sections.push({
        type: "suggested", label: "💡 SUGGESTED", icon: "💡", ansi: "35",
        skills: sugSkills, suggestions, count: sugSkills.length,
      });
    }

    // Grouped sections (per current group-by mode)
    const grouped: GroupedSection[] = buildGroups(this.allSkills, this.groupBy);
    for (const g of grouped) {
      sections.push({
        type: "group", label: g.label, icon: g.icon, ansi: g.ansi,
        skills: g.skills, count: g.skills.length,
      });
    }

    this.sections = sections;
    if (this.leftIdx >= sections.length) this.leftIdx = Math.max(0, sections.length - 1);
  }

  private activeSection(): Section {
    return this.sections[this.leftIdx] || this.sections[0];
  }

  private activeSkills(): Skill[] {
    const sec = this.activeSection();
    if (!sec) return [];
    if (this.query) {
      return sec.skills.filter(
        (s) =>
          s.name.toLowerCase().includes(this.query.toLowerCase()) ||
          s.description.toLowerCase().includes(this.query.toLowerCase())
      );
    }
    return sec.skills;
  }

  // ─── Render ────────────────────────────────────────────────────────

  render(width: number): string[] {
    const termHeight = (typeof process !== "undefined" && process.stdout?.rows) || 40;
    const w = Math.min(110, width - 2);
    const h = Math.max(24, termHeight - 4);
    const leftW = Math.min(28, Math.floor(w * 0.3));
    const rightW = w - leftW - 1;
    const innerH = h - 3;

    const lines: string[] = [];
    const total = this.allSkills.length;
    const modeLabel = GROUP_BY_LABELS[this.groupBy];

    // ── Header ── (shows current group-by mode + the keys that change it)
    const headerLeft = ` ${fg("36", "/skill-manager")}${dim(` ─── ${total} skills `)}`;
    const headerRight = `${dim("group: ")}${fg("33", bold(modeLabel))} ${keyHint("g")}${dim("/")}${keyHint("G")}${dim(" change ")}${keyHint("?")}${dim(" help ")}`;
    const headerInner = headerLeft + dim("─".repeat(Math.max(0, w - visLen(headerLeft) - visLen(headerRight) - 2))) + headerRight;
    lines.push(dim("┌") + headerInner + dim("┐"));

    // Search bar (if active)
    if (this.isSearching) {
      const text = " Search: " + fg("33", this.query) + fg("33", "▌");
      const filler = " ".repeat(Math.max(0, w - visLen(text) - 2));
      lines.push(dim("│") + text + filler + dim("│"));
    }

    // ── Body ──
    const leftLines = this.renderLeftPane(leftW, innerH);
    const rightLines = this.renderRightPane(rightW, innerH);

    const bodyH = Math.max(leftLines.length, rightLines.length, innerH);
    for (let i = 0; i < bodyH; i++) {
      const l = i < leftLines.length ? leftLines[i] : pad("", leftW);
      const r = i < rightLines.length ? rightLines[i] : pad("", rightW);
      lines.push(dim("│") + pad(l, leftW) + dim("│") + pad(r, rightW) + dim("│"));
    }

    // ── Footer ──
    const hintFooter = this.renderFooter();
    lines.push(
      dim("└") + truncate(hintFooter, w - 2) +
      " ".repeat(Math.max(0, w - 2 - visLen(hintFooter))) +
      dim("┘")
    );

    // ── Overlays (modal panels — drawn on top of body) ──
    if (this.helpOpen) {
      this.overlayBox(lines, w, this.renderHelpPanel());
    } else if (this.groupByPickerOpen) {
      this.overlayBox(lines, w, this.renderGroupByPicker());
    } else if (this.tagEditMode === "modal") {
      this.overlayBox(lines, w, this.renderTagEditorModalBox());
    }

    return lines;
  }

  private renderFooter(): string {
    if (this.isSearching) {
      return " " + dim("type to filter") + "  " + keyHint("↵") + dim(" accept  ") + keyHint("esc") + dim(" clear");
    }
    if (this.tagEditMode === "inline") {
      return " " + fg("33", bold("tags:")) + " " + this.tagEditValue + fg("33", "▌") +
        "  " + keyHint("↵") + dim(" save  ") + keyHint("esc") + dim(" cancel");
    }
    if (this.tagEditMode === "modal") {
      return " " + dim("modal tag editor open  ") + keyHint("↵") + dim(" save  ") + keyHint("esc") + dim(" cancel");
    }
    if (this.groupByPickerOpen) {
      return " " + dim("group-by picker  ") + keyHint("↑↓") + dim(" pick  ") + keyHint("↵") + dim(" apply  ") + keyHint("esc") + dim(" cancel");
    }
    if (this.helpOpen) {
      return " " + dim("keyboard reference  ") + keyHint("?") + dim(" or ") + keyHint("esc") + dim(" to close");
    }
    // Main footer — keys highlighted in cyan, labels dim for fast scanning
    const toggleHint = this.groupBy === "category"
      ? `  ${keyHint("c")}${dim(" toggle ")}`
      : "";
    return " " +
      keyHint("Tab")    + dim(" panes ")    +
      keyHint("↑↓")     + dim(" nav ")      +
      keyHint("↵")     + dim(" queue ")    +
      keyHint("Ctrl+B") + dim(" bookmark ") +
      keyHint("g")      + dim("/")           + keyHint("G") + dim(" group ") +
      keyHint("t")      + dim("/")           + keyHint("T") + dim(" tag ") +
      toggleHint +
      keyHint("/")      + dim(" search ")   +
      keyHint("?")      + dim(" help ")     +
      keyHint("Esc")    + dim(" close");
  }

  /** Toggle the enabled state of a category. Mutates enabledCategories in place. */
  private toggleCategory(category: string): void {
    const current = this.enabledCategories;
    if (current === null) {
      // Was "all enabled" — explicitly disable this one category
      // Collect all unique categories from skills across sections
      const allCats = new Set<string>();
      for (const sec of this.sections) {
        for (const s of sec.skills) allCats.add(s.category);
      }
      // Enable everything except the toggled category
      this.enabledCategories = [...allCats].filter((c) => c !== category);
    } else {
      const idx = current.indexOf(category);
      if (idx >= 0) {
        // Was enabled → remove it
        const next = current.filter((c) => c !== category);
        if (next.length === 0) {
          // All disabled now
          this.enabledCategories = [];
        } else {
          this.enabledCategories = next;
        }
      } else {
        // Was disabled → add it
        this.enabledCategories = [...current, category];
      }
    }
  }

  private renderLeftPane(w: number, maxH: number): string[] {
    const lines: string[] = [];
    const focused = this.focusPane === "left";

    for (let i = 0; i < this.sections.length && lines.length < maxH; i++) {
      const sec = this.sections[i];
      const isActive = i === this.leftIdx;
      const countStr = ` ${sec.count}`;

      // For group sections in category mode, show [✓]/[ ] toggle indicator
      let togglePrefix = "";
      if (sec.type === "group" && this.groupBy === "category") {
        const enabled =
          this.enabledCategories === null ||
          isCategoryEnabled(sec.label, this.enabledCategories);
        togglePrefix = enabled ? fg("32", "[✓] ") : fg("90", "[ ] ");
      }

      let label = sec.type === "group"
        ? ` ${sec.icon} ${togglePrefix}${sec.label}`
        : ` ${sec.label}`;

      const avail = w - visLen(countStr) - 1;
      label = truncate(label, avail);
      const line = pad(label, avail) + dim(countStr);

      if (isActive && focused) {
        lines.push(reverse(pad(line, w)));
      } else if (isActive) {
        lines.push(fg("36", "►") + pad(line.slice(1), w - 1));
      } else {
        lines.push(pad(line, w));
      }

      // Divider after pinned sections (last pinned section is suggested OR bookmarks)
      const next = this.sections[i + 1];
      const isLastPinned =
        (sec.type === "suggested" && next?.type === "group") ||
        (sec.type === "bookmarks" && next?.type === "group");
      if (isLastPinned && lines.length < maxH) {
        lines.push(dim("─".repeat(w)));
      }
    }

    return lines;
  }

  private renderRightPane(w: number, maxH: number): string[] {
    const lines: string[] = [];
    const sec = this.activeSection();
    const skills = this.activeSkills();
    const focused = this.focusPane === "right";

    // Section header
    const headerLabel = sec.type === "group"
      ? `${sec.icon} ${sec.label} (${sec.count})`
      : `${sec.label}`;
    lines.push(" " + fg(sec.ansi, bold(headerLabel)));
    lines.push(dim(" " + "─".repeat(w - 2)));

    // Detail box is adaptive — ~55% of right pane, clamped 12-20
    const detailH = Math.min(20, Math.max(12, Math.floor((maxH - 2) * 0.55)));
    const listH = maxH - lines.length - detailH - 1;

    if (this.rightIdx >= skills.length) this.rightIdx = Math.max(0, skills.length - 1);
    if (this.rightIdx < 0) this.rightIdx = 0;
    if (this.rightIdx < this.rightScroll) this.rightScroll = this.rightIdx;
    if (this.rightIdx >= this.rightScroll + listH) this.rightScroll = this.rightIdx - listH + 1;

    // Skill list
    for (let i = this.rightScroll; i < skills.length && lines.length - 2 < listH; i++) {
      const s = skills[i];
      if (!s) continue; // defensive — guard against sparse array or stale index
      const isSelected = i === this.rightIdx && focused;
      const u = this.usage[s.name];
      const usageStr = u && u.count > 0 ? fg("33", `★${u.count}`) : "";
      const bmStr = isBookmarked(s.name) ? fg("36", " 📌") : "";
      const tagCount = getTags(s.name).length;
      const tagStr = tagCount > 0 ? fg("33", ` 🏷${tagCount}`) : "";
      const thinStr = s.bodyIsThin ? fg("90", " ⚠") : "";
      const indicatorStr = bmStr + tagStr + thinStr + (usageStr ? " " + usageStr : "");
      const indicatorW = visLen(indicatorStr);

      const markerW = 3;
      const sepW = 3;
      const rightMargin = 1;
      const flexW = Math.max(0, w - markerW - sepW - indicatorW - rightMargin);
      const nameColW = Math.max(8, Math.min(26, Math.floor(flexW * 0.4)));
      const summaryColW = Math.max(0, flexW - nameColW);

      const name = truncate(s.name, nameColW);
      const summary = summaryColW > 8 ? shortSummary(s.description, summaryColW) : "";

      const marker = isSelected ? fg("36", " ► ") : "   ";
      const nameField = pad(name, nameColW);
      const sep = summaryColW > 8 ? dim(" ┊ ") : "   ";
      const summaryField = pad(dim(summary), summaryColW);

      let line = marker + nameField + sep + summaryField;
      const gap = Math.max(1, w - visLen(line) - indicatorW - rightMargin);
      line += " ".repeat(gap) + indicatorStr;

      if (isSelected) lines.push(fg("36", pad(line, w)));
      else lines.push(pad(line, w));
    }

    // Pad list area to start the detail box at a predictable row
    while (lines.length < maxH - detailH) lines.push("");

    // ── DETAILS box ──
    const selectedSkill = skills[this.rightIdx];
    this.renderDetailBox(lines, w, detailH, selectedSkill);

    return lines;
  }

  private renderDetailBox(lines: string[], w: number, detailH: number, skill: Skill | undefined): void {
    const boxInnerW = w - 2;
    const dataLineFor = (s: string) => dim("│") + " " + pad(truncate(s, boxInnerW - 2), boxInnerW - 1) + dim("│");

    if (!skill) {
      lines.push(dim("┌" + "─".repeat(boxInnerW) + "┐"));
      lines.push(dim("│") + pad(" (no skill selected)", boxInnerW) + dim("│"));
      for (let i = 0; i < detailH - 3; i++) {
        lines.push(dim("│") + pad("", boxInnerW) + dim("│"));
      }
      lines.push(dim("└" + "─".repeat(boxInnerW) + "┘"));
      return;
    }

    // Header
    const headerLabel = ` DETAILS: ${skill.name} `;
    const headerLabelTrunc = truncate(headerLabel, Math.max(0, boxInnerW - 2));
    const headerFillW = Math.max(0, boxInnerW - visLen(headerLabelTrunc) - 1);
    lines.push(
      dim("┌─") + fg("36", bold(headerLabelTrunc)) + dim("─".repeat(headerFillW) + "┐")
    );

    // Row 1: meta — category · usage
    const u = this.usage[skill.name];
    const usedStr = u && u.count > 0
      ? `used ${u.count}× · last: ${timeAgo(u.lastUsedAt)}`
      : "never used";
    lines.push(dataLineFor(dim(`category: ${skill.category} · ${usedStr}`)));

    // Row 2: source · location
    const src = skill.source;
    lines.push(dataLineFor(
      dim("source: ") + fg(src.origin === "unknown" ? "90" : "36", src.origin) +
      dim(" · ") + dim(src.location)
    ));

    // Row 3: framework · creator
    lines.push(dataLineFor(
      dim("framework: ") + fg("33", src.framework) +
      dim("    creator: ") + fg("35", src.creator)
    ));

    // Row 4: tags (with inline key hint so editing is discoverable)
    const tagList = getTags(skill.name);
    const tagsRender = tagList.length > 0
      ? tagList.map((t) => fg("33", `#${t}`)).join(" ")
      : dim("(none)");
    const tagsHint = "  " + keyHint("t") + dim(" inline ") + keyHint("T") + dim(" modal");
    lines.push(dataLineFor(dim("tags:    ") + " " + tagsRender + tagsHint));

    // Separator
    lines.push(dim("│") + " " + dim("─".repeat(boxInnerW - 2)) + " " + dim("│"));

    // Body section: Description + What it does
    // Available rows for description + what-it-does:
    //   detailH - 1 (top border) - 4 (meta rows) - 1 (separator) - 1 (bottom border) = detailH - 7
    const bodyRows = Math.max(0, detailH - 7);
    const descLines = wordWrap(skill.description, boxInnerW - 2);

    let bodyExcerptLines: string[];
    if (skill.bodyIsThin) {
      bodyExcerptLines = [fg("90", "⚠ No body content in SKILL.md — frontmatter description only.")];
    } else {
      bodyExcerptLines = wordWrap(skill.bodyExcerpt, boxInnerW - 2);
    }

    // Allocate: half to description, half to excerpt — but description has a "Description:" label row,
    // excerpt has a "What it does:" label row.
    // Minimum 1 line each for content.
    const halfRows = Math.floor(bodyRows / 2);
    const descHeader = bodyRows >= 3 ? 1 : 0;
    const excerptHeader = bodyRows >= 4 ? 1 : 0;
    const descContentCap = Math.max(1, halfRows - descHeader);
    const excerptContentCap = Math.max(1, bodyRows - halfRows - excerptHeader);

    // Render Description block
    let rendered = 0;
    if (descHeader && rendered < bodyRows) {
      lines.push(dataLineFor(fg("36", "Description:")));
      rendered++;
    }
    for (let i = 0; i < Math.min(descContentCap, descLines.length) && rendered < bodyRows; i++) {
      lines.push(dataLineFor(descLines[i]));
      rendered++;
    }
    if (descLines.length > descContentCap && rendered < bodyRows) {
      // overflow indicator
      lines[lines.length - 1] = dataLineFor(descLines[descContentCap - 1].replace(/.{1,3}$/, "…"));
    }

    // Render What it does block
    if (excerptHeader && rendered < bodyRows) {
      lines.push(dataLineFor(fg("36", "What it does:")));
      rendered++;
    }
    for (let i = 0; i < Math.min(excerptContentCap, bodyExcerptLines.length) && rendered < bodyRows; i++) {
      lines.push(dataLineFor(bodyExcerptLines[i]));
      rendered++;
    }
    if (bodyExcerptLines.length > excerptContentCap && rendered <= bodyRows) {
      // Truncate-with-ellipsis on the last excerpt line
      const lastIdx = lines.length - 1;
      const stripped = stripAnsi(lines[lastIdx]);
      if (!stripped.endsWith("…")) {
        lines[lastIdx] = dataLineFor((bodyExcerptLines[excerptContentCap - 1] ?? "").replace(/.{1,3}$/, "…"));
      }
    }

    // Pad remaining body rows
    while (rendered < bodyRows) {
      lines.push(dim("│") + pad("", boxInnerW) + dim("│"));
      rendered++;
    }

    lines.push(dim("└" + "─".repeat(boxInnerW) + "┘"));
  }

  // ─── Modal overlays ───────────────────────────────────────────────

  private overlayBox(lines: string[], totalW: number, boxLines: string[]): void {
    // Position: centered horizontally, near the bottom (just above footer).
    const boxW = Math.max(...boxLines.map((l) => visLen(l)));
    const startCol = Math.max(2, Math.floor((totalW - boxW) / 2));
    const startRow = Math.max(2, lines.length - boxLines.length - 2);

    for (let i = 0; i < boxLines.length; i++) {
      const lineIdx = startRow + i;
      if (lineIdx >= lines.length - 1) break; // never overwrite the very last line (footer)
      const original = lines[lineIdx];
      // Splice boxLines[i] into the original at startCol (best-effort, treating as monospace)
      lines[lineIdx] = overlayInto(original, boxLines[i], startCol);
    }
  }

  private renderGroupByPicker(): string[] {
    const lines: string[] = [];
    const widest = Math.max(...ALL_GROUP_BY_MODES.map((m) => GROUP_BY_LABELS[m].length + GROUP_BY_HINTS[m].length + 4));
    const w = Math.max(50, widest + 4);

    lines.push(dim("┌") + fg("36", bold(" Group by ")) + dim("─".repeat(w - 12) + "┐"));

    for (let i = 0; i < ALL_GROUP_BY_MODES.length; i++) {
      const mode = ALL_GROUP_BY_MODES[i];
      const isActive = i === this.groupByPickerIdx;
      const isCurrent = mode === this.groupBy;
      const label = GROUP_BY_LABELS[mode];
      const hint = GROUP_BY_HINTS[mode];
      const marker = isCurrent ? fg("33", "●") : " ";
      const text = `  ${marker}  ${label}  ${dim("— " + hint)}`;
      const padded = pad(text, w - 2);
      if (isActive) {
        lines.push(dim("│") + reverse(padded) + dim("│"));
      } else {
        lines.push(dim("│") + padded + dim("│"));
      }
    }
    lines.push(dim("└" + "─".repeat(w) + "┘"));
    return lines;
  }

  private renderHelpPanel(): string[] {
    const w = 64;
    const lines: string[] = [];
    const titleLabel = " Keyboard reference ";
    lines.push(dim("┌") + fg("36", bold(titleLabel)) + dim("─".repeat(w - titleLabel.length - 1) + "┐"));

    const rows: Array<[string, string] | "section" | string> = [
      "Navigation",
      ["Tab  /  ← →",       "Switch focus between panes"],
      ["↑ ↓",                "Move up / down within a pane"],
      ["Enter",              "Focus right pane  /  queue skill"],
      "section",
      "Group-by",
      ["g",                  "Cycle to next group-by mode"],
      ["G",                  "Open group-by picker (menu)"],
      ["c",                  "Toggle selected category on/off"],
      "section",
      "Skill actions",
      ["Ctrl+B",             "Toggle bookmark on highlighted skill"],
      ["t",                  "Edit tags — inline editor"],
      ["T",                  "Edit tags — modal editor"],
      "section",
      "Search & exit",
      ["/",                  "Start search"],
      ["Backspace",          "Delete a search / tag-editor char"],
      ["?",                  "Toggle this help panel"],
      ["Esc",                "Close overlay  /  cancel modal"],
    ];

    for (const row of rows) {
      if (row === "section") {
        lines.push(dim("│ " + "─".repeat(w - 2) + " │"));
        continue;
      }
      if (typeof row === "string") {
        const txt = "  " + fg("33", bold(row));
        lines.push(dim("│") + pad(txt, w) + dim("│"));
        continue;
      }
      const [k, label] = row;
      const keyCol = "    " + keyHint(k);
      const padded = pad(keyCol, 22) + dim(label);
      lines.push(dim("│") + pad(" " + padded, w) + dim("│"));
    }

    lines.push(dim("│ " + "─".repeat(w - 2) + " │"));
    const closeLine = "  " + dim("Press ") + keyHint("?") + dim(" or ") + keyHint("Esc") + dim(" to close");
    lines.push(dim("│") + pad(closeLine, w) + dim("│"));
    lines.push(dim("└" + "─".repeat(w) + "┘"));
    return lines;
  }

  private renderTagEditorModalBox(): string[] {
    const skill = this.activeSkills()[this.rightIdx];
    if (!skill) return [];
    const w = 70;
    const lines: string[] = [];

    lines.push(dim("┌") + fg("36", bold(" Edit tags ")) + dim(`─ ${skill.name} ` + "─".repeat(Math.max(0, w - skill.name.length - 16)) + "┐"));
    lines.push(dim("│") + pad("", w) + dim("│"));
    lines.push(dim("│") + "  " + dim("Tags (comma-separated):") + pad("", w - 28) + dim("│"));
    lines.push(dim("│") + "  " + fg("33", this.tagEditValue) + fg("33", "▌") + pad("", w - 4 - this.tagEditValue.length - 1) + dim("│"));
    lines.push(dim("│") + pad("", w) + dim("│"));
    lines.push(dim("│") + "  " + dim("↵") + " save · " + dim("esc") + " cancel" + pad("", w - 25) + dim("│"));
    lines.push(dim("└" + "─".repeat(w) + "┘"));
    return lines;
  }

  // ─── Input handling ────────────────────────────────────────────────

  handleInput(data: string): void {
    this.resetInactivity();

    // Tag editor (highest priority)
    if (this.tagEditMode !== "none") {
      this.handleTagEditorInput(data);
      return;
    }

    // Group-by picker (next priority)
    if (this.groupByPickerOpen) {
      this.handleGroupByPickerInput(data);
      return;
    }

    // Help panel (modal)
    if (this.helpOpen) {
      if (matchesKey(data, "escape") || data === "?") {
        this.helpOpen = false;
        this.requestRender?.();
      }
      return;
    }

    // Search mode
    if (this.isSearching) {
      this.handleSearchInput(data);
      return;
    }

    // ? → toggle help
    if (data === "?") {
      this.helpOpen = true;
      this.requestRender?.();
      return;
    }

    // Escape → close
    if (matchesKey(data, "escape")) {
      this.cleanup();
      this.done({
        skill: null,
        action: "cancel",
        enabledCategories: this.enabledCategories,
      });
      return;
    }

    // / → enter search
    if (data === "/") {
      this.isSearching = true;
      this.query = "";
      this.requestRender?.();
      return;
    }

    // g → cycle group-by
    if (data === "g") {
      this.groupBy = nextGroupByMode(this.groupBy);
      setPrefs({ groupBy: this.groupBy });
      this.leftIdx = 0;
      this.rightIdx = 0;
      this.rightScroll = 0;
      this.buildSections();
      this.requestRender?.();
      return;
    }

    // c → toggle category on/off (only effective in category group-by mode)
    if (data === "c" && this.groupBy === "category") {
      const sec = this.activeSection();
      if (sec.type === "group") {
        this.toggleCategory(sec.label);
        // Rebuild sections so the skill counts reflect the new enabled state
        this.buildSections();
        this.requestRender?.();
      }
      return;
    }

    // G → open group-by picker
    if (data === "G") {
      this.groupByPickerOpen = true;
      this.groupByPickerIdx = ALL_GROUP_BY_MODES.indexOf(this.groupBy);
      if (this.groupByPickerIdx < 0) this.groupByPickerIdx = 0;
      this.requestRender?.();
      return;
    }

    // t → inline tag editor
    if (data === "t") {
      this.openTagEditor("inline");
      return;
    }

    // T → modal tag editor
    if (data === "T") {
      this.openTagEditor("modal");
      return;
    }

    // Tab / arrows → switch panes
    if (matchesKey(data, "tab") || (matchesKey(data, "right") && this.focusPane === "left")) {
      this.focusPane = this.focusPane === "left" ? "right" : "left";
      this.requestRender?.();
      return;
    }
    if (matchesKey(data, "left") && this.focusPane === "right") {
      this.focusPane = "left";
      this.requestRender?.();
      return;
    }

    // Ctrl+B → toggle bookmark
    if (matchesKey(data, "ctrl+b")) {
      const s = this.activeSkills()[this.rightIdx];
      if (s) {
        toggleBookmark(s.name);
        this.buildSections();
        this.requestRender?.();
      }
      return;
    }

    // Enter → queue skill (right pane) or focus right (left pane)
    if (matchesKey(data, "return")) {
      if (this.focusPane === "left") {
        this.focusPane = "right";
        this.rightIdx = 0;
        this.rightScroll = 0;
        this.requestRender?.();
        return;
      }
      const s = this.activeSkills()[this.rightIdx];
      if (s) {
        this.cleanup();
        this.done({ skill: s, action: "select" });
      }
      return;
    }

    // Navigation
    if (matchesKey(data, "up")) {
      if (this.focusPane === "left") {
        this.leftIdx = Math.max(0, this.leftIdx - 1);
        this.rightIdx = 0;
        this.rightScroll = 0;
      } else {
        this.rightIdx = Math.max(0, this.rightIdx - 1);
      }
      this.requestRender?.();
      return;
    }
    if (matchesKey(data, "down")) {
      if (this.focusPane === "left") {
        this.leftIdx = Math.min(this.sections.length - 1, this.leftIdx + 1);
        this.rightIdx = 0;
        this.rightScroll = 0;
      } else {
        this.rightIdx = Math.min(this.activeSkills().length - 1, this.rightIdx + 1);
      }
      this.requestRender?.();
      return;
    }
  }

  private handleSearchInput(data: string): void {
    if (matchesKey(data, "escape")) {
      this.isSearching = false;
      this.query = "";
      this.rightIdx = 0;
      this.rightScroll = 0;
      this.requestRender?.();
      return;
    }
    if (matchesKey(data, "return")) {
      this.isSearching = false;
      this.requestRender?.();
      return;
    }
    if (matchesKey(data, "backspace")) {
      this.query = this.query.slice(0, -1);
      this.rightIdx = 0;
      this.rightScroll = 0;
      this.requestRender?.();
      return;
    }
    if (data.length === 1 && data.charCodeAt(0) >= 32) {
      this.query += data;
      this.rightIdx = 0;
      this.rightScroll = 0;
      this.requestRender?.();
    }
  }

  private handleGroupByPickerInput(data: string): void {
    if (matchesKey(data, "escape")) {
      this.groupByPickerOpen = false;
      this.requestRender?.();
      return;
    }
    if (matchesKey(data, "up")) {
      this.groupByPickerIdx = Math.max(0, this.groupByPickerIdx - 1);
      this.requestRender?.();
      return;
    }
    if (matchesKey(data, "down")) {
      this.groupByPickerIdx = Math.min(ALL_GROUP_BY_MODES.length - 1, this.groupByPickerIdx + 1);
      this.requestRender?.();
      return;
    }
    if (matchesKey(data, "return")) {
      this.groupBy = ALL_GROUP_BY_MODES[this.groupByPickerIdx];
      setPrefs({ groupBy: this.groupBy });
      this.groupByPickerOpen = false;
      this.leftIdx = 0;
      this.rightIdx = 0;
      this.rightScroll = 0;
      this.buildSections();
      this.requestRender?.();
    }
  }

  private openTagEditor(style: "inline" | "modal"): void {
    const s = this.activeSkills()[this.rightIdx];
    if (!s) return;
    this.tagEditMode = style;
    this.tagEditValue = getTags(s.name).join(", ");
    setPrefs({ tagEditorStyle: style });
    this.requestRender?.();
  }

  private handleTagEditorInput(data: string): void {
    if (matchesKey(data, "escape")) {
      this.tagEditMode = "none";
      this.tagEditValue = "";
      this.requestRender?.();
      return;
    }
    if (matchesKey(data, "return")) {
      const s = this.activeSkills()[this.rightIdx];
      if (s) {
        setTags(s.name, parseTagInput(this.tagEditValue));
        // Rebuild if we're grouping by tag — sections change
        if (this.groupBy === "tag") this.buildSections();
      }
      this.tagEditMode = "none";
      this.tagEditValue = "";
      this.requestRender?.();
      return;
    }
    if (matchesKey(data, "backspace")) {
      this.tagEditValue = this.tagEditValue.slice(0, -1);
      this.requestRender?.();
      return;
    }
    if (data.length === 1 && data.charCodeAt(0) >= 32) {
      this.tagEditValue += data;
      this.requestRender?.();
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────

  private resetInactivity(): void {
    if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);
    this.inactivityTimeout = setTimeout(() => {
      this.cleanup();
      this.done({
        skill: null,
        action: "cancel",
        enabledCategories: this.enabledCategories,
      });
    }, SkillDeckOverlay.INACTIVITY_MS);
  }

  private cleanup(): void {
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }
  }

  invalidate(): void {}
  dispose(): void { this.cleanup(); }
}

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

/** Render a key chip like `[Tab]` in cyan brackets — the visual unit for all keymap hints. */
function keyHint(k: string): string {
  return fg("36", `[${k}]`);
}

function timeAgo(iso: string): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function shortSummary(desc: string, maxLen: number): string {
  if (!desc) return "";
  const flat = desc.replace(/\s+/g, " ").trim();
  const sentenceMatch = flat.match(/^([^.!?]+[.!?])(\s|$)/);
  let s = sentenceMatch ? sentenceMatch[1].trim() : flat;
  s = s.replace(/[.!?]+$/, "");
  if (s.length > maxLen) {
    s = s.slice(0, Math.max(1, maxLen - 1)).replace(/\s+\S*$/, "") + "…";
  }
  return s;
}

function wordWrap(text: string, maxW: number): string[] {
  if (!text) return [""];
  // Preserve paragraph breaks as blank lines
  const paragraphs = text.split(/\n\s*\n/);
  const out: string[] = [];
  for (let p = 0; p < paragraphs.length; p++) {
    if (p > 0) out.push("");
    const words = paragraphs[p].split(/\s+/);
    let current = "";
    for (const word of words) {
      if (current.length + word.length + 1 > maxW) {
        if (current) out.push(current);
        current = word;
      } else {
        current = current ? current + " " + word : word;
      }
    }
    if (current) out.push(current);
  }
  return out;
}

/**
 * Best-effort overlay of `boxLine` onto `baseLine` starting at column `col`.
 * Treats both lines as monospace (after stripping ANSI from the base for
 * length math) and preserves trailing characters of baseLine when the
 * boxLine is narrower than the original.
 */
function overlayInto(baseLine: string, boxLine: string, col: number): string {
  const baseVisLen = visLen(baseLine);
  const boxVisLen = visLen(boxLine);
  // If the box would overflow the base line, just return boxLine padded
  if (col + boxVisLen >= baseVisLen) {
    const leftPad = " ".repeat(Math.max(0, col));
    return leftPad + boxLine;
  }
  // Walk baseLine char-by-char (skipping ANSI escapes) until we reach `col`,
  // then splice in boxLine, then resume baseLine after `col + boxVisLen`.
  let visIdx = 0;
  let i = 0;
  let prefix = "";
  while (i < baseLine.length && visIdx < col) {
    if (baseLine[i] === "\x1b") {
      const end = baseLine.indexOf("m", i);
      if (end !== -1) { prefix += baseLine.slice(i, end + 1); i = end + 1; continue; }
    }
    prefix += baseLine[i];
    visIdx++;
    i++;
  }

  // Skip baseLine for boxVisLen visible chars
  let skipped = 0;
  while (i < baseLine.length && skipped < boxVisLen) {
    if (baseLine[i] === "\x1b") {
      const end = baseLine.indexOf("m", i);
      if (end !== -1) { i = end + 1; continue; } // keep ANSI active but don't count
    }
    skipped++;
    i++;
  }

  const suffix = baseLine.slice(i);
  return prefix + boxLine + suffix;
}

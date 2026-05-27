/**
 * Two-pane TUI overlay for the skill browser.
 *
 * Left pane:  ★ Top 10 → 📌 Bookmarks → 💡 Suggested → [Categories...]
 * Right pane: Skill list (each row = name + inline short summary + indicators)
 *             + boxed DETAILS window at the bottom with the full description.
 *
 * Each list row:
 *     ► skill-name              ┊ first-sentence summary…              ★N 📌
 *       └─ name col (fixed) ──┘ └─ short-summary col (flex) ─┘ └─ indicators ─┘
 *
 * Detail window (rendered as a ┌─┐ box below the list):
 *     ┌─ DETAILS: skill-name ─────────────────────────┐
 *     │ category: X · used N× · last: 2d ago          │
 *     │ <full description wrapped to width>           │
 *     └───────────────────────────────────────────────┘
 *
 * Keys:
 *   Tab / ← →   switch focus between panes
 *   ↑ ↓         navigate within focused pane
 *   Enter        queue selected skill
 *   Ctrl+B       toggle bookmark on highlighted skill
 *   /            start search
 *   Esc          close (or exit search)
 *   Backspace    delete search char
 */

import { matchesKey } from "@mariozechner/pi-tui";
import type { Skill } from "./scan.ts";
import { CATEGORIES, type CategoryDef } from "./categories.ts";
import {
  getUsageData,
  topSkills,
  getBookmarks,
  toggleBookmark,
  isBookmarked,
  getDailySuggestions,
  frecencyScore,
  type SuggestionPick,
} from "./state.ts";

// ═══════════════════════════════════════════════════════════════════════════
// ANSI Helpers
// ═══════════════════════════════════════════════════════════════════════════

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const fg = (code: string, text: string) => (code ? `${ESC}${code}m${text}${RESET}` : text);
const bold = (s: string) => `${ESC}1m${s}${ESC}22m`;
const dim = (s: string) => `${ESC}2m${s}${RESET}`;
const italic = (s: string) => `${ESC}3m${s}${ESC}23m`;
const reverse = (s: string) => `${ESC}7m${s}${RESET}`;
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
const visLen = (s: string) => stripAnsi(s).length;
const pad = (s: string, len: number) => s + " ".repeat(Math.max(0, len - visLen(s)));
const truncate = (s: string, max: number) => {
  const raw = stripAnsi(s);
  if (raw.length <= max) return s;
  // Naive truncation — works for non-nested ANSI
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
// Section definitions
// ═══════════════════════════════════════════════════════════════════════════

interface Section {
  type: "top10" | "bookmarks" | "suggested" | "category";
  label: string;
  icon: string;
  ansi: string;
  skills: Skill[];        // populated for top10, bookmarks, category
  suggestions?: SuggestionPick[]; // only for suggested
  count: number;
}

export type OverlayResult = {
  skill: Skill | null;
  action: "select" | "cancel";
  bookmarkToggled?: string;
};

export class SkillDeckOverlay {
  // Layout
  private focusPane: "left" | "right" = "left";
  private leftIdx = 0;
  private rightIdx = 0;
  private rightScroll = 0;
  private query = "";
  private isSearching = false;

  // Data
  private sections: Section[] = [];
  private allSkills: Skill[];
  private usage = getUsageData();
  private inactivityTimeout: ReturnType<typeof setTimeout> | null = null;
  private requestRender: (() => void) | null = null;

  private static readonly INACTIVITY_MS = 120_000;

  constructor(
    skills: Skill[],
    private done: (result: OverlayResult) => void
  ) {
    this.allSkills = skills;
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

    // ★ Top 10
    const top = topSkills(this.allSkills, 10);
    if (top.length > 0) {
      sections.push({
        type: "top10", label: "★ TOP 10", icon: "★", ansi: "33",
        skills: top, count: top.length,
      });
    }

    // 📌 Bookmarks
    const bmSkills = bookmarkNames
      .map((n) => this.allSkills.find((s) => s.name === n))
      .filter(Boolean) as Skill[];
    sections.push({
      type: "bookmarks", label: "📌 BOOKMARKS", icon: "📌", ansi: "36",
      skills: bmSkills, count: bmSkills.length,
    });

    // 💡 Suggested today
    if (suggestions.length > 0) {
      const sugSkills = suggestions
        .map((p) => this.allSkills.find((s) => s.name === p.name))
        .filter(Boolean) as Skill[];
      sections.push({
        type: "suggested", label: "💡 SUGGESTED", icon: "💡", ansi: "35",
        skills: sugSkills, suggestions, count: sugSkills.length,
      });
    }

    // Categories
    const byCat = new Map<string, Skill[]>();
    for (const s of this.allSkills) {
      const arr = byCat.get(s.category) || [];
      arr.push(s);
      byCat.set(s.category, arr);
    }

    const sortedCats = [...byCat.entries()].sort((a, b) => {
      const ao = CATEGORIES[a[0]]?.sortOrder ?? 99;
      const bo = CATEGORIES[b[0]]?.sortOrder ?? 99;
      return ao - bo;
    });

    for (const [cat, skills] of sortedCats) {
      const def = CATEGORIES[cat] || CATEGORIES["Other"];
      // Sort skills within category by frecency descending
      skills.sort((a, b) => frecencyScore(this.usage[b.name]) - frecencyScore(this.usage[a.name]));
      sections.push({
        type: "category", label: cat, icon: def.icon, ansi: def.ansi,
        skills, count: skills.length,
      });
    }

    this.sections = sections;
  }

  private activeSection(): Section {
    return this.sections[this.leftIdx] || this.sections[0];
  }

  private activeSkills(): Skill[] {
    const sec = this.activeSection();
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
    const w = Math.min(100, width - 2);
    const h = Math.max(20, termHeight - 4);
    const leftW = Math.min(24, Math.floor(w * 0.3));
    const rightW = w - leftW - 1; // -1 for separator
    const innerH = h - 3; // header + footer + separator line

    const lines: string[] = [];
    const total = this.allSkills.length;

    // ── Header ──
    const headerText = ` /skills ─── ${total} skills `;
    const headerPad = w - visLen(headerText) - 2;
    lines.push(
      dim("┌") +
      dim("─") + fg("36", "/skills") + dim(` ─── ${total} skills `) +
      dim("─".repeat(Math.max(0, headerPad - 16))) +
      dim("┐")
    );

    // Search bar (if active)
    if (this.isSearching) {
      const searchLine = dim("│") + " Search: " + fg("33", this.query) + fg("33", "▌") +
        " ".repeat(Math.max(0, w - visLen(" Search: " + this.query + "▌") - 2)) + dim("│");
      lines.push(searchLine);
    }

    // ── Build left + right columns ──
    const leftLines = this.renderLeftPane(leftW, innerH);
    const rightLines = this.renderRightPane(rightW, innerH);

    const bodyH = Math.max(leftLines.length, rightLines.length, innerH);
    for (let i = 0; i < bodyH; i++) {
      const l = i < leftLines.length ? leftLines[i] : pad("", leftW);
      const r = i < rightLines.length ? rightLines[i] : pad("", rightW);
      lines.push(dim("│") + pad(l, leftW) + dim("│") + pad(r, rightW) + dim("│"));
    }

    // ── Footer ──
    const hints =
      dim("tab") + " panes · " +
      dim("↑↓") + " navigate · " +
      dim("↵") + " queue · " +
      dim("ctrl+b") + " bookmark · " +
      dim("/") + " search · " +
      dim("esc") + " close";
    const footerInner = " " + hints;
    lines.push(
      dim("└") + truncate(footerInner, w - 2) +
      " ".repeat(Math.max(0, w - 2 - visLen(footerInner))) +
      dim("┘")
    );

    return lines;
  }

  private renderLeftPane(w: number, maxH: number): string[] {
    const lines: string[] = [];
    const focused = this.focusPane === "left";

    for (let i = 0; i < this.sections.length && lines.length < maxH; i++) {
      const sec = this.sections[i];
      const isActive = i === this.leftIdx;
      const countStr = ` ${sec.count}`;

      let label = sec.type === "category"
        ? ` ${sec.icon} ${sec.label}`
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

      // Divider between pinned sections and categories
      if (sec.type === "suggested" || (sec.type === "bookmarks" && !this.sections[i + 1]?.suggestions)) {
        if (lines.length < maxH) lines.push(dim("─".repeat(w)));
      }
    }

    return lines;
  }

  private renderRightPane(w: number, maxH: number): string[] {
    const lines: string[] = [];
    const sec = this.activeSection();
    const skills = this.activeSkills();
    const focused = this.focusPane === "right";
    const usage = this.usage;

    // Section header
    const headerLabel = sec.type === "category"
      ? `${sec.label} (${sec.count})`
      : `${sec.label}`;
    lines.push(" " + fg(sec.ansi, bold(headerLabel)));
    lines.push(dim(" " + "─".repeat(w - 2)));

    // How much space for skill list vs detail?
    // Bumped to 10 to host the boxed DETAILS window with a wrapped full description.
    // Falls back to 6 when the terminal is too short to host the larger window.
    const detailH = maxH >= 22 ? 10 : 6;
    const listH = maxH - lines.length - detailH - 1;

    // Ensure rightIdx is in bounds
    if (this.rightIdx >= skills.length) this.rightIdx = Math.max(0, skills.length - 1);

    // Scroll window
    if (this.rightIdx < this.rightScroll) this.rightScroll = this.rightIdx;
    if (this.rightIdx >= this.rightScroll + listH) this.rightScroll = this.rightIdx - listH + 1;

    // Render skill list — each row = marker + name col + summary col + indicators
    for (let i = this.rightScroll; i < skills.length && lines.length - 2 < listH; i++) {
      const s = skills[i];
      const isSelected = i === this.rightIdx && focused;
      const u = usage[s.name];
      const usageStr = u && u.count > 0 ? fg("33", `★${u.count}`) : "";
      const bmStr = isBookmarked(s.name) ? fg("36", " 📌") : "";
      const indicatorStr = bmStr + (usageStr ? " " + usageStr : "");
      const indicatorW = visLen(indicatorStr);

      // Column widths: marker (3) + name col + sep (3) + summary col + indicators + right margin (1)
      const markerW = 3;
      const sepW = 3; // " ┊ "
      const rightMargin = 1;
      // Name col gets up to 24 chars (or 40% of available row, whichever is smaller).
      const flexW = Math.max(0, w - markerW - sepW - indicatorW - rightMargin);
      const nameColW = Math.max(8, Math.min(24, Math.floor(flexW * 0.4)));
      const summaryColW = Math.max(0, flexW - nameColW);

      const name = truncate(s.name, nameColW);
      const summary = summaryColW > 8 ? shortSummary(s.description, summaryColW) : "";

      const marker = isSelected ? fg("36", " ► ") : "   ";
      const nameField = pad(name, nameColW);
      const sep = summaryColW > 8 ? dim(" ┊ ") : "   ";
      const summaryField = pad(dim(summary), summaryColW);

      // Assemble line: marker + name + sep + summary + gap + indicators (right-aligned)
      let line = marker + nameField + sep + summaryField;
      const gap = Math.max(1, w - visLen(line) - indicatorW - rightMargin);
      line += " ".repeat(gap) + indicatorStr;

      if (isSelected) {
        lines.push(fg("36", pad(line, w)));
      } else {
        lines.push(pad(line, w));
      }
    }

    // Padding between list and detail box
    while (lines.length < maxH - detailH) lines.push("");

    // ── DETAILS window (boxed) ──
    const selectedSkill = skills[this.rightIdx];
    const boxInnerW = w - 2; // -2 for left/right border chars

    if (selectedSkill) {
      // Header row: ┌─ DETAILS: <name> ─────────┐
      const headerLabel = ` DETAILS: ${selectedSkill.name} `;
      const headerLabelTrunc = truncate(headerLabel, Math.max(0, boxInnerW - 2));
      const headerFillW = Math.max(0, boxInnerW - visLen(headerLabelTrunc) - 1);
      lines.push(
        dim("┌─") + fg("36", bold(headerLabelTrunc)) + dim("─".repeat(headerFillW) + "┐")
      );

      const u = usage[selectedSkill.name];
      const usedStr = u && u.count > 0
        ? `used ${u.count}× · last: ${timeAgo(u.lastUsedAt)}`
        : "never used";
      const metaLine = `category: ${selectedSkill.category} · ${usedStr}`;
      lines.push(dim("│") + " " + dim(pad(truncate(metaLine, boxInnerW - 2), boxInnerW - 1)) + dim("│"));

      // Wrap the full description to fit inside the box.
      const descLines = wordWrap(selectedSkill.description, boxInnerW - 2);
      // Reserve: 1 for header + 1 for meta + 1 for footer.
      const bodyCap = Math.max(0, detailH - 3);
      for (let i = 0; i < Math.min(bodyCap, descLines.length); i++) {
        lines.push(dim("│") + " " + pad(descLines[i], boxInnerW - 1) + dim("│"));
      }
      // Pad body to fill detailH - 3 rows so the footer aligns.
      for (let i = descLines.length; i < bodyCap; i++) {
        lines.push(dim("│") + pad("", boxInnerW) + dim("│"));
      }
      lines.push(dim("└" + "─".repeat(boxInnerW) + "┘"));
    } else {
      lines.push(dim("┌" + "─".repeat(boxInnerW) + "┐"));
      lines.push(dim("│") + pad(" (no skill selected)", boxInnerW) + dim("│"));
      for (let i = 0; i < detailH - 3; i++) {
        lines.push(dim("│") + pad("", boxInnerW) + dim("│"));
      }
      lines.push(dim("└" + "─".repeat(boxInnerW) + "┘"));
    }

    return lines;
  }

  // ─── Input handling ────────────────────────────────────────────────

  handleInput(data: string): void {
    this.resetInactivity();

    // Search mode input
    if (this.isSearching) {
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
      // Printable char
      if (data.length === 1 && data.charCodeAt(0) >= 32) {
        this.query += data;
        this.rightIdx = 0;
        this.rightScroll = 0;
        this.requestRender?.();
        return;
      }
      return;
    }

    // Escape → close
    if (matchesKey(data, "escape")) {
      this.cleanup();
      this.done({ skill: null, action: "cancel" });
      return;
    }

    // / → enter search
    if (data === "/") {
      this.isSearching = true;
      this.query = "";
      this.requestRender?.();
      return;
    }

    // Tab / left / right → switch panes
    if (matchesKey(data, "tab") || matchesKey(data, "right") && this.focusPane === "left") {
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
      const skills = this.activeSkills();
      const s = skills[this.rightIdx];
      if (s) {
        const added = toggleBookmark(s.name);
        this.buildSections(); // rebuild to update bookmark section
        this.requestRender?.();
      }
      return;
    }

    // Enter → queue skill
    if (matchesKey(data, "return")) {
      if (this.focusPane === "left") {
        // Enter on left = focus right pane
        this.focusPane = "right";
        this.rightIdx = 0;
        this.rightScroll = 0;
        this.requestRender?.();
        return;
      }
      const skills = this.activeSkills();
      const s = skills[this.rightIdx];
      if (s) {
        this.cleanup();
        this.done({ skill: s, action: "select" });
      }
      return;
    }

    // ↑ ↓ navigation
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
        const skills = this.activeSkills();
        this.rightIdx = Math.min(skills.length - 1, this.rightIdx + 1);
      }
      this.requestRender?.();
      return;
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────

  private resetInactivity(): void {
    if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);
    this.inactivityTimeout = setTimeout(() => {
      this.cleanup();
      this.done({ skill: null, action: "cancel" });
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

/**
 * Derive a short, inline summary from a SKILL.md description.
 * Returns the first sentence (up to '.', '!' or '?') or first line, trimmed and
 * capped at maxLen with an ellipsis.
 */
function shortSummary(desc: string, maxLen: number): string {
  if (!desc) return "";
  const flat = desc.replace(/\s+/g, " ").trim();
  // Prefer first sentence boundary
  const sentenceMatch = flat.match(/^([^.!?]+[.!?])(\s|$)/);
  let s = sentenceMatch ? sentenceMatch[1].trim() : flat;
  // Drop trailing period for inline rendering
  s = s.replace(/[.!?]+$/, "");
  if (s.length > maxLen) {
    s = s.slice(0, Math.max(1, maxLen - 1)).replace(/\s+\S*$/, "") + "…";
  }
  return s;
}

function wordWrap(text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxW) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

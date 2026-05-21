/**
 * pi-skill-deck
 *
 * Two-pane categorized skill browser for Pi with bookmarks, frecency tracking,
 * and daily AI-free suggestions. Supersedes the flat alphabetical skill list.
 *
 * Commands:
 *   /skills   — open the two-pane browser overlay
 *
 * Shortcuts:
 *   Ctrl+B    — toggle bookmark on highlighted skill (inside overlay)
 *
 * State files (all in ~/.pi/agent/):
 *   skill-usage.json       — per-skill { count, lastUsedAt }
 *   skill-bookmarks.json   — [name, ...]
 *   skill-suggestion.json  — { date, picks: [{name, reason}, ...] }
 *
 * https://github.com/CymatiStatic/pi-skill-deck
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Container, Text } from "@mariozechner/pi-tui";
import * as fs from "node:fs";

import { loadAllSkills, getSkillContent, type Skill } from "./scan.ts";
import { recordUsage, topSkills, getBookmarks } from "./state.ts";
import { SkillDeckOverlay, type OverlayResult } from "./overlay.ts";

// ═══════════════════════════════════════════════════════════════════════════
// Shared state
// ═══════════════════════════════════════════════════════════════════════════

interface DeckState {
  queuedSkill: Skill | null;
}

const state: DeckState = {
  queuedSkill: null,
};

// ═══════════════════════════════════════════════════════════════════════════
// Extension entry point
// ═══════════════════════════════════════════════════════════════════════════

export default function piSkillDeck(pi: ExtensionAPI): void {

  // ── Session start: show compact summary instead of the wall ──
  pi.on("session_start", async (_event, ctx) => {
    const skills = loadAllSkills();
    const top = topSkills(skills, 5);
    const bm = getBookmarks();

    const topStr = top.length > 0
      ? top.map((s) => s.name).join(" · ")
      : "(no usage yet)";
    const bmStr = bm.length > 0
      ? bm.slice(0, 5).join(" · ") + (bm.length > 5 ? ` +${bm.length - 5}` : "")
      : "(none)";

    ctx.ui.notify(
      `🎴 Skill Deck: ${skills.length} skills loaded\n` +
      `★ Top: ${topStr}\n` +
      `📌 Bookmarked: ${bmStr}\n` +
      `Type /skills to browse`,
      "info"
    );
  });

  // ── Register /skills command ──
  pi.registerCommand("skills", {
    description: "Open the categorized skill browser (two-pane deck with bookmarks + suggestions)",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const skills = loadAllSkills();

      if (skills.length === 0) {
        ctx.ui.setStatus("skill-deck", "No skills found");
        setTimeout(() => ctx.ui.setStatus("skill-deck", undefined), 3000);
        return;
      }

      // Show overlay
      const result = await ctx.ui.custom<OverlayResult>(
        (tui, _theme, _keybindings, done) => {
          const overlay = new SkillDeckOverlay(skills, done);
          overlay.setRequestRender(() => tui.requestRender());
          return overlay;
        },
        { overlay: true }
      );

      if (result.action === "select" && result.skill) {
        state.queuedSkill = result.skill;
        recordUsage(result.skill.name);

        ctx.ui.setStatus("skill-deck", `🎴 ${result.skill.name}`);
        ctx.ui.setWidget("skill-deck", [
          `\x1b[2m🎴 Skill: \x1b[0m\x1b[36m${result.skill.name}\x1b[0m\x1b[2m — will be applied to next message\x1b[0m`,
        ]);
        ctx.ui.notify(`Skill queued: ${result.skill.name}`, "info");
      }
    },
  });

  // ── Register /skill-deck alias (duplicates handler to avoid API dep) ──
  pi.registerCommand("skill-deck", {
    description: "Alias for /skills — open the categorized skill browser",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const skills = loadAllSkills();
      if (skills.length === 0) {
        ctx.ui.setStatus("skill-deck", "No skills found");
        setTimeout(() => ctx.ui.setStatus("skill-deck", undefined), 3000);
        return;
      }
      const result = await ctx.ui.custom<OverlayResult>(
        (tui, _theme, _keybindings, done) => {
          const overlay = new SkillDeckOverlay(skills, done);
          overlay.setRequestRender(() => tui.requestRender());
          return overlay;
        },
        { overlay: true }
      );
      if (result.action === "select" && result.skill) {
        state.queuedSkill = result.skill;
        recordUsage(result.skill.name);
        ctx.ui.setStatus("skill-deck", `🎴 ${result.skill.name}`);
        ctx.ui.setWidget("skill-deck", [
          `\x1b[2m🎴 Skill: \x1b[0m\x1b[36m${result.skill.name}\x1b[0m\x1b[2m — will be applied to next message\x1b[0m`,
        ]);
        ctx.ui.notify(`Skill queued: ${result.skill.name}`, "info");
      }
    },
  });

  // ── Inject queued skill before agent starts ──
  pi.on("before_agent_start", async (_event, ctx) => {
    if (!state.queuedSkill) return {};

    const skill = state.queuedSkill;
    state.queuedSkill = null;

    ctx.ui?.setStatus("skill-deck", undefined);
    ctx.ui?.setWidget("skill-deck", undefined);

    try {
      const content = getSkillContent(skill);
      return {
        message: {
          customType: "skill-deck-context",
          content: `<skill name="${skill.name}">\n${content}\n</skill>`,
          display: true,
        },
      };
    } catch {
      ctx.ui?.notify(`Failed to load skill: ${skill.name}`, "warning");
      return {};
    }
  });

  // ── Register custom message renderer for skill-deck-context ──
  pi.registerMessageRenderer("skill-deck-context", (message, _options, theme) => {
    const rawContent = typeof message.content === "string"
      ? message.content
      : Array.isArray(message.content)
        ? message.content.map((c: { type: string; text?: string }) => c.type === "text" ? c.text || "" : "").join("")
        : "";

    const nameMatch = rawContent.match(/<skill name="([^"]+)">/);
    const skillName = nameMatch?.[1] || "Unknown Skill";

    const container = new Container();
    container.addChild(
      new Text(
        theme.fg("accent", "🎴 ") +
        theme.fg("customMessageLabel", theme.bold("Skill: ")) +
        theme.fg("accent", skillName),
        1, 0
      )
    );

    const contentMatch = rawContent.match(/<skill[^>]*>\n?([\s\S]*?)\n?<\/skill>/);
    const body = contentMatch?.[1]?.trim() || "";
    const lines = body.split("\n");
    const preview = lines.slice(0, 6).join("\n");
    container.addChild(new Text(theme.fg("muted", preview), 1, 0));

    if (lines.length > 6) {
      container.addChild(
        new Text(theme.fg("muted", `... ${lines.length - 6} more lines`), 1, 0)
      );
    }

    return container;
  });
}

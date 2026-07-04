/**
 * pi-skill-manager
 *
 * Skill enable/disable manager for Pi with category toggling, custom skill
 * paths, per-session overrides, bookmarks, frecency tracking, and 8 group-by
 * modes.
 *
 * Commands:
 *   /skill-manager  — open the two-pane browser overlay
 *
 * Config file (~/.pi/agent/skill-manager-config.json):
 *   {
 *     "enabledCategories": ["Design & UI"],  // empty = all disabled
 *     "customSkills": [                       // custom skill paths
 *       {
 *         "path": "/abs/or/rel/path",
 *         "name": "optional-name-override",
 *         "parentDir": "marketing",
 *         "fileName": "deploy.md"            // defaults to SKILL.md
 *       }
 *     ]
 *   }
 *
 * State files (all in ~/.pi/agent/):
 *   skill-manager-config.json  — global config
 *   skill-usage.json           — per-skill { count, lastUsedAt }
 *   skill-bookmarks.json       — [name, ...]
 *   skill-suggestion.json      — { date, picks: [{name, reason}, ...] }
 *   skill-deck-prefs.json      — UI preferences
 *
 * https://github.com/SkyNotion/pi-skill-manager
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Container, Text } from "@mariozechner/pi-tui";

import {
  loadAllSkills,
  loadCustomSkills,
  getSkillContent,
  type Skill,
} from "./scan.ts";
import { recordUsage, topSkills, getBookmarks } from "./state.ts";
import { SkillDeckOverlay, type OverlayResult } from "./overlay.ts";
import {
  loadConfig,
  getEffectiveCategories,
  isCategoryEnabled,
  type SkillManagerConfig,
} from "./config.ts";
import {
  getSessionOverride,
  OVERRIDE_ENTRY_TYPE,
} from "./session.ts";

// ═══════════════════════════════════════════════════════════════════════════
// Shared state
// ═══════════════════════════════════════════════════════════════════════════

interface ManagerState {
  queuedSkill: Skill | null;
  config: SkillManagerConfig;
  /** Per-session override or null (use global default). */
  sessionCategories: string[] | null;
  /** Cached custom skills (rebuilt on config change). */
  customSkills: Skill[];
}

const state: ManagerState = {
  queuedSkill: null,
  config: { enabledCategories: [] },
  sessionCategories: null,
  customSkills: [],
};

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the effective enabled-categories list:
 *   session override → global config → null (all enabled)
 */
function getActiveCategories(): string[] | null {
  return getEffectiveCategories(state.config, state.sessionCategories);
}

/** Reload global config and custom skills. */
function reloadConfig(): void {
  state.config = loadConfig();
  if (state.config.customSkills && state.config.customSkills.length > 0) {
    state.customSkills = loadCustomSkills(state.config.customSkills);
  } else {
    state.customSkills = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Extension entry point
// ═══════════════════════════════════════════════════════════════════════════

export default function piSkillManager(pi: ExtensionAPI): void {

  // ── Session start: load config + session override ──
  pi.on("session_start", async (_event, ctx) => {
    // Load global config
    reloadConfig();

    // Read per-session override
    state.sessionCategories = getSessionOverride(ctx);

    // Load all discovered + custom skills for display
    const allSkills = loadAllSkills();
    const total = allSkills.length + state.customSkills.length;
    const enabled = getActiveCategories();
    const enabledCount = enabled === null
      ? total
      : allSkills.filter((s) => enabled.includes(s.category)).length
        + state.customSkills.filter((s) => enabled.includes(s.category)).length;

    const top = topSkills(allSkills, 5);
    const bm = getBookmarks();

    const topStr = top.length > 0
      ? top.map((s) => s.name).join(" · ")
      : "(no usage yet)";
    const bmStr = bm.length > 0
      ? bm.slice(0, 5).join(" · ") + (bm.length > 5 ? ` +${bm.length - 5}` : "")
      : "(none)";

    ctx.ui.notify(
      `🎴 Skill Manager: ${total} skills (${enabledCount} enabled)\n` +
      `★ Top: ${topStr}\n` +
      `📌 Bookmarked: ${bmStr}\n` +
      `Type /skill-manager to browse`,
      "info"
    );
  });

  // ── Register /skill-manager command (primary) ──
  pi.registerCommand("skill-manager", {
    description: "Open the skill manager browser (category toggling, custom skills, per-session overrides)",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const allSkills = loadAllSkills();
      // Merge custom skills into the list for the overlay
      const mergedSkills = [...allSkills, ...state.customSkills];

      if (mergedSkills.length === 0) {
        ctx.ui.setStatus("skill-manager", "No skills found");
        setTimeout(() => ctx.ui.setStatus("skill-manager", undefined), 3000);
        return;
      }

      // Pass current effective categories so the overlay can show enabled/disabled
      const effectiveCategories = getActiveCategories();

      // Show overlay
      const result = await ctx.ui.custom<OverlayResult>(
        (tui, _theme, _keybindings, done) => {
          const overlay = new SkillDeckOverlay(mergedSkills, done, effectiveCategories);
          overlay.setRequestRender(() => tui.requestRender());
          return overlay;
        },
        {
          overlay: true,
          overlayOptions: {
            width: "95%",
            maxHeight: "85%",
            anchor: "center" as const,
          },
        }
      );

      // Handle skill selection
      if (result.action === "select" && result.skill) {
        state.queuedSkill = result.skill;
        recordUsage(result.skill.name);

        ctx.ui.setStatus("skill-manager", `🎴 ${result.skill.name}`);
        ctx.ui.setWidget("skill-manager", [
          `\x1b[2m🎴 Skill: \x1b[0m\x1b[36m${result.skill.name}\x1b[0m\x1b[2m — will be applied to next message\x1b[0m`,
        ]);
        ctx.ui.notify(`Skill queued: ${result.skill.name}`, "info");
      }

      // On cancel, check if categories were toggled and persist if changed
      if (result.action === "cancel" && result.enabledCategories !== undefined) {
        const prev = getActiveCategories();
        const next = result.enabledCategories;
        // Check if they actually changed
        const changed =
          JSON.stringify(prev) !== JSON.stringify(next);
        if (changed) {
          state.sessionCategories = next;
          pi.appendEntry(OVERRIDE_ENTRY_TYPE, { enabledCategories: next });
        }
      }
    },
  });

  // ── Register /skills alias for backward compatibility ──
  pi.registerCommand("skills", {
    description: "Alias for /skill-manager — open the skill manager browser",
    handler: async (_args: string, ctx: ExtensionContext) => {
      // Forward to the skill-manager handler by calling it directly
      const allSkills = loadAllSkills();
      const mergedSkills = [...allSkills, ...state.customSkills];

      if (mergedSkills.length === 0) {
        ctx.ui.setStatus("skill-manager", "No skills found");
        setTimeout(() => ctx.ui.setStatus("skill-manager", undefined), 3000);
        return;
      }

      const effectiveCategories = getActiveCategories();

      const result = await ctx.ui.custom<OverlayResult>(
        (tui, _theme, _keybindings, done) => {
          const overlay = new SkillDeckOverlay(mergedSkills, done, effectiveCategories);
          overlay.setRequestRender(() => tui.requestRender());
          return overlay;
        },
        {
          overlay: true,
          overlayOptions: {
            width: "95%",
            maxHeight: "85%",
            anchor: "center" as const,
          },
        }
      );

      // Handle skill selection
      if (result.action === "select" && result.skill) {
        state.queuedSkill = result.skill;
        recordUsage(result.skill.name);
        ctx.ui.setStatus("skill-manager", `🎴 ${result.skill.name}`);
        ctx.ui.setWidget("skill-manager", [
          `\x1b[2m🎴 Skill: \x1b[0m\x1b[36m${result.skill.name}\x1b[0m\x1b[2m — will be applied to next message\x1b[0m`,
        ]);
        ctx.ui.notify(`Skill queued: ${result.skill.name}`, "info");
      }

      // On cancel, persist category changes if any
      if (result.action === "cancel" && result.enabledCategories !== undefined) {
        const prev = getActiveCategories();
        const next = result.enabledCategories;
        const changed =
          JSON.stringify(prev) !== JSON.stringify(next);
        if (changed) {
          state.sessionCategories = next;
          pi.appendEntry(OVERRIDE_ENTRY_TYPE, { enabledCategories: next });
        }
      }
    },
  });

  // ── Filter system prompt + handle queued skill before agent starts ──
  pi.on("before_agent_start", async (event, ctx) => {
    // Clear stale widget/status
    ctx.ui?.setStatus("skill-manager", undefined);
    ctx.ui?.setWidget("skill-manager", undefined);

    const effectiveCategories = getActiveCategories();
    const hasCustomSkills = state.customSkills.length > 0;

    // Result to return (message + optional systemPrompt change)
    const result: {
      message?: { customType: string; content: string; display: boolean };
      systemPrompt?: string;
    } = {};

    // Part 1: Handle queued skill (from overlay selection)
    if (state.queuedSkill) {
      const skill = state.queuedSkill;
      state.queuedSkill = null;
      try {
        const content = getSkillContent(skill);
        result.message = {
          customType: "skill-manager-context",
          content: `<skill name="${skill.name}">\n${content}\n</skill>`,
          display: true,
        };
      } catch {
        ctx.ui?.notify(`Failed to load skill: ${skill.name}`, "warning");
      }
    }

    // Part 2: Filter system prompt to only include enabled skills
    // (always apply filtering, regardless of queued skill)
    if (effectiveCategories === null && !hasCustomSkills) {
      // null = all enabled, no custom skills — nothing to do
      return result.message ? result : {};
    }

    let modifiedPrompt = event.systemPrompt;

    // Build a name→category map from all discovered skills + custom skills
    const allLoaded = [...loadAllSkills(), ...state.customSkills];
    const nameToCategory = new Map<string, string>();
    for (const s of allLoaded) {
      nameToCategory.set(s.name, s.category);
    }

    // ── Filter Pi's native skills from the system prompt ──
    if (effectiveCategories !== null) {
      modifiedPrompt = modifiedPrompt.replace(
        /<skill\s+name="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/skill>/gi,
        (match, skillName: string) => {
          const cat = nameToCategory.get(skillName);
          // If we don't know the category, keep it (conservative)
          if (!cat) return match;
          if (isCategoryEnabled(cat, effectiveCategories)) return match;
          return ""; // remove disabled skill
        },
      );
      // Clean up empty lines left by removals
      modifiedPrompt = modifiedPrompt.replace(/\n{3,}/g, "\n\n");
    }

    // ── Inject custom skills into the skills block ──
    if (hasCustomSkills) {
      const injectable = effectiveCategories === null
        ? state.customSkills
        : state.customSkills.filter((s) =>
            isCategoryEnabled(s.category, effectiveCategories)
          );

      if (injectable.length > 0) {
        const skillXmlBlock = injectable
          .map((s) => `  <skill name="${s.name}">${s.description}</skill>`)
          .join("\n");

        // Try to inject into an existing <skills> block first
        const skillsTagMatch = modifiedPrompt.match(/<skills>[\s\S]*?<\/skills>/i);
        if (skillsTagMatch) {
          const original = skillsTagMatch[0];
          const updated = original.replace(
            /<\/skills>/i,
            `\n${skillXmlBlock}\n</skills>`,
          );
          modifiedPrompt = modifiedPrompt.replace(original, updated);
        } else {
          // No <skills> block exists (e.g. Pi found zero native skills) —
          // create one and append near the end of the system prompt.
          const block = `<skills>\n${skillXmlBlock}\n</skills>`;
          // Append before the final closing if there's a structure, otherwise at the end
          modifiedPrompt = modifiedPrompt.replace(/\n*$/,
            `\n\n${block}`);
        }
      }
    }

    if (modifiedPrompt !== event.systemPrompt) {
      result.systemPrompt = modifiedPrompt;
    }

    return result;
  });

  // ── Register custom message renderer for skill-manager-context ──
  pi.registerMessageRenderer("skill-manager-context", (message, _options, theme) => {
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

  // Also register the old renderer name for backward compat
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

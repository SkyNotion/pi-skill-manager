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
import { topSkills } from "./state.ts";
import { SkillDeckOverlay, type OverlayResult } from "./overlay.ts";
import {
  loadConfig,
  getEffectiveCategories,
  isCategoryEnabled,
  type SkillManagerConfig,
} from "./config.ts";
import {
  getSessionOverride,
  getSessionSkillsOverride,
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
  /** Per-session individual skill overrides. */
  sessionSkills: string[];
  /** Cached custom skills (rebuilt on config change). */
  customSkills: Skill[];
}

const state: ManagerState = {
  queuedSkill: null,
  config: { enabledCategories: [] },
  sessionCategories: null,
  sessionSkills: [],
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

/**
 * Compute the effective individually-enabled skills:
 *   session override → config.enabledSkills → []
 */
function getActiveSkills(): string[] {
  return state.sessionSkills.length > 0
    ? state.sessionSkills
    : state.config.enabledSkills ?? [];
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

    // Read per-session overrides
    state.sessionCategories = getSessionOverride(ctx);
    state.sessionSkills = getSessionSkillsOverride(ctx);

    // Load all discovered + custom skills for display
    const allSkills = loadAllSkills();
    const total = allSkills.length + state.customSkills.length;
    const enabled = getActiveCategories();
    const enabledCount = enabled === null
      ? total
      : allSkills.filter((s) => enabled.includes(s.category)).length
        + state.customSkills.filter((s) => enabled.includes(s.category)).length;

    const top = topSkills(allSkills, 5);
    const topStr = top.length > 0
      ? top.map((s) => s.name).join(" · ")
      : "(no usage yet)";
    const enabledSkills = getActiveSkills();
    const skillStr = enabledSkills.length > 0
      ? `📌 ${enabledSkills.slice(0, 5).join(" · ")}${enabledSkills.length > 5 ? ` +${enabledSkills.length - 5}` : ""}`
      : "(none individually selected)";

    ctx.ui.notify(
      `🎴 Skill Manager: ${total} skills (${enabledCount} enabled)\n` +
      `★ Top: ${topStr}\n` +
      `📌 Selected: ${skillStr}\n` +
      `Type /skill-manager to browse`,
      "info"
    );
  });

  // ── Register /skill-manager command (primary) ──
  pi.registerCommand("skill-manager", {
    description: "Open the skill manager browser (category toggling, individual skill selection, custom skills, per-session overrides)",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const allSkills = loadAllSkills();
      // Merge custom skills into the list for the overlay
      const mergedSkills = [...allSkills, ...state.customSkills];

      if (mergedSkills.length === 0) {
        ctx.ui.setStatus("skill-manager", "No skills found");
        setTimeout(() => ctx.ui.setStatus("skill-manager", undefined), 3000);
        return;
      }

      // Pass current effective categories and skills so the overlay can show enabled/disabled
      const effectiveCategories = getActiveCategories();
      const effectiveSkills = getActiveSkills();

      // Show overlay
      const result = await ctx.ui.custom<OverlayResult>(
        (tui, _theme, _keybindings, done) => {
          const overlay = new SkillDeckOverlay(mergedSkills, done, effectiveCategories, effectiveSkills);
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

      // On cancel, persist toggles if changed
      if (result.action === "cancel") {
        let changed = false;

        if (result.enabledCategories !== undefined) {
          const prev = getActiveCategories();
          if (JSON.stringify(prev) !== JSON.stringify(result.enabledCategories)) {
            state.sessionCategories = result.enabledCategories;
            changed = true;
          }
        }

        if (result.enabledSkills !== undefined) {
          const prev = getActiveSkills();
          if (JSON.stringify(prev) !== JSON.stringify(result.enabledSkills)) {
            state.sessionSkills = result.enabledSkills;
            changed = true;
          }
        }

        if (changed) {
          pi.appendEntry(OVERRIDE_ENTRY_TYPE, {
            enabledCategories: state.sessionCategories,
            enabledSkills: state.sessionSkills,
          });
        }
      }
    },
  });

  // ── Register /skills alias for backward compatibility ──
  pi.registerCommand("skills", {
    description: "Alias for /skill-manager — open the skill manager browser",
    handler: async (_args: string, ctx: ExtensionContext) => {
      const allSkills = loadAllSkills();
      const mergedSkills = [...allSkills, ...state.customSkills];

      if (mergedSkills.length === 0) {
        ctx.ui.setStatus("skill-manager", "No skills found");
        setTimeout(() => ctx.ui.setStatus("skill-manager", undefined), 3000);
        return;
      }

      const effectiveCategories = getActiveCategories();
      const effectiveSkills = getActiveSkills();

      const result = await ctx.ui.custom<OverlayResult>(
        (tui, _theme, _keybindings, done) => {
          const overlay = new SkillDeckOverlay(mergedSkills, done, effectiveCategories, effectiveSkills);
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

      // On cancel, persist toggles if changed
      if (result.action === "cancel") {
        let changed = false;

        if (result.enabledCategories !== undefined) {
          const prev = getActiveCategories();
          if (JSON.stringify(prev) !== JSON.stringify(result.enabledCategories)) {
            state.sessionCategories = result.enabledCategories;
            changed = true;
          }
        }

        if (result.enabledSkills !== undefined) {
          const prev = getActiveSkills();
          if (JSON.stringify(prev) !== JSON.stringify(result.enabledSkills)) {
            state.sessionSkills = result.enabledSkills;
            changed = true;
          }
        }

        if (changed) {
          pi.appendEntry(OVERRIDE_ENTRY_TYPE, {
            enabledCategories: state.sessionCategories,
            enabledSkills: state.sessionSkills,
          });
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
    const effectiveSkills = getActiveSkills();
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
    if (effectiveCategories === null && effectiveSkills.length === 0 && !hasCustomSkills) {
      // null = all enabled, no individually-enabled skills, no custom skills — nothing to do
      return result.message ? result : {};
    }

    let modifiedPrompt = event.systemPrompt;

    // Build a name→category map from all discovered skills + custom skills
    const allLoaded = [...loadAllSkills(), ...state.customSkills];
    const nameToCategory = new Map<string, string>();
    for (const s of allLoaded) {
      nameToCategory.set(s.name, s.category);
    }

    // ── Filter skills from the system prompt ──
    // Note: Pi puts extension-provided skills in <available_skills> using
    // the format <skill><name>...</name><description>...</description></skill>.
    // Our custom skills are injected as additional <skill> entries in the
    // same block. The filter below targets only inline <skill name="...">
    // entries (which we injected ourselves in previous turns) and leaves
    // Pi's native sub-element format untouched.
    if (effectiveCategories !== null || effectiveSkills.length > 0) {
      modifiedPrompt = modifiedPrompt.replace(
        /<skill\s+name="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/skill>/gi,
        (match, skillName: string) => {
          const cat = nameToCategory.get(skillName);
          // If we don't know the category, keep it (conservative)
          if (!cat) return match;
          // Keep if category is enabled OR skill is individually enabled
          if (isCategoryEnabled(cat, effectiveCategories)) return match;
          if (effectiveSkills.includes(skillName)) return match;
          return ""; // remove disabled skill
        },
      );
      // Clean up empty lines left by removals
      modifiedPrompt = modifiedPrompt.replace(/\n{3,}/g, "\n\n");
    }

    // ── Inject custom skills into <available_skills> block ──
    if (hasCustomSkills) {
      // Include custom skills whose category is enabled OR whose name is individually selected
      const injectable = effectiveCategories === null && effectiveSkills.length === 0
        ? state.customSkills
        : state.customSkills.filter((s) =>
            isCategoryEnabled(s.category, effectiveCategories) ||
            effectiveSkills.includes(s.name)
          );

      if (injectable.length > 0) {
        // Use the same sub-element format Pi uses:
        //   <skill>
        //     <name>xxx</name>
        //     <description>xxx</description>
        //   </skill>
        const skillXmlBlock = injectable
          .map((s) =>
            `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n    <location>${s.filePath}</location>\n  </skill>`
          )
          .join("\n");

        // Find existing <available_skills> block added by Pi
        const availMatch = modifiedPrompt.match(/<available_skills>[\s\S]*?<\/available_skills>/i);
        if (availMatch) {
          const original = availMatch[0];
          const updated = original.replace(
            /<\/available_skills>/i,
            `\n${skillXmlBlock}\n</available_skills>`,
          );
          modifiedPrompt = modifiedPrompt.replace(original, updated);
        } else {
          // No <available_skills> block at all — create one before the final structure
          const block = `<available_skills>\n${skillXmlBlock}\n</available_skills>`;
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

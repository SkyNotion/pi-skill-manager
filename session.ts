/**
 * pi-skill-manager — per-session category and skill override.
 *
 * Stores the per-session override inside the session itself via
 * pi.appendEntry(). This means:
 *   - Survives /resume (tied to the session file)
 *   - Cleared on /new (fresh session, no entries)
 *   - Independent of the global config file
 *
 * Entry customType: "skill-manager-override"
 * Entry data shape: { enabledCategories: string[] | null, enabledSkills: string[] }
 *   enabledCategories: null = fall back to global config, [] = all disabled
 *   enabledSkills: skill names always included regardless of category
 */

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

export const OVERRIDE_ENTRY_TYPE = "skill-manager-override" as const;

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionOverrideData {
  enabledCategories: string[] | null; // null = use global default
  enabledSkills?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Read override from session
// ═══════════════════════════════════════════════════════════════════════════

function findOverrideEntry(ctx: ExtensionContext): SessionOverrideData | null {
  try {
    for (const entry of ctx.sessionManager.getEntries()) {
      if (
        entry.type === "custom" &&
        (entry as { customType?: string }).customType === OVERRIDE_ENTRY_TYPE
      ) {
        return ((entry as { data?: SessionOverrideData }).data) ?? null;
      }
    }
  } catch {
    // sessionManager may not be available in all contexts
  }
  return null;
}

/**
 * Read the per-session category override.
 * Returns null if no override is set (means "use global default").
 */
export function getSessionOverride(
  ctx: ExtensionContext,
): string[] | null {
  const data = findOverrideEntry(ctx);
  if (!data) return null;
  if (data.enabledCategories === null) return null; // explicitly null = use global
  if (Array.isArray(data.enabledCategories)) return data.enabledCategories;
  return null;
}

/**
 * Read the per-session individual skill override.
 * Returns empty array if no override is set.
 */
export function getSessionSkillsOverride(
  ctx: ExtensionContext,
): string[] {
  const data = findOverrideEntry(ctx);
  return data?.enabledSkills ?? [];
}

/**
 * pi-skill-manager — per-session category override.
 *
 * Stores the per-session enabled-categories override inside the session
 * itself via pi.appendEntry(). This means:
 *   - Survives /resume (tied to the session file)
 *   - Cleared on /new (fresh session, no entries)
 *   - Independent of the global config file
 *
 * Entry customType: "skill-manager-override"
 * Entry data shape: { enabledCategories: string[] | null }
 *   null = fall back to global config default
 *   []   = all disabled
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
}

// ═══════════════════════════════════════════════════════════════════════════
// Read override from session
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Read the per-session category override from the session's appendEntry data.
 * Returns null if no override is set (means "use global default").
 */
export function getSessionOverride(
  ctx: ExtensionContext,
): string[] | null {
  try {
    for (const entry of ctx.sessionManager.getEntries()) {
      if (
        entry.type === "custom" &&
        (entry as { customType?: string }).customType === OVERRIDE_ENTRY_TYPE
      ) {
        const data = (entry as { data?: SessionOverrideData }).data;
        if (data && Array.isArray(data.enabledCategories)) {
          return data.enabledCategories;
        }
        // null explicitly stored = fall through to global
        if (data && data.enabledCategories === null) return null;
      }
    }
  } catch {
    // sessionManager may not be available in all contexts
  }
  return null; // no override → use global default
}

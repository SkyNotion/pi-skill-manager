/**
 * pi-skill-manager — global config file.
 *
 * Reads/writes ~/.pi/agent/skill-manager-config.json
 *
 * Config schema:
 * {
 *   "enabledCategories": ["Design & UI", ...],   // empty = all disabled, absent = all enabled
 *   "customSkills": [
 *     {
 *       "path": "/abs/path/to/skill/dir",
 *       "name": "optional-override",              // overrides YAML frontmatter name
 *       "parentDir": "marketing",                 // for category detection
 *       "fileName": "deploy.md"                   // defaults to "SKILL.md"
 *     }
 *   ]
 * }
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface CustomSkillEntry {
  /** Absolute or relative (to cwd) path to the directory containing the skill file. */
  path: string;
  /** Optional — overrides the name from YAML frontmatter. */
  name?: string;
  /** Directory name used for category detection (e.g. "marketing" → Marketing & GTM). */
  parentDir?: string;
  /** Filename to read. Defaults to "SKILL.md" (ignored when recurse=true). */
  fileName?: string;
  /**
   * Provider/label for grouping skills by source (e.g. "Anthropic", "Vercel", "Figma").
   * Shows up as the skill's framework in the overlay's "Framework" group-by mode.
   */
  provider?: string;
  /**
   * When true, recursively scan all subdirectories for SKILL.md files.
   * This is how you add entire skill collections from a single config entry.
   * name and fileName are ignored when recurse=true.
   */
  recurse?: boolean;
}

export interface SkillManagerConfig {
  /** Categories to enable. Empty = all disabled. Absent = all enabled (backward compat). */
  enabledCategories?: string[];
  /** Custom skill paths outside Pi's standard locations. */
  customSkills?: CustomSkillEntry[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Defaults & paths
// ═══════════════════════════════════════════════════════════════════════════

const STATE_DIR = path.join(os.homedir(), ".pi", "agent");
const CONFIG_FILE = path.join(STATE_DIR, "skill-manager-config.json");

const DEFAULT_CONFIG: SkillManagerConfig = {
  enabledCategories: [],   // all disabled by default
  customSkills: [],
};

// ═══════════════════════════════════════════════════════════════════════════
// Read / write
// ═══════════════════════════════════════════════════════════════════════════

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // silent — never block for a write failure
  }
}

/** Load the global config. Returns defaults if file is missing or corrupt. */
export function loadConfig(): SkillManagerConfig {
  return {
    ...DEFAULT_CONFIG,
    ...readJson<SkillManagerConfig>(CONFIG_FILE, {}),
  };
}

/** Save the global config. */
export function saveConfig(config: SkillManagerConfig): void {
  writeJson(CONFIG_FILE, config);
}

/** Resolve all enabled categories. null = all enabled. */
export function getEffectiveCategories(
  config: SkillManagerConfig,
  sessionOverride: string[] | null,
): string[] | null {
  // Per-session override takes precedence
  if (sessionOverride !== null) return sessionOverride;
  // Global config: undefined = all enabled, empty = all disabled
  if (config.enabledCategories === undefined) return null; // null = all enabled
  return config.enabledCategories;
}

/** Check if a category is enabled given the effective list. null = all enabled. */
export function isCategoryEnabled(
  category: string,
  effectiveCategories: string[] | null,
): boolean {
  if (effectiveCategories === null) return true; // null = all enabled
  return effectiveCategories.includes(category);
}

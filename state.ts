/**
 * Persistence layer — usage tracking, bookmarks, and daily suggestions.
 * All state files live in ~/.pi/agent/ as JSON.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { Skill } from "./scan.ts";
import { getCategoryDef } from "./categories.ts";

const STATE_DIR = path.join(os.homedir(), ".pi", "agent");

// ═══════════════════════════════════════════════════════════════════════════
// Preferences (group-by mode, tag editor style)
// ═══════════════════════════════════════════════════════════════════════════

export interface DeckPrefs {
  groupBy?: string;             // GroupByMode (validated at read)
  tagEditorStyle?: "inline" | "modal"; // remembered last-used editor (not used to disable the other)
  lastSection?: string;         // remembered active left-pane section key
}

const PREFS_FILE = path.join(STATE_DIR, "skill-deck-prefs.json");

export function getPrefs(): DeckPrefs {
  return readJsonLazy(PREFS_FILE, {});
}

export function setPrefs(patch: Partial<DeckPrefs>): void {
  writeJsonLazy(PREFS_FILE, { ...getPrefs(), ...patch });
}

// Lazy helpers used by prefs (defined inline to avoid forward-reference)
function readJsonLazy<T>(filePath: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T; } catch { return fallback; }
}
function writeJsonLazy(filePath: string, data: unknown): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch { /* silent */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// Usage / Frecency
// ═══════════════════════════════════════════════════════════════════════════

interface UsageEntry {
  count: number;
  lastUsedAt: string; // ISO 8601
}

type UsageData = Record<string, UsageEntry>;

const USAGE_FILE = path.join(STATE_DIR, "skill-usage.json");

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
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch {
    // silent — never block the UI for a write failure
  }
}

export function getUsageData(): UsageData {
  return readJson<UsageData>(USAGE_FILE, {});
}

export function recordUsage(skillName: string): void {
  const data = getUsageData();
  const entry = data[skillName] || { count: 0, lastUsedAt: "" };
  entry.count += 1;
  entry.lastUsedAt = new Date().toISOString();
  data[skillName] = entry;
  writeJson(USAGE_FILE, data);
}

/** Frecency score: count weighted by recency (half-life = 7 days) */
export function frecencyScore(entry: UsageEntry | undefined): number {
  if (!entry || entry.count === 0) return 0;
  const ageMs = Date.now() - new Date(entry.lastUsedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const recency = Math.pow(0.5, ageDays / 7); // half-life 7 days
  return entry.count * recency;
}

/** Return the top-N skills by frecency */
export function topSkills(skills: Skill[], n: number): Skill[] {
  const usage = getUsageData();
  return [...skills]
    .filter((s) => (usage[s.name]?.count ?? 0) > 0)
    .sort((a, b) => frecencyScore(usage[b.name]) - frecencyScore(usage[a.name]))
    .slice(0, n);
}

// ═══════════════════════════════════════════════════════════════════════════
// Daily Suggestions
// ═══════════════════════════════════════════════════════════════════════════

export interface SuggestionPick {
  name: string;
  reason: string;
}

interface SuggestionCache {
  date: string; // YYYY-MM-DD
  picks: SuggestionPick[];
}

const SUGGESTION_FILE = path.join(STATE_DIR, "skill-suggestion.json");

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Generate 1-3 skill suggestions for today.
 *
 * Strategy:
 * 1. Pool = skills with 0-1 uses all-time
 * 2. Prefer skills in categories the user already uses (high category affinity)
 * 3. Light randomization for variety
 */
export function getDailySuggestions(allSkills: Skill[]): SuggestionPick[] {
  const cached = readJson<SuggestionCache>(SUGGESTION_FILE, { date: "", picks: [] });
  if (cached.date === todayStr() && cached.picks.length > 0) return cached.picks;

  const usage = getUsageData();

  // Determine category affinity: categories with the most total uses
  const catUsage: Record<string, number> = {};
  for (const skill of allSkills) {
    const u = usage[skill.name];
    if (u) {
      catUsage[skill.category] = (catUsage[skill.category] || 0) + u.count;
    }
  }

  // Pool: unused or barely-used skills
  const pool = allSkills.filter((s) => (usage[s.name]?.count ?? 0) <= 1);
  if (pool.length === 0) return [];

  // Score each pooled skill
  const scored = pool.map((s) => {
    const affinity = catUsage[s.category] || 0;
    const catDef = getCategoryDef(s.category);
    const order = catDef ? catDef.sortOrder : 50;
    // Higher affinity = better. Lower sortOrder = better. Random tiebreak.
    const score = affinity * 10 + (100 - order) + Math.random() * 5;
    return { skill: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topPicks = scored.slice(0, 3);

  const picks: SuggestionPick[] = topPicks.map(({ skill }) => {
    const affinity = catUsage[skill.category] || 0;
    const reason =
      affinity > 0
        ? `unused · you use ${skill.category} often`
        : `unused · explore ${skill.category}`;
    return { name: skill.name, reason };
  });

  writeJson(SUGGESTION_FILE, { date: todayStr(), picks });
  return picks;
}

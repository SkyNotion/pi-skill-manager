/**
 * Pluggable group-by — turns a flat skill list into named sections.
 * Each grouping mode is a pure function (Skill[] → GroupedSection[]).
 *
 * Modes:
 *   - category   (legacy)
 *   - source     (pi-agent / claude / codex / npm / agents-pack / project-local)
 *   - framework  (SuperClaude / Baoyu / Marketing pack / ProductHunt / context-mode / npm:<pkg>)
 *   - creator    (baoyu / Anthropic / CymatiStatic / Mario Zechner / Corey Haines / ...)
 *   - location   (filesystem install path)
 *   - tag        (user-applied tags from tags.ts)
 *   - usage      (Power / Active / Tried / Unused tiers)
 *   - flat       (single sorted list, no grouping)
 */

import type { Skill } from "./scan.ts";
import type { SourceOrigin } from "./source.ts";
import { getCategoryDef } from "./categories.ts";
import { getUsageData, frecencyScore } from "./state.ts";
import { getAllTagsBySkill } from "./tags.ts";

export type GroupByMode =
  | "category"
  | "source"
  | "framework"
  | "creator"
  | "location"
  | "tag"
  | "usage"
  | "flat";

export const ALL_GROUP_BY_MODES: GroupByMode[] = [
  "category", "source", "framework", "creator", "location", "tag", "usage", "flat",
];

export const GROUP_BY_LABELS: Record<GroupByMode, string> = {
  category:  "Category",
  source:    "Source",
  framework: "Framework",
  creator:   "Creator",
  location:  "Location",
  tag:       "Tag",
  usage:     "Usage Tier",
  flat:      "Flat (no grouping)",
};

export const GROUP_BY_HINTS: Record<GroupByMode, string> = {
  category:  "Semantic buckets (Design, Marketing, ...)",
  source:    "Where the skill is installed from",
  framework: "Skill library (Baoyu, Marketing pack, npm:<pkg>, ...)",
  creator:   "Who authored the skill",
  location:  "Physical install path",
  tag:       "Your applied tags",
  usage:     "Power · Active · Tried · Unused",
  flat:      "Single list, sorted by frecency",
};

export interface GroupedSection {
  key: string;
  label: string;
  icon: string;
  ansi: string;
  skills: Skill[];
  sortOrder: number;
}

export function isValidGroupByMode(v: unknown): v is GroupByMode {
  return typeof v === "string" && (ALL_GROUP_BY_MODES as readonly string[]).includes(v);
}

export function nextGroupByMode(current: GroupByMode): GroupByMode {
  const idx = ALL_GROUP_BY_MODES.indexOf(current);
  return ALL_GROUP_BY_MODES[(idx + 1) % ALL_GROUP_BY_MODES.length];
}

export function buildGroups(skills: Skill[], mode: GroupByMode): GroupedSection[] {
  switch (mode) {
    case "category":  return groupByCategory(skills);
    case "source":    return groupBySource(skills);
    case "framework": return groupByFramework(skills);
    case "creator":   return groupByCreator(skills);
    case "location":  return groupByLocation(skills);
    case "tag":       return groupByTag(skills);
    case "usage":     return groupByUsage(skills);
    case "flat":      return groupFlat(skills);
  }
}

// ───────────────────────────────────────────────────────────────
// Mode implementations
// ───────────────────────────────────────────────────────────────

function groupByCategory(skills: Skill[]): GroupedSection[] {
  const byCat = new Map<string, Skill[]>();
  for (const s of skills) {
    const arr = byCat.get(s.category) || [];
    arr.push(s);
    byCat.set(s.category, arr);
  }
  return [...byCat.entries()].map(([cat, list]) => {
    const def = getCategoryDef(cat);
    return {
      key: cat,
      label: cat,
      icon: def.icon,
      ansi: def.ansi,
      skills: sortByFrecency(list),
      sortOrder: def.sortOrder,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

const SOURCE_META: Record<SourceOrigin, { icon: string; ansi: string; sortOrder: number; label: string }> = {
  "pi-agent":       { icon: "⚙️", ansi: "34", sortOrder: 1,  label: "Pi Agent" },
  "pi-user":        { icon: "🏠", ansi: "34", sortOrder: 2,  label: "Pi User" },
  "pi-project":     { icon: "📂", ansi: "34", sortOrder: 3,  label: "Pi (Project)" },
  "claude-user":    { icon: "🤖", ansi: "35", sortOrder: 4,  label: "Claude (User)" },
  "claude-project": { icon: "📂", ansi: "35", sortOrder: 5,  label: "Claude (Project)" },
  "codex":          { icon: "🦊", ansi: "33", sortOrder: 6,  label: "Codex" },
  "agents-pack":    { icon: "📦", ansi: "32", sortOrder: 7,  label: "Agents Pack" },
  "npm":            { icon: "📦", ansi: "31", sortOrder: 8,  label: "npm Package" },
  "unknown":        { icon: "·",  ansi: "90", sortOrder: 99, label: "Unknown" },
};

function groupBySource(skills: Skill[]): GroupedSection[] {
  const map = new Map<SourceOrigin, Skill[]>();
  for (const s of skills) {
    const arr = map.get(s.source.origin) || [];
    arr.push(s);
    map.set(s.source.origin, arr);
  }
  return [...map.entries()].map(([key, list]) => {
    const meta = SOURCE_META[key];
    return {
      key,
      label: meta.label,
      icon: meta.icon,
      ansi: meta.ansi,
      skills: sortByFrecency(list),
      sortOrder: meta.sortOrder,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

function groupByFramework(skills: Skill[]): GroupedSection[] {
  const map = new Map<string, Skill[]>();
  for (const s of skills) {
    const key = s.source.framework || "—";
    const arr = map.get(key) || [];
    arr.push(s);
    map.set(key, arr);
  }
  return [...map.entries()]
    .map(([key, list]) => ({
      key,
      label: key,
      icon: "📚",
      ansi: "36",
      skills: sortByFrecency(list),
      sortOrder: 0,
    }))
    .sort((a, b) => b.skills.length - a.skills.length);
}

function groupByCreator(skills: Skill[]): GroupedSection[] {
  const map = new Map<string, Skill[]>();
  for (const s of skills) {
    const key = s.source.creator || "—";
    const arr = map.get(key) || [];
    arr.push(s);
    map.set(key, arr);
  }
  return [...map.entries()]
    .map(([key, list]) => ({
      key,
      label: key,
      icon: "👤",
      ansi: "33",
      skills: sortByFrecency(list),
      sortOrder: 0,
    }))
    .sort((a, b) => b.skills.length - a.skills.length);
}

function groupByLocation(skills: Skill[]): GroupedSection[] {
  const map = new Map<string, Skill[]>();
  for (const s of skills) {
    const key = s.source.location;
    const arr = map.get(key) || [];
    arr.push(s);
    map.set(key, arr);
  }
  return [...map.entries()]
    .map(([key, list]) => ({
      key,
      label: key,
      icon: "📁",
      ansi: "37",
      skills: sortByFrecency(list),
      sortOrder: 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function groupByTag(skills: Skill[]): GroupedSection[] {
  const tags = getAllTagsBySkill();
  const byTag = new Map<string, Skill[]>();
  const untagged: Skill[] = [];
  const skillsByName = new Map(skills.map((s) => [s.name, s]));

  for (const [skillName, tagList] of Object.entries(tags)) {
    const skill = skillsByName.get(skillName);
    if (!skill) continue;
    for (const tag of tagList) {
      const arr = byTag.get(tag) || [];
      arr.push(skill);
      byTag.set(tag, arr);
    }
  }
  for (const s of skills) {
    if (!tags[s.name] || tags[s.name].length === 0) untagged.push(s);
  }

  const sections: GroupedSection[] = [...byTag.entries()]
    .map(([tag, list]) => ({
      key: tag,
      label: `#${tag}`,
      icon: "🏷️",
      ansi: "33",
      skills: sortByFrecency(list),
      sortOrder: 0,
    }))
    .sort((a, b) => b.skills.length - a.skills.length);

  if (untagged.length > 0) {
    sections.push({
      key: "__untagged",
      label: "(untagged)",
      icon: "·",
      ansi: "90",
      skills: sortByFrecency(untagged),
      sortOrder: 999,
    });
  }

  return sections;
}

function groupByUsage(skills: Skill[]): GroupedSection[] {
  const usage = getUsageData();
  const power: Skill[] = [];
  const active: Skill[] = [];
  const tried: Skill[] = [];
  const unused: Skill[] = [];

  for (const s of skills) {
    const count = usage[s.name]?.count ?? 0;
    if (count === 0) unused.push(s);
    else if (count <= 2) tried.push(s);
    else if (count < 10) active.push(s);
    else power.push(s);
  }

  return [
    { key: "power",  label: "Power (10+ uses)", icon: "⚡", ansi: "33", skills: sortByFrecency(power),  sortOrder: 1 },
    { key: "active", label: "Active (3-9)",     icon: "🔥", ansi: "31", skills: sortByFrecency(active), sortOrder: 2 },
    { key: "tried",  label: "Tried (1-2)",      icon: "🌱", ansi: "32", skills: sortByFrecency(tried),  sortOrder: 3 },
    { key: "unused", label: "Unused",           icon: "·",  ansi: "90", skills: sortByFrecency(unused), sortOrder: 4 },
  ].filter((s) => s.skills.length > 0);
}

function groupFlat(skills: Skill[]): GroupedSection[] {
  return [{
    key: "all",
    label: `All Skills (${skills.length})`,
    icon: "📋",
    ansi: "36",
    skills: sortByFrecency([...skills]),
    sortOrder: 0,
  }];
}

// ───────────────────────────────────────────────────────────────
// Helper
// ───────────────────────────────────────────────────────────────

function sortByFrecency(skills: Skill[]): Skill[] {
  const usage = getUsageData();
  return skills.sort((a, b) => frecencyScore(usage[b.name]) - frecencyScore(usage[a.name]));
}

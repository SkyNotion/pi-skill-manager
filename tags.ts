/**
 * Skill tags — free-form user-applied labels for skills.
 * Stored in ~/.pi/agent/skill-tags.json as { [skillName]: string[] }.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const TAGS_FILE = path.join(os.homedir(), ".pi", "agent", "skill-tags.json");

type TagsData = Record<string, string[]>;

function readTags(): TagsData {
  try {
    return JSON.parse(fs.readFileSync(TAGS_FILE, "utf-8")) as TagsData;
  } catch {
    return {};
  }
}

function writeTags(data: TagsData): void {
  try {
    fs.mkdirSync(path.dirname(TAGS_FILE), { recursive: true });
    fs.writeFileSync(TAGS_FILE, JSON.stringify(data, null, 2));
  } catch {
    /* silent — UI never blocks on a write failure */
  }
}

/** Tags for a single skill (empty array if none). */
export function getTags(skillName: string): string[] {
  return readTags()[skillName] ?? [];
}

/** Replace tags for a skill. Empty array deletes the entry. */
export function setTags(skillName: string, tags: string[]): void {
  const data = readTags();
  const cleaned = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
  if (cleaned.length === 0) {
    delete data[skillName];
  } else {
    data[skillName] = cleaned;
  }
  writeTags(data);
}

/** Parse comma- / space-separated user input into a tag array. Strips leading `#`. */
export function parseTagInput(input: string): string[] {
  return input
    .split(/[,\s]+/)
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean);
}

/** All tags in use, sorted by frequency descending. */
export function getAllTags(): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const tagList of Object.values(readTags())) {
    for (const t of tagList) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));
}

/** Full tags-by-skill map (read-only snapshot). */
export function getAllTagsBySkill(): TagsData {
  return readTags();
}

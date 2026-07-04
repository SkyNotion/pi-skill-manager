/**
 * Skill directory scanning and frontmatter parsing.
 * Walks all known skill locations and returns categorized Skill objects.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { categorizeSkill } from "./categories.ts";
import { detectSource, type SkillSource } from "./source.ts";
import { extractBodyFromContent } from "./body.ts";
import type { CustomSkillEntry } from "./config.ts";

export interface Skill {
  name: string;
  description: string;
  filePath: string;
  category: string;
  source: SkillSource;
  bodyExcerpt: string;     // "What it does" excerpt from SKILL.md body
  bodyIsThin: boolean;     // True when body is missing/too short — flagged in DETAILS
  hasExplicitSection: boolean; // True when an About/Overview/etc heading was found
  /** True when this skill came from a custom path in the config file. */
  isCustom: boolean;
}

type ScanFormat = "recursive" | "claude";

interface ScanDir {
  dir: string;
  format: ScanFormat;
}

export function parseFrontmatter(content: string, fallbackName: string): { name: string; description: string } {
  if (!content.startsWith("---")) {
    return { name: fallbackName, description: "" };
  }
  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) return { name: fallbackName, description: "" };

  const fm = content.slice(3, endIndex);
  const nameMatch = fm.match(/^name\s*:\s*(.+)$/m);
  const descMatch = fm.match(/^description\s*:\s*["']?([\s\S]*?)["']?\s*$/m);

  return {
    name: nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, "") : fallbackName,
    description: descMatch ? descMatch[1].trim().replace(/^["']|["']$/g, "") : "",
  };
}

function loadSkillFile(filePath: string, skills: Map<string, Skill>): void {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const dirName = path.basename(path.dirname(filePath));
    const { name, description } = parseFrontmatter(content, dirName);

    if (description && !skills.has(name)) {
      const source = detectSource(name, filePath);
      const domain = categorizeSkill(name, description, filePath);
      // Composite category: "{Provider}: {Domain}" — enables per-provider skill toggling
      const provider = source.framework;
      const category = provider && provider !== "—"
        ? `${provider}: ${domain}`
        : domain;

      const body = extractBodyFromContent(content);
      skills.set(name, {
        name,
        description,
        filePath,
        category,
        source,
        bodyExcerpt: body.excerpt,
        bodyIsThin: body.isThin,
        hasExplicitSection: body.hasExplicitSection,
        isCustom: false,
      });
    }
  } catch {
    // Skip unreadable files
  }
}

function scanDir(dir: string, format: ScanFormat, skills: Map<string, Skill>, visited = new Set<string>()): void {
  const resolved = fs.realpathSync?.(dir) ?? dir;
  if (visited.has(resolved)) return;
  visited.add(resolved);

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      let isDir = entry.isDirectory();
      let isFile = entry.isFile();

      if (entry.isSymbolicLink()) {
        try {
          const stats = fs.statSync(entryPath);
          isDir = stats.isDirectory();
          isFile = stats.isFile();
        } catch {
          continue;
        }
      }

      if (format === "recursive") {
        if (isDir) scanDir(entryPath, format, skills, visited);
        else if (isFile && entry.name === "SKILL.md") loadSkillFile(entryPath, skills);
      } else if (format === "claude") {
        if (!isDir) continue;
        const skillFile = path.join(entryPath, "SKILL.md");
        if (fs.existsSync(skillFile)) loadSkillFile(skillFile, skills);
      }
    }
  } catch {
    // Skip inaccessible directories
  }
}

/** Scan npm global node_modules for packages that contain skills/ directories */
function scanNpmGlobalSkills(skills: Map<string, Skill>): void {
  const npmRoot =
    process.platform === "win32"
      ? path.join(process.env.APPDATA || "", "npm", "node_modules")
      : path.join(os.homedir(), ".npm-global", "lib", "node_modules");

  if (!fs.existsSync(npmRoot)) return;

  try {
    for (const pkg of fs.readdirSync(npmRoot, { withFileTypes: true })) {
      if (!pkg.isDirectory()) continue;
      const skillsDir = path.join(npmRoot, pkg.name, "skills");
      if (fs.existsSync(skillsDir)) {
        scanDir(skillsDir, "recursive", skills);
      }
    }
  } catch {
    // npm root not accessible
  }
}

/**
 * Load all skills from every known location.
 * Matches Pi's loading order; first occurrence of a skill name wins.
 */
export function loadAllSkills(): Skill[] {
  const skills = new Map<string, Skill>();

  const dirs: ScanDir[] = [
    { dir: path.join(os.homedir(), ".codex", "skills"), format: "recursive" },
    { dir: path.join(os.homedir(), ".claude", "skills"), format: "claude" },
    { dir: path.join(process.cwd(), ".claude", "skills"), format: "claude" },
    { dir: path.join(os.homedir(), ".pi", "agent", "skills"), format: "recursive" },
    { dir: path.join(os.homedir(), ".pi", "skills"), format: "recursive" },
    { dir: path.join(process.cwd(), ".pi", "skills"), format: "recursive" },
    // Additional known locations
    { dir: path.join(os.homedir(), ".agents", "skills"), format: "recursive" },
  ];

  for (const { dir, format } of dirs) {
    if (fs.existsSync(dir)) scanDir(dir, format, skills);
  }

  // Scan npm global packages
  scanNpmGlobalSkills(skills);

  return Array.from(skills.values());
}

// ═══════════════════════════════════════════════════════════════════════════
// Custom skills loader
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Name resolution order for a custom skill entry:
 * 1. Config entry has "name"? → use it
 * 2. File has YAML frontmatter with "name:"? → use that
 * 3. Derive from filename stem
 */
function resolveSkillName(
  configName: string | undefined,
  content: string,
  fileName: string,
): string {
  if (configName) return configName;
  const { name: fmName } = parseFrontmatter(content, "");
  if (fmName) return fmName;
  // Fallback: basename without extension
  return path.basename(fileName, path.extname(fileName));
}

/**
 * Recursively scan a directory for SKILL.md files (same as Pi's native scanner).
 */
function scanDirForSkills(
  dir: string,
  entry: CustomSkillEntry,
  result: Skill[],
  visited: Set<string>,
): void {
  const resolved = fs.realpathSync?.(dir) ?? dir;
  if (visited.has(resolved)) return;
  visited.add(resolved);

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const dirent of entries) {
      const entryPath = path.join(dir, dirent.name);
      let isDir = dirent.isDirectory();
      let isFile = dirent.isFile();

      if (dirent.isSymbolicLink()) {
        try {
          const stats = fs.statSync(entryPath);
          isDir = stats.isDirectory();
          isFile = stats.isFile();
        } catch {
          continue;
        }
      }

      if (isDir) {
        scanDirForSkills(entryPath, entry, result, visited);
      } else if (isFile && dirent.name === "SKILL.md") {
        try {
          const content = fs.readFileSync(entryPath, "utf-8");
          const dirName = path.basename(path.dirname(entryPath));
          const { name, description } = parseFrontmatter(content, dirName);

          if (!description) continue;

          // Use entry's parentDir hint for categorization if provided
          const categoryPath = entry.parentDir
            ? path.join(dir, entry.parentDir, "SKILL.md")
            : entryPath;

          const body = extractBodyFromContent(content);
          const framework = entry.provider || "Custom";
          const domain = categorizeSkill(name, description, categoryPath);
          const category = `${framework}: ${domain}`;

          result.push({
            name,
            description,
            filePath: entryPath,
            category,
            source: {
              origin: "unknown",
              location: dir,
              framework,
              creator: "user",
              installRoot: dir,
            },
            bodyExcerpt: body.excerpt,
            bodyIsThin: body.isThin,
            hasExplicitSection: body.hasExplicitSection,
            isCustom: true,
          });
        } catch {
          // skip unreadable
        }
      }
    }
  } catch {
    // skip inaccessible
  }
}

/**
 * Load skills from custom paths defined in the config.
 *
 * Two modes per entry:
 *   - recurse=true:  Recursively scan directory for all SKILL.md files (like Pi's native scanner)
 *   - recurse=false: Read a single file (fileName, defaults to "SKILL.md")
 *
 * Returns an array of Skill objects (never throws; skips bad entries silently).
 */
export function loadCustomSkills(customSkills: CustomSkillEntry[]): Skill[] {
  const result: Skill[] = [];
  const cwd = process.cwd();

  for (const entry of customSkills) {
    try {
      // Resolve path: absolute or relative to cwd
      const dir = path.isAbsolute(entry.path)
        ? entry.path
        : path.resolve(cwd, entry.path);

      if (!fs.existsSync(dir)) {
        console.warn(`[skill-manager] custom skill path not found: ${dir}`);
        continue;
      }

      if (entry.recurse) {
        // Recursive scan: walk all subdirectories for SKILL.md
        const visited = new Set<string>();
        scanDirForSkills(dir, entry, result, visited);
        continue;
      }

      // Single-file mode
      const fileName = entry.fileName || "SKILL.md";
      const filePath = path.join(dir, fileName);

      if (!fs.existsSync(filePath)) {
        console.warn(`[skill-manager] custom skill file not found: ${filePath}`);
        continue;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const name = resolveSkillName(entry.name, content, fileName);
      const { description } = parseFrontmatter(content, name);

      // Build a synthetic filePath that includes parentDir for category detection
      const categoryPath = entry.parentDir
        ? path.join(dir, entry.parentDir, fileName)
        : filePath;

      const category = categorizeSkill(name, description, categoryPath);

      const body = extractBodyFromContent(content);
      const framework = entry.provider || "Custom";

      result.push({
        name,
        description,
        filePath,
        category,
        source: {
          origin: "unknown",
          location: dir,
          framework,
          creator: "user",
          installRoot: dir,
        },
        bodyExcerpt: body.excerpt,
        bodyIsThin: body.isThin,
        hasExplicitSection: body.hasExplicitSection,
        isCustom: true,
      });
    } catch (err) {
      console.warn(`[skill-manager] error loading custom skill: ${entry.path}`, err);
    }
  }

  return result;
}

/** Strip frontmatter and return the body content of a SKILL.md */
export function getSkillContent(skill: Skill): string {
  const raw = fs.readFileSync(skill.filePath, "utf-8");
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  return end === -1 ? raw : raw.slice(end + 4).trim();
}

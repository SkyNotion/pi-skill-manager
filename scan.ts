/**
 * Skill directory scanning and frontmatter parsing.
 * Walks all known skill locations and returns categorized Skill objects.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { categorizeSkill } from "./categories.ts";

export interface Skill {
  name: string;
  description: string;
  filePath: string;
  category: string;
}

type ScanFormat = "recursive" | "claude";

interface ScanDir {
  dir: string;
  format: ScanFormat;
}

function parseFrontmatter(content: string, fallbackName: string): { name: string; description: string } {
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
      skills.set(name, {
        name,
        description,
        filePath,
        category: categorizeSkill(name, description, filePath),
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

/** Strip frontmatter and return the body content of a SKILL.md */
export function getSkillContent(skill: Skill): string {
  const raw = fs.readFileSync(skill.filePath, "utf-8");
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  return end === -1 ? raw : raw.slice(end + 4).trim();
}

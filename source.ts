/**
 * Source/framework/creator detection for skills.
 *
 * Determines where a skill came from based on its filePath, and
 * attaches a human-friendly framework + creator label.
 *
 * Detection order:
 *   1. npm-global package match (node_modules/<pkg>/...)
 *   2. Known install path root (~/.pi/agent, ~/.claude, ~/.codex, ~/.agents, etc.)
 *      - For ~/.agents/skills/<sub>, look up sub-library metadata
 *   3. Name-prefix hints (baoyu-*, ctx-*, ph-*, gr-*) override creator + framework
 *   4. Fallback: origin = "unknown"
 */

import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";

export type SourceOrigin =
  | "pi-agent"
  | "pi-user"
  | "pi-project"
  | "claude-user"
  | "claude-project"
  | "codex"
  | "agents-pack"
  | "npm"
  | "unknown";

export interface SkillSource {
  origin: SourceOrigin;
  location: string;       // Human-friendly install location (e.g. "~/.pi/agent/skills")
  framework: string;      // e.g. "Marketing Sub-Library", "Baoyu Skills", "npm:context-mode"
  creator: string;        // e.g. "baoyu", "Anthropic", "CymatiStatic", "—"
  installRoot: string;    // Canonical install root path
}

const HOME = os.homedir();
const CWD = process.cwd();

const PATH_RULES: Array<{
  prefix: string;
  origin: SourceOrigin;
  location: string;
  installRoot: string;
}> = [
  // More specific paths first
  { prefix: path.join(HOME, ".pi", "agent", "skills"),  origin: "pi-agent",       location: "~/.pi/agent/skills",       installRoot: path.join(HOME, ".pi", "agent", "skills") },
  { prefix: path.join(HOME, ".pi", "skills"),           origin: "pi-user",        location: "~/.pi/skills",             installRoot: path.join(HOME, ".pi", "skills") },
  { prefix: path.join(CWD,  ".pi", "skills"),           origin: "pi-project",     location: ".pi/skills (project)",     installRoot: path.join(CWD,  ".pi", "skills") },
  { prefix: path.join(HOME, ".claude", "skills"),       origin: "claude-user",    location: "~/.claude/skills",         installRoot: path.join(HOME, ".claude", "skills") },
  { prefix: path.join(CWD,  ".claude", "skills"),       origin: "claude-project", location: ".claude/skills (project)", installRoot: path.join(CWD,  ".claude", "skills") },
  { prefix: path.join(HOME, ".codex", "skills"),        origin: "codex",          location: "~/.codex/skills",          installRoot: path.join(HOME, ".codex", "skills") },
  { prefix: path.join(HOME, ".agents", "skills"),       origin: "agents-pack",    location: "~/.agents/skills",         installRoot: path.join(HOME, ".agents", "skills") },
];

// agents-pack sub-libraries (subdirectory under ~/.agents/skills/)
const AGENTS_PACK_MAP: Record<string, { framework: string; creator: string }> = {
  marketing:           { framework: "Marketing Sub-Library",   creator: "Corey Haines" },
  producthunt:         { framework: "ProductHunt Sub-Library", creator: "yoanbernabeu" },
  "oss-launch":        { framework: "OSS Launch Sub-Library",  creator: "gingiris" },
  "microsoft-foundry": { framework: "Microsoft Foundry Skill", creator: "Microsoft" },
};

// Name-prefix hints (override creator/framework when matched)
const NAME_HINTS: Array<{ prefix: string; framework: string; creator: string }> = [
  { prefix: "baoyu-", framework: "Baoyu Skills",            creator: "宝玉 (baoyu)" },
  { prefix: "ctx-",   framework: "context-mode",            creator: "Mario Zechner" },
  { prefix: "ph-",    framework: "ProductHunt Sub-Library", creator: "yoanbernabeu" },
  { prefix: "gr-",    framework: "OSS Launch Sub-Library",  creator: "gingiris" },
];

const NPM_PKG_CACHE = new Map<string, { framework: string; creator: string }>();

function readNpmPkg(pkgRoot: string): { framework: string; creator: string } {
  const cached = NPM_PKG_CACHE.get(pkgRoot);
  if (cached) return cached;

  let framework = `npm:${path.basename(pkgRoot)}`;
  let creator = "—";
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, "package.json"), "utf-8"));
    if (pkg.name) framework = `npm:${pkg.name}`;
    if (pkg.author) {
      creator = typeof pkg.author === "string"
        ? pkg.author.replace(/<[^>]+>/g, "").trim() || "—"
        : (pkg.author.name || "—");
    }
  } catch {
    /* leave defaults */
  }

  const result = { framework, creator };
  NPM_PKG_CACHE.set(pkgRoot, result);
  return result;
}

function detectNpmPackage(filePath: string): { installRoot: string; pkgRoot: string } | null {
  const norm = filePath.replace(/\\/g, "/");
  const m = norm.match(/^(.*\/node_modules)\/((?:@[^/]+\/)?[^/]+)/);
  if (!m) return null;
  const nmRoot = m[1].replace(/\//g, path.sep);
  const pkgSeg = m[2].replace(/\//g, path.sep);
  return {
    installRoot: path.dirname(nmRoot),
    pkgRoot: path.join(nmRoot, pkgSeg),
  };
}

function nameHint(name: string): { framework: string; creator: string } | null {
  for (const h of NAME_HINTS) {
    if (name.startsWith(h.prefix)) return { framework: h.framework, creator: h.creator };
  }
  return null;
}

function defaultFrameworkForOrigin(origin: SourceOrigin): string {
  switch (origin) {
    case "pi-agent":       return "Pi Agent";
    case "pi-user":        return "Pi User";
    case "pi-project":     return "Pi Project-local";
    case "claude-user":    return "Claude Skills";
    case "claude-project": return "Claude Project-local";
    case "codex":          return "Codex Skills";
    case "agents-pack":    return "Agents Pack";
    default:               return "—";
  }
}

function defaultCreatorForOrigin(origin: SourceOrigin): string {
  switch (origin) {
    case "pi-agent":
    case "pi-user":
    case "pi-project":     return "Ben (local)";
    case "claude-user":
    case "claude-project": return "user-installed";
    case "codex":          return "user-installed";
    case "agents-pack":    return "—";
    default:               return "—";
  }
}

/** Detect source/framework/creator for a skill given its name + file path. */
export function detectSource(name: string, filePath: string): SkillSource {
  // 1. npm package
  const npm = detectNpmPackage(filePath);
  if (npm) {
    const { framework, creator } = readNpmPkg(npm.pkgRoot);
    const hint = nameHint(name);
    return {
      origin: "npm",
      location: `npm-global/${path.basename(npm.pkgRoot)}`,
      framework: hint?.framework ?? framework,
      creator: hint?.creator ?? creator,
      installRoot: npm.installRoot,
    };
  }

  // 2. Match a known path root
  for (const rule of PATH_RULES) {
    if (filePath.startsWith(rule.prefix)) {
      // agents-pack sub-libraries
      if (rule.origin === "agents-pack") {
        const rel = path.relative(rule.installRoot, filePath).replace(/\\/g, "/");
        const sub = rel.split("/")[0]?.toLowerCase();
        const subInfo = sub ? AGENTS_PACK_MAP[sub] : null;
        if (subInfo) {
          const hint = nameHint(name);
          return {
            origin: "agents-pack",
            location: `~/.agents/skills/${sub}`,
            framework: hint?.framework ?? subInfo.framework,
            creator: hint?.creator ?? subInfo.creator,
            installRoot: rule.installRoot,
          };
        }
      }

      const hint = nameHint(name);
      return {
        origin: rule.origin,
        location: rule.location,
        framework: hint?.framework ?? defaultFrameworkForOrigin(rule.origin),
        creator: hint?.creator ?? defaultCreatorForOrigin(rule.origin),
        installRoot: rule.installRoot,
      };
    }
  }

  // 3. Fallback (name hint only)
  const hint = nameHint(name);
  return {
    origin: "unknown",
    location: path.dirname(filePath),
    framework: hint?.framework ?? "—",
    creator: hint?.creator ?? "—",
    installRoot: path.dirname(filePath),
  };
}

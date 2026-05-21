/**
 * Category definitions and skill-to-category mapping.
 *
 * Categorization strategy (applied in order):
 * 1. Parent directory name (e.g. skills live under .../marketing/ → Marketing & GTM)
 * 2. Skill name prefix (baoyu-* → Baoyu Tools, ph-* → Product Hunt, etc.)
 * 3. Explicit override map for non-obvious skills
 * 4. Description keyword matching as fallback
 * 5. "Other" as last resort
 */

export interface CategoryDef {
  label: string;
  ansi: string; // ANSI color code for the label
  icon: string;
  sortOrder: number;
}

export const CATEGORIES: Record<string, CategoryDef> = {
  "Design & UI":     { label: "Design & UI",     ansi: "36",  icon: "🎨", sortOrder: 1 },
  "Marketing & GTM": { label: "Marketing & GTM", ansi: "33",  icon: "📣", sortOrder: 2 },
  "Product Hunt":    { label: "Product Hunt",    ansi: "33",  icon: "🐱", sortOrder: 3 },
  "Video & Media":   { label: "Video & Media",   ansi: "35",  icon: "🎬", sortOrder: 4 },
  "Memory & Brain":  { label: "Memory & Brain",  ansi: "32",  icon: "🧠", sortOrder: 5 },
  "Pi Meta":         { label: "Pi Meta",         ansi: "34",  icon: "⚙️", sortOrder: 6 },
  "Open Design":     { label: "Open Design",     ansi: "36",  icon: "🎯", sortOrder: 7 },
  "Obsidian":        { label: "Obsidian",        ansi: "35",  icon: "💎", sortOrder: 8 },
  "Baoyu Tools":     { label: "Baoyu Tools",     ansi: "31",  icon: "🔧", sortOrder: 9 },
  "Context-Mode":    { label: "Context-Mode",    ansi: "34",  icon: "📦", sortOrder: 10 },
  "OSS Launch":      { label: "OSS Launch",      ansi: "32",  icon: "🚀", sortOrder: 11 },
  "Cloud & Deploy":  { label: "Cloud & Deploy",  ansi: "34",  icon: "☁️", sortOrder: 12 },
  "Product":         { label: "Product",         ansi: "33",  icon: "📋", sortOrder: 13 },
  "Other":           { label: "Other",           ansi: "90",  icon: "·",  sortOrder: 99 },
};

// Parent directory → category (highest priority for npm/agents skills)
const DIR_CATEGORY: Record<string, string> = {
  marketing: "Marketing & GTM",
  producthunt: "Product Hunt",
  "oss-launch": "OSS Launch",
  "microsoft-foundry": "Cloud & Deploy",
};

// Skill name prefix → category
const PREFIX_RULES: Array<[string, string]> = [
  ["baoyu-", "Baoyu Tools"],
  ["ph-", "Product Hunt"],
  ["ctx-", "Context-Mode"],
  ["gr-", "OSS Launch"],
];

// Explicit overrides for skills that don't follow prefix/directory patterns
const EXPLICIT_MAP: Record<string, string> = {
  // Design & UI
  accessibility: "Design & UI",
  critique: "Design & UI",
  dashboard: "Design & UI",
  "design-brief": "Design & UI",
  "design-taste-frontend": "Design & UI",
  "extract-design-system": "Design & UI",
  impeccable: "Design & UI",
  "mobile-app": "Design & UI",
  "mobile-onboarding": "Design & UI",
  "motion-frames": "Design & UI",
  "pricing-page": "Design & UI",
  "saas-landing": "Design & UI",
  "tailwind-design-system": "Design & UI",
  tweaks: "Design & UI",
  "ui-ux-pro-max": "Design & UI",
  "web-prototype": "Design & UI",
  "wireframe-sketch": "Design & UI",
  "live-artifact": "Design & UI",
  "pm-spec": "Design & UI",
  // Memory & Brain
  "pi-memory": "Memory & Brain",
  "lesson-capture": "Memory & Brain",
  reflexion: "Memory & Brain",
  "reflect-maintenance": "Memory & Brain",
  // Open Design
  "open-design": "Open Design",
  // Obsidian
  "obsidian-bases": "Obsidian",
  "obsidian-cli": "Obsidian",
  "obsidian-markdown": "Obsidian",
  "json-canvas": "Obsidian",
  // Pi Meta
  "confidence-check": "Pi Meta",
  delegation: "Pi Meta",
  "feature-spec": "Pi Meta",
  "spec-tator": "Pi Meta",
  "find-skills": "Pi Meta",
  "foreground-chains": "Pi Meta",
  os: "Pi Meta",
  orchestration: "Pi Meta",
  pam: "Pi Meta",
  "release-skills": "Pi Meta",
  "prompt-template-authoring": "Pi Meta",
  council: "Pi Meta",
  "pi-interactive-shell": "Pi Meta",
  "pi-intercom": "Pi Meta",
  "design-deck": "Pi Meta",
  librarian: "Pi Meta",
  "context-mode": "Context-Mode",
  // Video & Media
  hyperframes: "Video & Media",
  video: "Video & Media",
  // Product
  plaid: "Product",
  // Cloud
  "microsoft-foundry": "Cloud & Deploy",
  // GTM (the orchestrator itself)
  gtm: "Marketing & GTM",
};

// Description keywords → category (fallback)
const KEYWORD_RULES: Array<[string[], string]> = [
  [["marketing", "growth", "launch", "conversion", "CRO", "SEO", "ad ", "paid", "email campaign", "cold outreach", "churn", "referral", "pricing strategy", "sales", "competitor", "content strategy", "copywriting", "directory submissions"], "Marketing & GTM"],
  [["design", "UI", "UX", "layout", "component", "CSS", "frontend", "wireframe", "prototype"], "Design & UI"],
  [["video", "audio", "media", "transcript", "subtitle"], "Video & Media"],
  [["obsidian", "vault", "wikilink", "callout"], "Obsidian"],
  [["memory", "brain", "lesson", "reflect"], "Memory & Brain"],
];

/**
 * Determine the category for a skill given its name, description, and file path.
 */
export function categorizeSkill(name: string, description: string, filePath: string): string {
  // 1. Parent directory name
  const parts = filePath.replace(/\\/g, "/").split("/");
  for (let i = parts.length - 1; i >= 0; i--) {
    const dir = parts[i].toLowerCase();
    if (DIR_CATEGORY[dir]) return DIR_CATEGORY[dir];
  }

  // 2. Prefix match
  for (const [prefix, cat] of PREFIX_RULES) {
    if (name.startsWith(prefix)) return cat;
  }

  // 3. Explicit map
  if (EXPLICIT_MAP[name]) return EXPLICIT_MAP[name];

  // 4. Description keyword match
  const lowerDesc = description.toLowerCase();
  for (const [keywords, cat] of KEYWORD_RULES) {
    if (keywords.some((kw) => lowerDesc.includes(kw.toLowerCase()))) return cat;
  }

  // 5. Fallback
  return "Other";
}

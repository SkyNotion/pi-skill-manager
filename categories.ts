/**
 * Category definitions and skill-to-category mapping.
 *
 * Categorization strategy (applied in order):
 * 1. Parent directory name matches DIR_CATEGORY (catches bulk of skills by their install dir)
 * 2. Skill name prefix (9router-*, baoyu-*, ph-*, ctx-*, gr-*)
 * 3. Explicit override map EXPLICIT_MAP for skills that need name-based mapping
 * 4. Description keyword matching KEYWORD_RULES as fallback
 * 5. "Other" as last resort
 *
 * Category design notes:
 * - "Frontend & Design" covers web/mobile/desktop frontend + UI/UX design + creative/media
 * - "Backend & API" covers server-side code, programming languages, API design
 * - "DevOps & Cloud" covers infra, deployment, CI/CD, cloud platforms
 * - "Documents & Office" covers docx/pptx/pdf/xlsx and document processing
 * - "Marketing & Business" covers marketing, growth, product, career
 * - "Platform & Ecosystem" covers Pi, Sentry, GitHub, 9router, MCP, platform tools
 */

export interface CategoryDef {
  label: string;
  ansi: string; // ANSI color code for the label
  icon: string;
  sortOrder: number;
}

export const CATEGORIES: Record<string, CategoryDef> = {
  "Frontend & Design":         { label: "Frontend & Design",      ansi: "36", icon: "🎨", sortOrder: 1 },
  "Backend & API":             { label: "Backend & API",          ansi: "34", icon: "⚙️", sortOrder: 2 },
  "DevOps & Cloud":            { label: "DevOps & Cloud",         ansi: "33", icon: "☁️", sortOrder: 3 },
  "Databases & Storage":       { label: "Databases & Storage",    ansi: "32", icon: "🗄️", sortOrder: 4 },
  "Security":                  { label: "Security",               ansi: "31", icon: "🔒", sortOrder: 5 },
  "AI & LLMs":                 { label: "AI & LLMs",              ansi: "35", icon: "🤖", sortOrder: 6 },
  "Scientific & Research":     { label: "Scientific & Research",  ansi: "36", icon: "🔬", sortOrder: 7 },
  "Documents & Office":        { label: "Documents & Office",     ansi: "34", icon: "📄", sortOrder: 8 },
  "Marketing & Business":      { label: "Marketing & Business",   ansi: "33", icon: "📈", sortOrder: 9 },
  "Productivity & Automation": { label: "Productivity & Automation", ansi: "32", icon: "⚡", sortOrder: 10 },
  "Enterprise & Compliance":   { label: "Enterprise & Compliance", ansi: "31", icon: "🏢", sortOrder: 11 },
  "Platform & Ecosystem":      { label: "Platform & Ecosystem",   ansi: "36", icon: "🔌", sortOrder: 12 },
  "Other":                     { label: "Other",                  ansi: "90", icon: "·",  sortOrder: 99 },
};

/**
 * Resolve a category definition for a potentially composite category name.
 *
 * Composite names are formatted as "{Provider}: {Domain}" (e.g., "Anthropic: Frontend & Design").
 * This function extracts the domain portion and looks up its metadata in CATEGORIES.
 * For plain domain names (no colon), it looks up directly.
 */
export function getCategoryDef(categoryName: string): CategoryDef {
  // Check for composite format "Provider: Domain"
  const colonIdx = categoryName.indexOf(": ");
  if (colonIdx >= 0) {
    const domain = categoryName.slice(colonIdx + 2);
    if (CATEGORIES[domain]) return CATEGORIES[domain];
  }
  // Plain domain name or fallback
  return CATEGORIES[categoryName] || CATEGORIES["Other"];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. PARENT DIRECTORY → CATEGORY
// ═══════════════════════════════════════════════════════════════════════════
// Matches against ANY path component (closest to the file wins).
// This is the PRIMARY categorization method — it catches bulk groups by install
// directory layout. For skills under `development/` with 227 sub-dirs, we rely
// on EXPLICIT_MAP below (step 3) since their parent directories are too varied.

const DIR_CATEGORY: Record<string, string> = {
  // ── Top-level directory groups ──
  "scientific":              "Scientific & Research",
  "ai-research":             "AI & LLMs",
  "business-marketing":      "Marketing & Business",
  "security":                "Security",
  "creative-design":         "Frontend & Design",
  "enterprise-communication": "Enterprise & Compliance",
  "career":                  "Marketing & Business",
  "productivity":            "Productivity & Automation",
  "workflow-automation":     "Productivity & Automation",
  "web-development":         "Frontend & Design",
  "database":                "Databases & Storage",
  // "media" intentionally omitted — conflicts with /run/media/ mount point in paths
  "railway":                 "DevOps & Cloud",
  "sentry":                  "Platform & Ecosystem",
  "pocketbase":              "Backend & API",
  "github":                  "Platform & Ecosystem",
  "ai-maestro":              "AI & LLMs",
  "web-data":                "Backend & API",
  "mlops":                   "AI & LLMs",
  "analytics":               "Marketing & Business",
  "gaming":                  "Frontend & Design",
  "git":                     "DevOps & Cloud",
  "devops":                  "DevOps & Cloud",
  "apple":                   "Frontend & Design",
  "autonomous-ai-agents":    "AI & LLMs",
  "video":                   "Frontend & Design",
  "marketing":               "Marketing & Business",
  "email":                   "Enterprise & Compliance",
  "data-science":            "AI & LLMs",
  "blockchain":              "Backend & API",
  "finance":                 "Marketing & Business",
  "health":                  "Scientific & Research",
  "research":                "Scientific & Research",
  "mcp":                     "Platform & Ecosystem",
  "note-taking":             "Productivity & Automation",
  "bundled":                 "Platform & Ecosystem",

  // ── Document skills — these names are unique enough to not collide with paths ──
  "document-skills":         "Documents & Office",
  "document-processing":     "Documents & Office",
  "spreadsheet":             "Documents & Office",
  // Individual doc format names (safe — short enough not to collide with mount paths)
  "docx":                    "Documents & Office",
  "pptx":                    "Documents & Office",
  "pdf":                     "Documents & Office",
  "xlsx":                    "Documents & Office",

  // ── Nested sub-directories that deserve their own category ──
  "game-development":        "Frontend & Design",
  "n8n":                     "Productivity & Automation",
  "sports":                  "Other",
  "smart-home":              "Other",
  "social-media":            "Marketing & Business",
  "red-teaming":             "Security",
  "dogfood":                 "Other",
  "migration":               "DevOps & Cloud",
  "plugins":                 "Platform & Ecosystem",
  "extensions":              "Platform & Ecosystem",
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. SKILL NAME PREFIX → CATEGORY
// ═══════════════════════════════════════════════════════════════════════════

const PREFIX_RULES: Array<[string, string]> = [
  ["9router-",  "Platform & Ecosystem"],
  ["baoyu-",    "Frontend & Design"],
  ["ph-",       "Marketing & Business"],
  ["ctx-",      "Platform & Ecosystem"],
  ["gr-",       "DevOps & Cloud"],
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. EXPLICIT NAME → CATEGORY OVERRIDES
// ═══════════════════════════════════════════════════════════════════════════
// Covers skills that aren't caught by directory mapping (e.g., the 227 skills
// under `development/` whose sub-directory names are too specific) plus
// any edge cases from other collections.

const EXPLICIT_MAP: Record<string, string> = {
  // ═════════════════════════════════════════════════════════════════
  // FRONTEND & DESIGN
  // Web/mobile/desktop frontend, UI/UX design, creative/media
  // ═════════════════════════════════════════════════════════════════
  // Development skills — frontend frameworks & patterns
  "angular":                   "Frontend & Design",
  "artifacts-builder":         "Frontend & Design",
  "cc-skill-frontend-patterns":"Frontend & Design",
  "core-components":           "Frontend & Design",
  "core-web-vitals":           "Frontend & Design",
  "design-system-starter":     "Frontend & Design",
  "frontend-dev-guidelines":   "Frontend & Design",
  "hook-development":          "Frontend & Design",
  "mermaid-diagram-specialist":"Frontend & Design",
  "mui":                       "Frontend & Design",
  "nextjs-best-practices":     "Frontend & Design",
  "nextjs-supabase-auth":      "Frontend & Design",
  "react-best-practices":      "Frontend & Design",
  "react-dev":                 "Frontend & Design",
  "react-patterns":            "Frontend & Design",
  "react-ui-patterns":         "Frontend & Design",
  "react-useeffect":           "Frontend & Design",
  "senior-frontend":           "Frontend & Design",
  "web-quality-audit":         "Frontend & Design",
  "web-to-markdown":           "Frontend & Design",
  "webapp-testing":            "Frontend & Design",
  "web-artifacts-builder":     "Frontend & Design",
  "i18n-localization":         "Frontend & Design",

  // Desktop UI frameworks
  "avalonia-layout-zafiro":    "Frontend & Design",
  "avalonia-viewmodels-zafiro":"Frontend & Design",
  "avalonia-zafiro-development": "Frontend & Design",

  // Mobile/Desktop skills
  "flutter-expert":            "Frontend & Design",
  "swift-concurrency-expert":  "Frontend & Design",
  "kotlin-coroutines-expert":  "Frontend & Design",
  "android-cicd":              "Frontend & Design",

  // Frontend-specific from other collections
  "frontend-design":           "Frontend & Design",
  "canvas-design":             "Frontend & Design",
  "web-design-guidelines":     "Frontend & Design",
  "tailwind-design-system":    "Frontend & Design",
  "tailwind-patterns":         "Frontend & Design",
  "premium-web-design":        "Frontend & Design",
  "scroll-experience":         "Frontend & Design",
  "interactive-portfolio":     "Frontend & Design",
  "claude-d3js-skill":         "Frontend & Design",
  "develop-web-game":          "Frontend & Design",
  "diagrammer":                "Frontend & Design",
  "draw-io":                   "Frontend & Design",
  "excalidraw":                "Frontend & Design",
  "mermaid-diagrams":          "Frontend & Design",
  "marp-slide":                "Frontend & Design",
  "mobile-design":             "Frontend & Design",
  "ui-ux-pro-max":             "Frontend & Design",
  "ux-researcher-designer":    "Frontend & Design",
  "wireframe-sketch":          "Frontend & Design",
  "pm-spec":                   "Frontend & Design",
  "live-artifact":             "Frontend & Design",
  "remotion-best-practices":   "Frontend & Design",
  "mobile-app":                "Frontend & Design",
  "mobile-onboarding":         "Frontend & Design",
  "motion-frames":             "Frontend & Design",
  "pricing-page":              "Frontend & Design",
  "saas-landing":              "Frontend & Design",
  "web-prototype":             "Frontend & Design",
  "impeccable":                "Frontend & Design",
  "design-brief":              "Frontend & Design",
  "design-taste-frontend":     "Frontend & Design",
  "extract-design-system":     "Frontend & Design",
  "tweaks":                    "Frontend & Design",
  "dashboard":                 "Frontend & Design",
  "figma":                     "Frontend & Design",
  "figma-code-connect":        "Frontend & Design",
  "figma-create-new-file":     "Frontend & Design",
  "figma-generate-design":     "Frontend & Design",
  "figma-generate-diagram":    "Frontend & Design",
  "figma-generate-library":    "Frontend & Design",
  "figma-implement-design":    "Frontend & Design",
  "figma-implement-motion":    "Frontend & Design",
  "figma-swiftui":             "Frontend & Design",
  "figma-use":                 "Frontend & Design",
  "figma-use-figjam":          "Frontend & Design",
  "figma-use-motion":          "Frontend & Design",
  "figma-use-slides":          "Frontend & Design",
  "baoyu-design":              "Frontend & Design",

  // Creative / Media / Game dev
  "3d-web-experience":         "Frontend & Design",
  "algorithmic-art":           "Frontend & Design",
  "imagegen":                  "Frontend & Design",
  "luma-imagegen":             "Frontend & Design",
  "meme-factory":              "Frontend & Design",
  "slack-gif-creator":         "Frontend & Design",
  "theme-factory":             "Frontend & Design",
  "c4-architecture":           "Frontend & Design",
  "accessibility-auditor":     "Frontend & Design",
  "brand-guidelines":          "Frontend & Design",
  "brand-guidelines-anthropic":"Frontend & Design",
  "brand-guidelines-community":"Frontend & Design",
  "executing-marketing-campaigns": "Frontend & Design",
  "accessibility":             "Frontend & Design",
  "critique":                  "Frontend & Design",
  "open-design":               "Frontend & Design",
  "ui-design-system":          "Frontend & Design",

  // Video/Media production
  "hyperframes":               "Frontend & Design",
  "video":                     "Frontend & Design",
  "manim":                     "Frontend & Design",
  "motion-canvas":             "Frontend & Design",
  "remotion":                  "Frontend & Design",
  "sora":                      "Frontend & Design",
  "screenshot":                "Frontend & Design",
  "image-enhancer":            "Frontend & Design",
  "speech":                    "Frontend & Design",
  "transcribe":                "Frontend & Design",
  "video-downloader":          "Frontend & Design",

  // Flutter-specific (frontend mobile)
  "add-dart-lint-validation-rule":  "Frontend & Design",
  "dart-skills-lint-integration":  "Frontend & Design",
  "dart-skills-lint-setup":        "Frontend & Design",
  "dart-skills-lint-validation":   "Frontend & Design",
  "definition-of-done":            "Frontend & Design",
  "flutter-add-integration-test":  "Frontend & Design",
  "flutter-add-widget-preview":    "Frontend & Design",
  "flutter-add-widget-test":       "Frontend & Design",
  "flutter-apply-architecture-best-practices": "Frontend & Design",
  "flutter-build-responsive-layout":   "Frontend & Design",
  "flutter-fix-layout-issues":         "Frontend & Design",
  "flutter-implement-json-serialization": "Frontend & Design",
  "flutter-setup-declarative-routing":   "Frontend & Design",
  "flutter-setup-localization":          "Frontend & Design",
  "flutter-use-http-package":           "Frontend & Design",
  "grill-with-docs":                     "Frontend & Design",
  "natural-writing":                     "Frontend & Design",

  // ═════════════════════════════════════════════════════════════════
  // BACKEND & API
  // Server-side, APIs, general languages, architecture
  // ═════════════════════════════════════════════════════════════════
  // Development skills — backend frameworks & patterns
  "backend-dev-guidelines":    "Backend & API",
  "backend-architect":         "Backend & API",
  "senior-backend":            "Backend & API",
  "senior-fullstack":          "Backend & API",
  "api-design-principles":     "Backend & API",
  "api-documentation-generator":"Backend & API",
  "api-integration-specialist":"Backend & API",
  "api-patterns":              "Backend & API",
  "nodejs-backend-patterns":   "Backend & API",
  "nodejs-best-practices":     "Backend & API",
  "fastapi-pro":               "Backend & API",
  "django-pro":                "Backend & API",
  "nestjs-expert":             "Backend & API",
  "laravel-expert":            "Backend & API",
  "python-patterns":           "Backend & API",
  "python-pro":                "Backend & API",
  "python-testing-patterns":   "Backend & API",
  "cc-skill-backend-patterns": "Backend & API",
  "cc-skill-clickhouse-io":    "Backend & API",
  "cc-skill-coding-standards": "Backend & API",
  "microservices-patterns":    "Backend & API",
  "graphql":                   "Backend & API",
  "graphql-architect":         "Backend & API",
  "domain-driven-design":      "Backend & API",
  "event-sourcing-architect":  "Backend & API",
  "software-architecture":     "Backend & API",
  "context-architecture":      "Backend & API",
  "architecture":              "Backend & API",
  "architecture-decision-records": "Backend & API",
  "architecture-patterns":     "Backend & API",
  "saas-multi-tenant":         "Backend & API",
  "claude-api":                "Backend & API",
  "moodle-external-api-development": "Backend & API",
  "openapi-to-typescript":     "Backend & API",
  "stripe-integration":        "Backend & API",
  "plaid-fintech":             "Backend & API",
  "clerk-auth":                "Backend & API",
  "convex":                    "Backend & API",
  "bullmq-specialist":         "Backend & API",
  "brightdata-local-search":   "Backend & API",
  "feature-design-assistant":  "Backend & API",
  "server-management":         "Backend & API",
  "screenshot-feature-extractor": "Backend & API",
  "task-execution-engine":     "Backend & API",
  "systematic-debugging":      "Backend & API",
  "error-resolver":            "Backend & API",
  "performance":               "Backend & API",
  "performance-profiling":     "Backend & API",
  "production-code-audit":     "Backend & API",
  "verification-before-completion": "Backend & API",
  "clean-code":                "Backend & API",
  "best-practices":            "Backend & API",
  "bleu":                      "Backend & API",
  "senior-architect":          "Backend & API",
  "senior-qa":                 "Backend & API",
  "code-reviewer":             "Backend & API",
  "code-review-checklist":     "Backend & API",
  "receiving-code-review":     "Backend & API",
  "requesting-code-review":    "Backend & API",
  "cc-skill-continuous-learning": "Backend & API",
  "cc-skill-project-guidelines-example": "Backend & API",
  "cc-skill-strategic-compact": "Backend & API",
  "move-code-quality":         "Backend & API",

  // General programming languages
  "typescript-expert":         "Backend & API",
  "typescript-pro":            "Backend & API",
  "javascript-mastery":        "Backend & API",
  "javascript-pro":            "Backend & API",
  "javascript-testing-patterns":"Backend & API",
  "golang-pro":                "Backend & API",
  "rust-pro":                  "Backend & API",
  "rust-cli-builder":          "Backend & API",
  "java-pro":                  "Backend & API",
  "csharp-pro":                "Backend & API",
  "dotnet-backend":            "Backend & API",
  "php-pro":                   "Backend & API",
  "ruby-pro":                  "Backend & API",
  "scala-pro":                 "Backend & API",
  "elixir-pro":                "Backend & API",
  "haskell-pro":               "Backend & API",
  "c-pro":                     "Backend & API",
  "cpp-pro":                   "Backend & API",
  "bun-development":           "Backend & API",
  "bash-linux":                "Backend & API",
  "bash-pro":                  "Backend & API",
  "linux-shell-scripting":     "Backend & API",
  "powershell-windows":        "Backend & API",
  "claude-opus-4-5-migration": "Backend & API",
  "salesforce-development":    "Backend & API",

  // Other backend skills from various collections
  "backend-to-frontend-handoff-docs": "Backend & API",
  "frontend-to-backend-requirements": "Backend & API",

  // ═════════════════════════════════════════════════════════════════
  // DEVOPS & CLOUD
  // Infrastructure, deployment, CI/CD, containers, monitoring
  // ═════════════════════════════════════════════════════════════════
  // Development skills — cloud & infra
  "docker-expert":             "DevOps & Cloud",
  "kubernetes-architect":      "DevOps & Cloud",
  "cloud-architect":           "DevOps & Cloud",
  "cloud-devops":              "DevOps & Cloud",
  "cloud-run-basics":          "DevOps & Cloud",
  "gcp-cloud-run":             "DevOps & Cloud",
  "gke-basics":                "DevOps & Cloud",
  "aws-serverless":            "DevOps & Cloud",
  "azure-functions":           "DevOps & Cloud",
  "google-cloud-networking-observability": "DevOps & Cloud",
  "google-cloud-onboarding":   "DevOps & Cloud",
  "google-cloud-waf-cost-optimization":   "DevOps & Cloud",
  "google-cloud-waf-reliability":         "DevOps & Cloud",
  "helm-chart-scaffolding":    "DevOps & Cloud",
  "prometheus-configuration":  "DevOps & Cloud",
  "grafana-dashboards":        "DevOps & Cloud",
  "devops-iac-engineer":       "DevOps & Cloud",
  "terraform-specialist":      "DevOps & Cloud",
  "observability-engineer":    "DevOps & Cloud",
  "incident-responder":        "DevOps & Cloud",
  "it-operations":             "DevOps & Cloud",
  "deployment-procedures":     "DevOps & Cloud",
  "environment-setup-guide":   "DevOps & Cloud",
  "cloudflare-deploy":         "DevOps & Cloud",
  "vercel-deploy":             "DevOps & Cloud",
  "vercel-deployment":         "DevOps & Cloud",
  "netlify-deploy":            "DevOps & Cloud",
  "render-deploy":             "DevOps & Cloud",
  "monorepo-architect":        "DevOps & Cloud",
  "dependency-updater":        "DevOps & Cloud",
  "finishing-a-development-branch": "DevOps & Cloud",
  "github-actions-creator":    "DevOps & Cloud",
  "github-workflow-automation":"DevOps & Cloud",
  "gh-address-comments":       "DevOps & Cloud",
  "gh-fix-ci":                 "DevOps & Cloud",
  "git-commit-helper":         "DevOps & Cloud",
  "git-pushing":               "DevOps & Cloud",
  "using-git-worktrees":       "DevOps & Cloud",
  "worktree-guide":            "DevOps & Cloud",
  "k6-load-testing":           "DevOps & Cloud",
  "lint-and-validate":         "DevOps & Cloud",
  "senior-devops":             "DevOps & Cloud",
  "cc-skill-security-review":  "DevOps & Cloud",

  // Deploy & CI from agent-skills / Vercel
  "deploy-to-vercel":          "DevOps & Cloud",
  "vercel-cli-with-tokens":    "DevOps & Cloud",
  "vercel-optimize":           "DevOps & Cloud",
  "composition-patterns":      "DevOps & Cloud",
  "vercel-composition-patterns": "DevOps & Cloud",
  "vercel-react-best-practices": "DevOps & Cloud",
  "vercel-react-native-skills":  "DevOps & Cloud",

  // Testing frameworks (CI-adjacent)
  "playwright":                "DevOps & Cloud",
  "playwright-e2e-builder":    "DevOps & Cloud",
  "playwright-java":           "DevOps & Cloud",
  "tdd-orchestrator":          "DevOps & Cloud",
  "tdd-workflow":              "DevOps & Cloud",
  "test-detect":               "DevOps & Cloud",
  "test-driven-development":   "DevOps & Cloud",
  "test-fixing":               "DevOps & Cloud",
  "testing-patterns":          "DevOps & Cloud",
  "e2e-testing-patterns":      "DevOps & Cloud",
  "senior-secops":             "DevOps & Cloud",
  "web-security-testing":      "DevOps & Cloud",

  // Railway-specific
  "railway-docs":              "DevOps & Cloud",
  "railway-database":          "Databases & Storage",
  "railway-deploy":            "DevOps & Cloud",
  "railway-deployment":        "DevOps & Cloud",
  "railway-domain":            "DevOps & Cloud",
  "railway-environment":       "DevOps & Cloud",
  "railway-metrics":           "DevOps & Cloud",
  "railway-new":               "DevOps & Cloud",
  "railway-projects":          "DevOps & Cloud",
  "railway-service":           "DevOps & Cloud",
  "railway-status":            "DevOps & Cloud",
  "railway-templates":         "DevOps & Cloud",

  // ═════════════════════════════════════════════════════════════════
  // DATABASES & STORAGE
  // Database technologies, data modeling, ORMs
  // ═════════════════════════════════════════════════════════════════
  "database-design":           "Databases & Storage",
  "database-schema-designer":  "Databases & Storage",
  "postgres-best-practices":   "Databases & Storage",
  "neon-postgres":             "Databases & Storage",
  "nosql-expert":              "Databases & Storage",
  "prisma-expert":             "Databases & Storage",
  "firebase":                  "Databases & Storage",
  "firebase-basics":           "Databases & Storage",
  "algolia-search":            "Databases & Storage",

  // Database-specific skills
  "alloydb-basics":            "Databases & Storage",
  "bigquery-basics":           "Databases & Storage",
  "cloud-sql-basics":          "Databases & Storage",
  "database-architect":        "Databases & Storage",
  "database-migration":        "Databases & Storage",
  "database-optimizer":        "Databases & Storage",
  "neon-instagres":            "Databases & Storage",
  "postgresql":                "Databases & Storage",
  "postgresql-optimization":   "Databases & Storage",
  "sql-pro":                   "Databases & Storage",
  "supabase-postgres-best-practices": "Databases & Storage",
  "using-neon":                "Databases & Storage",

  // PocketBase
  "pb-api-rules":              "Databases & Storage",
  "pb-collections":            "Databases & Storage",
  "pb-deploy":                 "Databases & Storage",
  "pb-hooks":                  "Databases & Storage",
  "pb-migrations":             "Databases & Storage",
  "pb-sdk":                    "Databases & Storage",

  // ═════════════════════════════════════════════════════════════════
  // SECURITY
  // Pentesting, vulnerability assessment, security best practices
  // ═════════════════════════════════════════════════════════════════
  "security-compliance":       "Security",
  "senior-security":           "Security",
  "api-fuzzing-bug-bounty":    "Security",
  "api-security-best-practices": "Security",
  "api-security-testing":      "Security",
  "aws-penetration-testing":   "Security",
  "broken-authentication":     "Security",
  "burp-suite-testing":        "Security",
  "cloud-penetration-testing": "Security",
  "ethical-hacking-methodology":"Security",
  "file-path-traversal":       "Security",
  "file-uploads":              "Security",
  "google-cloud-auth":         "Security",
  "google-cloud-waf-security": "Security",
  "html-injection-testing":    "Security",
  "idor-testing":              "Security",
  "linux-privilege-escalation":"Security",
  "metasploit-framework":      "Security",
  "pentest-checklist":         "Security",
  "pentest-commands":          "Security",
  "privilege-escalation-methods":"Security",
  "red-team-tactics":          "Security",
  "red-team-tools":            "Security",
  "sast-configuration":        "Security",
  "scanning-tools":            "Security",
  "secrets-management":        "Security",
  "security-audit":            "Security",
  "security-best-practices":   "Security",
  "security-ownership-map":    "Security",
  "security-threat-model":     "Security",
  "shodan-reconnaissance":     "Security",
  "smtp-penetration-testing":  "Security",
  "sql-injection-testing":     "Security",
  "sqlmap-database-pentesting":"Security",
  "ssh-penetration-testing":   "Security",
  "supply-chain-guard":        "Security",
  "threat-modeling-expert":    "Security",
  "top-web-vulnerabilities":   "Security",
  "vulnerability-scanner":     "Security",
  "windows-privilege-escalation":"Security",
  "wireshark-analysis":        "Security",
  "wordpress-penetration-testing":"Security",
  "xss-html-injection":        "Security",
  "active-directory-attacks":  "Security",
  "web-security-testing":      "Security",

  // ═════════════════════════════════════════════════════════════════
  // AI & LLMs
  // AI agents, LLMs, ML, prompt engineering, data science
  // ═════════════════════════════════════════════════════════════════
  // Development skills — AI/ML adjacent
  "jupyter-notebook":          "AI & LLMs",
  "senior-computer-vision":    "AI & LLMs",
  "senior-data-engineer":      "AI & LLMs",
  "senior-data-scientist":     "AI & LLMs",
  "senior-ml-engineer":        "AI & LLMs",
  "senior-prompt-engineer":    "AI & LLMs",
  "subagent-driven-development":"AI & LLMs",
  "dispatching-parallel-agents":"AI & LLMs",
  "swarmvault":                "AI & LLMs",
  "heygen-best-practices":     "AI & LLMs",
  "cocoindex":                 "AI & LLMs",
  "seo":                       "Marketing & Business", // SEO is marketing
  "agent-development":         "AI & LLMs",
  "agent-md-refactor":         "AI & LLMs",

  // AI Maestro
  "agent-management":          "AI & LLMs",
  "agent-messaging":           "AI & LLMs",
  "docs-search":               "AI & LLMs",
  "graph-query":               "AI & LLMs",
  "memory-search":             "AI & LLMs",
  "planning":                  "AI & LLMs",

  // Claude Code related
  "claude-code-guide":         "AI & LLMs",
  "claude-code-sessions":      "AI & LLMs",

  // 9router
  "9router":                   "Platform & Ecosystem",
  "9router-chat":              "Platform & Ecosystem",
  "9router-embeddings":        "Platform & Ecosystem",
  "9router-image":             "Platform & Ecosystem",
  "9router-stt":               "Platform & Ecosystem",
  "9router-tts":               "Platform & Ecosystem",
  "9router-web-fetch":         "Platform & Ecosystem",
  "9router-web-search":        "Platform & Ecosystem",

  // ═════════════════════════════════════════════════════════════════
  // SCIENTIFIC & RESEARCH
  // Bioinformatics, chemistry, physics, research tools
  // ═════════════════════════════════════════════════════════════════
  // Scientific skills (covered mostly by DIR_CATEGORY, just adding edge cases)
  "data-engineer":             "Scientific & Research",
  "data-scientist":            "Scientific & Research",
  "research-engineer":         "Scientific & Research",
  "ml-engineer":               "Scientific & Research",
  "literature-review":         "Scientific & Research",
  "research-grants":           "Scientific & Research",
  "research-lookup":           "Scientific & Research",
  "scholar-evaluation":        "Scientific & Research",
  "scientific-brainstorming":  "Scientific & Research",
  "scientific-critical-thinking":"Scientific & Research",
  "scientific-schematics":     "Scientific & Research",
  "scientific-slides":         "Scientific & Research",
  "scientific-visualization":  "Scientific & Research",
  "scientific-writing":        "Scientific & Research",
  "peer-review":               "Scientific & Research",
  "paper-2-web":               "Scientific & Research",
  "citation-management":       "Scientific & Research",
  "clinical-decision-support": "Scientific & Research",
  "clinical-reports":          "Scientific & Research",
  "treatment-plans":           "Scientific & Research",
  "venue-templates":           "Scientific & Research",
  "market-research-reports":   "Scientific & Research",
  "hypothesis-generation":     "Scientific & Research",
  "exploratory-data-analysis": "Scientific & Research",
  "statistical-analysis":      "Scientific & Research",
  "get-available-resources":   "Scientific & Research",
  "perplexity-search":         "Scientific & Research",

  // ═════════════════════════════════════════════════════════════════
  // DOCUMENTS & OFFICE
  // Document creation/editing, office formats
  // ═════════════════════════════════════════════════════════════════
  "doc-coauthoring":           "Documents & Office",
  "markitdown":                "Documents & Office",
  "latex-posters":             "Documents & Office",
  "pptx-posters":              "Documents & Office",
  "pdf-fill-studio":           "Documents & Office",
  "pdf-processing":            "Documents & Office",
  "pdf-processing-pro":        "Documents & Office",
  "doc":                       "Documents & Office",
  "documentation-templates":   "Documents & Office",
  "obsidian-bases":            "Productivity & Automation",
  "obsidian-markdown":         "Productivity & Automation",
  "obsidian-cli":              "Productivity & Automation",
  "json-canvas":               "Productivity & Automation",
  "obsidian-clipper-template-creator": "Productivity & Automation",

  // ═════════════════════════════════════════════════════════════════
  // MARKETING & BUSINESS
  // Marketing, SEO, growth, product, career
  // ═════════════════════════════════════════════════════════════════
  // Career skills
  "academic-cv-builder":       "Marketing & Business",
  "career-changer-translator": "Marketing & Business",
  "cover-letter-generator":    "Marketing & Business",
  "creative-portfolio-resume": "Marketing & Business",
  "executive-resume-writer":   "Marketing & Business",
  "interview-prep-generator":  "Marketing & Business",
  "job-description-analyzer":  "Marketing & Business",
  "linkedin-profile-optimizer":"Marketing & Business",
  "offer-comparison-analyzer": "Marketing & Business",
  "portfolio-case-study-writer":"Marketing & Business",
  "reference-list-builder":    "Marketing & Business",
  "resume-ats-optimizer":      "Marketing & Business",
  "resume-bullet-writer":      "Marketing & Business",
  "resume-formatter":          "Marketing & Business",
  "resume-quantifier":         "Marketing & Business",
  "resume-section-builder":    "Marketing & Business",
  "resume-tailor":             "Marketing & Business",
  "resume-version-manager":    "Marketing & Business",
  "tech-resume-optimizer":     "Marketing & Business",
  "salary-negotiation-prep":   "Marketing & Business",
  "workorai":                  "Marketing & Business",

  // Product / Business
  "product-manager-toolkit":   "Marketing & Business",
  "product-strategist":        "Marketing & Business",
  "ceo-advisor":               "Marketing & Business",
  "cto-advisor":               "Marketing & Business",
  "developer-growth-analysis": "Marketing & Business",
  "hubspot-integration":       "Marketing & Business",
  "excel-analysis":            "Marketing & Business",
  "plaid":                     "Marketing & Business",
  "gtm":                       "Marketing & Business",

  // ═════════════════════════════════════════════════════════════════
  // PRODUCTIVITY & AUTOMATION
  // Workflow automation, note-taking, planning
  // ═════════════════════════════════════════════════════════════════
  // Development skills — planning & workflow
  "brainstorming":             "Productivity & Automation",
  "create-plan":               "Productivity & Automation",
  "executing-plans":           "Productivity & Automation",
  "writing-plans":             "Productivity & Automation",
  "writing-skills":            "Productivity & Automation",
  "changelog-generator":       "Productivity & Automation",
  "zapier-workflows":          "Productivity & Automation",
  "command-creator":           "Productivity & Automation",
  "command-development":       "Productivity & Automation",
  "skill-creation-guide":      "Productivity & Automation",
  "skill-creator":             "Productivity & Automation",
  "skill-development":         "Productivity & Automation",
  "skill-installer":           "Productivity & Automation",
  "using-superpowers":         "Productivity & Automation",

  // Productivity skills
  "address-github-comments":   "Productivity & Automation",
  "commit-work":               "Productivity & Automation",
  "concise-planning":          "Productivity & Automation",
  "crafting-effective-readmes":"Productivity & Automation",
  "deadline-prep":             "Productivity & Automation",
  "debugger":                  "Productivity & Automation",
  "debugging-strategies":      "Productivity & Automation",
  "file-organizer":            "Productivity & Automation",
  "game-changing-features":    "Productivity & Automation",
  "humanizer":                 "Productivity & Automation",
  "invoice-organizer":         "Productivity & Automation",
  "kaizen":                    "Productivity & Automation",
  "linear":                    "Productivity & Automation",
  "meeting-insights-analyzer": "Productivity & Automation",
  "naming-analyzer":           "Productivity & Automation",
  "notebooklm":                "Productivity & Automation",
  "notion-knowledge-capture":  "Productivity & Automation",
  "notion-meeting-intelligence":"Productivity & Automation",
  "notion-research-documentation":"Productivity & Automation",
  "notion-spec-to-implementation":"Productivity & Automation",
  "notion-template-business":  "Productivity & Automation",
  "nowait":                    "Productivity & Automation",
  "performance-optimizer":     "Productivity & Automation",
  "personal-tool-builder":     "Productivity & Automation",
  "planning-with-files":       "Productivity & Automation",
  "plan-writing":              "Productivity & Automation",
  "raffle-winner-picker":      "Productivity & Automation",
  "reducing-entropy":          "Productivity & Automation",
  "requirements-clarity":      "Productivity & Automation",
  "ship-learn-next":           "Productivity & Automation",
  "skill-judge":               "Productivity & Automation",
  "think-tank":                "Productivity & Automation",
  "writing-rules":             "Productivity & Automation",

  // n8n (workflow automation)
  "n8n-code-javascript":       "Productivity & Automation",
  "n8n-code-python":           "Productivity & Automation",
  "n8n-expression-syntax":     "Productivity & Automation",
  "n8n-mcp-tools-expert":      "Productivity & Automation",
  "n8n-node-configuration":    "Productivity & Automation",
  "n8n-validation-expert":     "Productivity & Automation",
  "n8n-workflow-patterns":     "Productivity & Automation",
  "workflow-automation":       "Productivity & Automation",
  "yeet":                      "Productivity & Automation",
  "zapier-make-patterns":      "Productivity & Automation",
  "trigger-dev":               "Productivity & Automation",
  "slack-automation":          "Productivity & Automation",
  "jira-automation":           "Productivity & Automation",
  "linear-automation":         "Productivity & Automation",
  "dependabot-review":         "Productivity & Automation",
  "github-automation":         "Productivity & Automation",
  "gitops-workflow":           "Productivity & Automation",
  "github-workflow-automation":"Productivity & Automation",
  "inngest":                   "Productivity & Automation",

  // ═════════════════════════════════════════════════════════════════
  // ENTERPRISE & COMPLIANCE
  // Compliance, quality, regulatory, internal comms
  // ═════════════════════════════════════════════════════════════════
  "capa-officer":              "Enterprise & Compliance",
  "daily-meeting-update":      "Enterprise & Compliance",
  "data-privacy-compliance":   "Enterprise & Compliance",
  "difficult-workplace-conversations":"Enterprise & Compliance",
  "discord-bot-architect":     "Enterprise & Compliance",
  "email-composer":            "Enterprise & Compliance",
  "fda-consultant-specialist": "Enterprise & Compliance",
  "feedback-mastery":          "Enterprise & Compliance",
  "gdpr-dsgvo-expert":         "Enterprise & Compliance",
  "information-security-manager-iso27001":"Enterprise & Compliance",
  "internal-comms":            "Enterprise & Compliance",
  "internal-comms-anthropic":  "Enterprise & Compliance",
  "internal-comms-community":  "Enterprise & Compliance",
  "isms-audit-expert":         "Enterprise & Compliance",
  "mdr-745-specialist":        "Enterprise & Compliance",
  "professional-communication":"Enterprise & Compliance",
  "qms-audit-expert":          "Enterprise & Compliance",
  "quality-documentation-manager":"Enterprise & Compliance",
  "quality-manager-qmr":       "Enterprise & Compliance",
  "quality-manager-qms-iso13485":"Enterprise & Compliance",
  "regulatory-affairs-head":   "Enterprise & Compliance",
  "risk-management-specialist":"Enterprise & Compliance",
  "session-handoff":           "Enterprise & Compliance",
  "slack-bot-builder":         "Enterprise & Compliance",
  "telegram-bot-builder":      "Enterprise & Compliance",
  "telegram-mini-app":         "Enterprise & Compliance",
  "twilio-communications":     "Enterprise & Compliance",
  "writing-clearly-and-concisely":"Enterprise & Compliance",

  // ═════════════════════════════════════════════════════════════════
  // PLATFORM & ECOSYSTEM
  // Pi, Sentry, GitHub, MCP, platform-specific tools
  // ═════════════════════════════════════════════════════════════════
  // Pi Meta / Pi ecosystem
  "confidence-check":          "Platform & Ecosystem",
  "delegation":                "Platform & Ecosystem",
  "feature-spec":              "Platform & Ecosystem",
  "spec-tator":                "Platform & Ecosystem",
  "find-skills":               "Platform & Ecosystem",
  "foreground-chains":         "Platform & Ecosystem",
  "os":                        "Platform & Ecosystem",
  "orchestration":             "Platform & Ecosystem",
  "pam":                       "Platform & Ecosystem",
  "release-skills":            "Platform & Ecosystem",
  "prompt-template-authoring": "Platform & Ecosystem",
  "council":                   "Platform & Ecosystem",
  "pi-interactive-shell":      "Platform & Ecosystem",
  "pi-intercom":               "Platform & Ecosystem",
  "pi-memory":                 "Platform & Ecosystem",
  "librarian":                 "Platform & Ecosystem",
  "design-deck":               "Platform & Ecosystem",
  "lesson-capture":            "Platform & Ecosystem",
  "reflexion":                 "Platform & Ecosystem",
  "reflect-maintenance":       "Platform & Ecosystem",
  "context-mode":              "Platform & Ecosystem",

  // MCP / API tools
  "mcp-builder":               "Platform & Ecosystem",
  "mcp-integration":           "Platform & Ecosystem",
  "fastmcp-server":            "Platform & Ecosystem",
  "manifest":                  "Platform & Ecosystem",

  // Plugin systems
  "plugin-forge":              "Platform & Ecosystem",
  "plugin-settings":           "Platform & Ecosystem",
  "plugin-structure":          "Platform & Ecosystem",

  // Sentry
  "sentry-code-review":        "Platform & Ecosystem",
  "sentry-commit":             "Platform & Ecosystem",
  "sentry-create-pr":          "Platform & Ecosystem",
  "sentry-deslop":             "Platform & Ecosystem",
  "sentry-find-bugs":          "Platform & Ecosystem",
  "sentry-iterate-pr":         "Platform & Ecosystem",

  // GitHub skills
  "commit-smart":              "Platform & Ecosystem",
  "git-context-controller":    "Platform & Ecosystem",

  // Project-specific / Other
  "agirails-agent-payments":   "Backend & API",
  "building-components":       "Frontend & Design",

  // Top-level Anthropic skills
  "skill-creator":             "Productivity & Automation",
  "write-good":                "Productivity & Automation",
  "writing-guidelines":        "Productivity & Automation",
  "react-best-practices":      "Frontend & Design",
  "react-native-skills":       "Frontend & Design",
  "react-view-transitions":    "Frontend & Design",
  "react-native-architecture": "Frontend & Design",
  "next-best-practices":       "Frontend & Design",
  "next-cache-components":     "Frontend & Design",
  "next-upgrade":              "Frontend & Design",

  // Hermes-agent miscellaneous
  "antigravity-cli":           "AI & LLMs",
  "blackbox":                  "AI & LLMs",
  "grok":                      "AI & LLMs",
  "honcho":                    "AI & LLMs",
  "openhands":                 "AI & LLMs",
  "evm":                       "Backend & API",
  "hyperliquid":               "Backend & API",
  "solana":                    "Backend & API",
  "one-three-one-rule":        "Enterprise & Compliance",
  "blender-mcp":               "Frontend & Design",
  "concept-diagrams":          "Frontend & Design",
  "kanban-video-orchestrator": "Frontend & Design",
  "meme-generation":           "Frontend & Design",
  "cli":                       "DevOps & Cloud",
  "docker-management":         "DevOps & Cloud",
  "pinggy-tunnel":             "DevOps & Cloud",
  "watchers":                  "DevOps & Cloud",
  "adversarial-ux-test":       "Frontend & Design",
  "agentmail":                 "Enterprise & Compliance",

  // ── Utility skills (not caught by DIR_CATEGORY anymore) ──
  "browser-automation":        "DevOps & Cloud",
  "browser-extension-builder": "Frontend & Design",
  "busybox-on-windows":        "DevOps & Cloud",
  "cf-crawl":                  "Backend & API",
  "domain-name-brainstormer":  "Marketing & Business",
  "geo-fundamentals":          "Marketing & Business",
  "Network 101":               "DevOps & Cloud",
  "playwright-skill":          "DevOps & Cloud",
  "skill-share":              "Platform & Ecosystem",
  "template-skill":            "Productivity & Automation",
  "using-superpowers":         "Productivity & Automation",
  "web-artifacts-builder":     "Frontend & Design",

  // ── Media skills (removed from DIR_CATEGORY — no mount-point collisions) ──
  "manim":                     "Frontend & Design",
  "motion-canvas":             "Frontend & Design",
  "remotion":                  "Frontend & Design",
  "sora":                      "Frontend & Design",


  // ── Remaining uncategorized edge cases ──
  "gmod-addon-maker":          "Frontend & Design",
  "footballbin-predictions":   "Other",
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. DESCRIPTION KEYWORD → CATEGORY (fallback)
// ═══════════════════════════════════════════════════════════════════════════

const KEYWORD_RULES: Array<[string[], string]> = [
  // Frontend & Design
  [[
    "react", "nextjs", "vue", "svelte", "astro", "angular",
    "frontend", "front-end", "css", "tailwind", "shadcn",
    "ui design", "design system", "figma", "ui/ux", "ux researcher",
    "wireframe", "prototype", "webgl", "three.js", "canvas",
    "web component", "accessibility", "a11y",
    "responsive", "web design", "landing page",
    "component library", "storybook",
    "animation", "motion", "transition",
    "game dev", "game development", "gamedev",
    "3d", "three js", "webgl",
    "image generation", "image gen",
  ], "Frontend & Design"],

  // Backend & API
  [[
    "api", "backend", "server", "server-side",
    "rest api", "graphql", "microservice", "grpc",
    "node.js", "nodejs", "express", "fastapi", "django", "laravel",
    "spring boot", "rails", "asp.net",
    "serverless function", "lambda",
    "service-oriented", "soa", "event-driven",
    "api gateway", "webhook", "endpoint",
    "backend architecture", "system design",
  ], "Backend & API"],

  // DevOps & Cloud
  [[
    "docker", "kubernetes", "k8s", "container",
    "terraform", "ansible", "pulumi",
    "ci/cd", "continuous integration", "continuous deployment",
    "github actions", "gitlab ci", "jenkins",
    "cloud", "aws", "gcp", "azure", "cloud run",
    "deploy", "deployment", "release",
    "monitoring", "observability", "prometheus", "grafana",
    "helm", "istio", "envoy",
    "devops", "sre", "site reliability",
    "infrastructure", "iac", "infra",
    "load testing", "k6",
  ], "DevOps & Cloud"],

  // Databases & Storage
  [[
    "database", "sql", "postgresql", "postgres", "mysql",
    "nosql", "mongodb", "redis", "dynamodb",
    "prisma", "drizzle", "typeorm",
    "supabase", "pocketbase", "neon",
    "firebase", "firestore",
    "data modeling", "schema design",
    "migration", "orm",
    "bigquery", "clickhouse", "redshift", "snowflake",
    "data warehouse", "data lake",
  ], "Databases & Storage"],

  // Security
  [[
    "security", "pentest", "penetration test",
    "vulnerability", "cve", "exploit",
    "threat modeling", "threat model",
    "red team", "blue team",
    "owasp", "xss", "sql injection", "csrf",
    "authentication", "authorization", "oauth",
    "encryption", "cryptography",
    "compliance", "audit",
    "wireshark", "burp suite", "metasploit",
    "bug bounty", "ethical hacking",
  ], "Security"],

  // AI & LLMs
  [[
    "ai", "artificial intelligence",
    "llm", "large language model",
    "machine learning", "ml", "deep learning",
    "neural network", "transformer",
    "rag", "retrieval augmented",
    "fine-tuning", "fine tuning",
    "prompt engineering", "prompt",
    "agent", "multi-agent", "autonomous agent",
    "embedding", "vector",
    "training", "inference",
    "data science", "data scientist",
    "nlp", "natural language",
    "computer vision", "cv",
    "reinforcement learning", "rl",
    "mlops", "model serving",
    "vllm", "sglang", "tensorrt",
    "pytorch", "tensorflow", "jax",
    "langchain", "langgraph", "crewai",
  ], "AI & LLMs"],

  // Scientific & Research
  [[
    "bioinformatics", "genomics", "proteomics",
    "chemistry", "cheminformatics", "drug",
    "clinical", "trial", "database",
    "scientific", "research",
    "laboratory", "lab", "experiment",
    "molecular", "protein", "gene",
    "physics", "quantum",
    "matplotlib", "seaborn", "plotly",
    "statistics", "statistical",
    "publication", "peer review", "paper",
    "pipeline", "workflow", "biopython",
  ], "Scientific & Research"],

  // Documents & Office
  [[
    "docx", "word document", "word doc",
    "pptx", "powerpoint", "slide deck", "presentation",
    "pdf", "portable document",
    "xlsx", "spreadsheet", "excel", "csv",
    "document processing", "document creation",
    "markdown", "pandoc",
    "office", "document",
    "form fill", "pdf form",
    "ocr", "optical character",
  ], "Documents & Office"],

  // Marketing & Business
  [[
    "marketing", "seo", "growth", "conversion",
    "cro", "a/b test", "ab test",
    "content marketing", "copywriting",
    "social media", "email campaign",
    "paid ads", "ppc", "google ads",
    "product launch", "go-to-market", "gtm",
    "product management", "product strategy",
    "resume", "cv", "cover letter",
    "career", "interview", "job",
    "competitor analysis", "market research",
    "brand", "branding",
    "sales", "lead generation",
    "analytics", "metrics", "kpi",
  ], "Marketing & Business"],

  // Productivity & Automation
  [[
    "workflow", "automation",
    "n8n", "zapier", "make", "integromat",
    "obsidian", "notion",
    "note-taking", "notes",
    "productivity", "planning",
    "brainstorm", "brainstorming",
    "todo", "task management",
    "gtd", "getting things done",
    "calendar", "scheduling",
    "linear", "jira", "asana", "trello",
    "browser automation", "puppeteer",
    "cli tool", "command line",
    "template", "scaffold",
  ], "Productivity & Automation"],

  // Enterprise & Compliance
  [[
    "compliance", "gdpr", "iso", "regulatory",
    "quality management", "qms",
    "iso 13485", "iso 27001",
    "audit", "risk management",
    "internal comms", "communication",
    "slack bot", "discord bot", "telegram bot",
    "email", "email composer",
    "data privacy", "data protection",
    "fda", "mdr", "hipaa", "sox",
    "workplace", "meeting",
  ], "Enterprise & Compliance"],

  // Platform & Ecosystem
  [[
    "pi coding agent", "pi-agent", "pi extension",
    "extension", "plugin",
    "mcp", "model context protocol",
    "sentry", "error tracking",
    "github", "git",
    "9router", "router",
    "subagent", "intercom",
    "skill manager", "skill deck",
  ], "Platform & Ecosystem"],
];

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIZE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determine the category for a skill given its name, description, and file path.
 *
 * Strategy (applied in order):
 *   1. Parent directory name match (DIR_CATEGORY)
 *   2. Skill name prefix match (PREFIX_RULES)
 *   3. Explicit name override (EXPLICIT_MAP)
 *   4. Description keyword match (KEYWORD_RULES)
 *   5. "Other" fallback
 */
export function categorizeSkill(name: string, description: string, filePath: string): string {
  // 1. Parent directory name (iterate from end for closest-first)
  const parts = filePath.replace(/\\/g, "/").split("/");
  for (let i = parts.length - 1; i >= 0; i--) {
    const dir = parts[i].toLowerCase();
    if (DIR_CATEGORY[dir]) return DIR_CATEGORY[dir];
  }

  // 2. Prefix match
  for (const [prefix, cat] of PREFIX_RULES) {
    if (name.startsWith(prefix)) return cat;
  }

  // 3. Explicit map (case-insensitive, normalized: space/underscore → hyphen)
  const normalizedName = name.toLowerCase().replace(/[\s_]+/g, '-');
  if (EXPLICIT_MAP[normalizedName]) return EXPLICIT_MAP[normalizedName];

  // 4. Description keyword match
  const lowerDesc = description.toLowerCase();
  for (const [keywords, cat] of KEYWORD_RULES) {
    if (keywords.some((kw) => lowerDesc.includes(kw.toLowerCase()))) return cat;
  }

  // 5. Fallback
  return "Other";
}

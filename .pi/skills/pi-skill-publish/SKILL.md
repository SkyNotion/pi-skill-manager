---
name: pi-skill-publish
description: Reusable workflow for packaging a Pi extension/skill for public release, publishing to GitHub + npm, and submitting to community platforms.
---

# Pi Skill Publish

Reusable workflow for packaging a Pi extension/skill for public release, publishing
to GitHub + npm, and submitting to community platforms.

## When to Use

Trigger on: "publish this skill", "release this package", "make this public",
"submit to community", "publish to npm", "share this extension", "package for release".

## Workflow

### Step 1: Validate Package

Check the project root for required files:

| File | Required | Check |
|------|----------|-------|
| `package.json` | ✅ | Must have `name`, `version`, `description`, `"keywords": ["pi-package"]`, `license`, `repository.url`, `"pi": { "extensions": [...] }` |
| `README.md` | ✅ | Must exist and include: feature list, install command, usage, screenshot/preview |
| `LICENSE` | ✅ | Must exist (MIT recommended for Pi ecosystem) |
| `index.ts` or extension entry | ✅ | Must match `pi.extensions` path in package.json |
| `.gitignore` | ⚠️ | Recommended: `node_modules/`, `*.log`, `.DS_Store` |
| `CHANGELOG.md` | ⚠️ | Recommended for releases after v0.1.0 |

**Validation actions:**
1. Read `package.json` and verify all required fields
2. If `"keywords"` doesn't include `"pi-package"`, add it (required for pi.dev/packages discovery)
3. Ensure `repository.url` points to the correct GitHub URL
4. Verify the extension entry file exists and exports a default function
5. Check README has an `## Installation` section with `pi install` command

Report any issues before proceeding. Fix automatically if confidence ≥ 90%.

### Step 2: Polish README

Ensure the README contains these sections in order:

```markdown
# {emoji} {package-name}
> One-line description

![preview](preview.png)    ← screenshot/preview image

## ✨ Features                ← bullet list of capabilities
## 📦 Installation            ← pi install command + manual settings.json
## 🚀 Usage                   ← slash command + keyboard shortcuts
## 🔍 How it works            ← technical details (optional but recommended)
## ⚙️ Configuration           ← customization options (if any)
## 🤝 Contributing            ← PR welcome note
## 📄 License                 ← license + author link
```

**Screenshot handling:**
- If user provides a screenshot/image, copy it to the repo root as `preview.png`
- Add `![preview](preview.png)` after the tagline in README
- The raw GitHub URL (`https://raw.githubusercontent.com/{owner}/{repo}/{branch}/preview.png`) is used for external embeds

### Step 3: Publish to GitHub

```bash
# 1. Stage and commit any changes from Steps 1-2
cd {project_root}
git add -A
git commit -m "docs: prepare for public release v{version}"

# 2. Create public GitHub repo (if not exists)
gh repo create {owner}/{repo} \
  --public \
  --source=. \
  --remote=origin \
  --description="{description}" \
  --push

# 3. Tag and create release
git tag v{version}
git push origin v{version}
gh release create v{version} \
  --title "v{version} — {release_title}" \
  --notes "{release_notes}"
```

### Step 4: Publish to npm (optional but recommended)

npm publish is the primary gateway to:
- **pi.dev/packages** — the official Pi package catalog (auto-discovers `pi-package` keyword)
- **awesome-pi-coding-agent** — auto-generated community directory (scrapes npm daily)

```bash
# Check npm auth
npm whoami

# If not logged in:
npm login
# or: npm adduser

# Publish (public, unscoped)
npm publish --access public
```

**If user is not logged into npm:** Flag it as a manual follow-up action.
Do NOT block the rest of the workflow on npm auth.

### Step 4b: Publish to GitHub Packages (mandatory)

**Always dual-publish to GitHub Packages** so the package appears on Ben's
GitHub profile Packages tab. This runs immediately after Step 4.

```powershell
cd {project_root}
$GH_TOKEN = gh auth token

# Temp .npmrc for GitHub Packages auth
"@cymatistatic:registry=https://npm.pkg.github.com`n//npm.pkg.github.com/:_authToken=$GH_TOKEN" | Set-Content .npmrc

# Temporarily scope the package name
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); fs.writeFileSync('package.json.bak',JSON.stringify(p,null,2)); p.name='@cymatistatic/'+p.name.replace('@cymatistatic/',''); p.publishConfig={registry:'https://npm.pkg.github.com'}; fs.writeFileSync('package.json',JSON.stringify(p,null,2));"

# Publish to GitHub Packages
npm publish

# Restore original package.json and clean up
mv package.json.bak package.json
rm .npmrc
```

**Requires:** `gh auth` must have `write:packages` scope.
If missing: `gh auth refresh -h github.com -s write:packages`

**Verify:** `gh api user/packages?package_type=npm --jq '.[].name'`

### Step 5: Submit to Communities

Execute all applicable submissions:

#### 5a. Pi GitHub Discussions (earendel-works/pi)

Create a showcase post in the General category:

```bash
gh api graphql -f query='mutation {
  createDiscussion(input: {
    repositoryId: "R_kgDOPbFNkw",
    categoryId: "DIC_kwDOPbFNk84Cz0vb",
    title: "{emoji} {package-name} — {short_description}",
    body: "{discussion_body}"
  }) { discussion { url } }
}'
```

Discussion body template:
```markdown
## {package-name}

{one-paragraph description}

![preview](https://raw.githubusercontent.com/{owner}/{repo}/{branch}/preview.png)

### Features
{bullet list}

### Install
\```
pi install {owner}/{repo}
\```

Or add to `~/.pi/agent/settings.json`:
\```json
"packages": ["github:{owner}/{repo}"]
\```

Then type `/{command}` in any Pi session.

**Repo:** https://github.com/{owner}/{repo}
**License:** {license}
```

#### 5b. awesome-pi-coding-agent (if on npm)

The [awesome-pi-coding-agent](https://github.com/shaftoe/awesome-pi-coding-agent) list
auto-discovers npm packages with the `pi-package` keyword daily. If the package is
published to npm, it will appear automatically — no PR needed.

If NOT on npm, open a PR to add a manual entry:

```bash
gh repo fork shaftoe/awesome-pi-coding-agent --clone
# Add entry to README.md under ## Extensions section
# Follow the table format: | Health | Name | Description | Popularity | Updated |
gh pr create --title "Add {package-name}" --body "..."
```

#### 5c. Reddit / Social (optional templates)

**r/PiCodingAgent post:**
```
🎴 pi-skill-deck — categorized skill browser with bookmarks & frecency

Replaces the flat skill list with a two-pane TUI. Features:
- Categories, search, bookmarks (Ctrl+B), Top 10, daily suggestions
- Scans all standard skill locations automatically

Install: `pi install {owner}/{repo}`
Repo: https://github.com/{owner}/{repo}
```

**Twitter/X post:**
```
🎴 Just shipped {package-name} for @PiCodingAgent

{one-line pitch}

pi install {owner}/{repo}

{screenshot_url}
```

### Step 6: Report

```
[PUBLISH REPORT]
Package:     {package-name} v{version}
GitHub:      https://github.com/{owner}/{repo} ✅
Release:     v{version} ✅
npm:         {published | ⚠️ needs npm login}
Discussion:  {url} ✅
Awesome PR:  {url | skipped (not on npm)}
Reddit:      {posted | template ready}

Follow-up:
- [ ] npm login + npm publish (for pi.dev/packages auto-discovery)
- [ ] Post to Reddit/X/Discord
```

## Community Submission Targets (Reference)

| Platform | URL | How to submit |
|----------|-----|---------------|
| pi.dev/packages | https://pi.dev/packages | Auto-discovered from npm (`pi-package` keyword) |
| awesome-pi-coding-agent | https://github.com/shaftoe/awesome-pi-coding-agent | Auto from npm; manual PR for GitHub-only |
| Pi Discussions | https://github.com/earendil-works/pi/discussions | Create discussion (General category) |
| skills.sh | https://skills.sh | `npx skills publish` (for SKILL.md-based skills) |
| Reddit | r/PiCodingAgent | Post with template |
| X / Twitter | — | Post with screenshot |
| Discord | Pi community server | Share in #showcase or #extensions |

## Notes

- The `pi-package` keyword in `package.json` is critical — it's how pi.dev/packages auto-discovers extensions
- GitHub-only packages work for `pi install github:{owner}/{repo}` but miss the npm auto-discovery channels
- npm publish unlocks 3 distribution channels at once (pi.dev, awesome list, npm search)
- Always include a screenshot — visual packages get significantly more engagement

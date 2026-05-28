/**
 * SKILL.md body extraction.
 *
 * Strips frontmatter, then tries to surface a clean "what it does"
 * excerpt for the DETAILS box. Strategy:
 *
 *   1. Look for an explicit section heading:
 *        About / Overview / What it does / Description / Purpose /
 *        Summary / Usage / Use cases
 *      If found, take its content up to the next heading.
 *   2. Otherwise, take the first 1–2 non-heading body paragraphs.
 *   3. If neither yields anything substantial, return empty excerpt
 *      and mark the body as "thin" so the UI can flag it.
 *
 * Operates on already-loaded content (no extra fs reads) so the scanner
 * can extract excerpts without doubling its I/O.
 */

import * as fs from "node:fs";

const ABOUT_SECTION_REGEX = /^#{1,3}\s+(About|Overview|What it does|Description|Purpose|Summary|Usage|Use cases)\b/i;

export interface SkillBody {
  body: string;                 // Full body content (frontmatter stripped)
  excerpt: string;              // Best-effort "what it does" excerpt
  hasExplicitSection: boolean;  // Did we find an About-style heading?
  isThin: boolean;              // Body is too short to be useful
}

/** Strip --- frontmatter --- from the top of a markdown file. */
function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content;
  const end = content.indexOf("\n---", 3);
  return end === -1 ? content : content.slice(end + 4).trimStart();
}

/** Extract a "what it does" excerpt from raw SKILL.md content. */
export function extractBodyFromContent(content: string): SkillBody {
  const body = stripFrontmatter(content).trim();
  if (!body) {
    return { body: "", excerpt: "", hasExplicitSection: false, isThin: true };
  }

  const lines = body.split("\n");

  // 1. Look for an explicit About-style section
  let sectionStart = -1;
  let sectionEnd = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (ABOUT_SECTION_REGEX.test(lines[i])) {
      sectionStart = i + 1;
      for (let j = sectionStart; j < lines.length; j++) {
        if (/^#{1,3}\s+/.test(lines[j])) {
          sectionEnd = j;
          break;
        }
      }
      break;
    }
  }

  let excerpt = "";
  let hasExplicitSection = false;
  if (sectionStart !== -1) {
    excerpt = lines.slice(sectionStart, sectionEnd).join("\n").trim();
    hasExplicitSection = true;
  }

  // 2. Fallback: first 1-2 PROSE body paragraphs (skip headings, code, lists, blockquotes)
  if (!excerpt) {
    const paras = body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p && isProsePara(p));
    excerpt = paras.slice(0, 2).join("\n\n").trim();
  }

  // 3. Last resort: if still nothing, take the first content paragraph of any kind
  if (!excerpt) {
    const paras = body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p && !p.startsWith("#"));
    excerpt = paras.slice(0, 1).join("\n\n").trim();
  }

  // Normalize: collapse multi-space within paragraphs but keep para breaks
  excerpt = excerpt
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");

  // Hard cap so the detail box stays sane (~500 chars ≈ 5-7 wrapped lines)
  if (excerpt.length > 600) {
    excerpt = excerpt.slice(0, 600).replace(/\s+\S*$/, "") + "…";
  }

  // "Thin" = body too short, excerpt missing, excerpt too short, OR excerpt
  // is purely code/list/quote fragments (no prose).
  const isThin =
    body.length < 200 ||
    !excerpt ||
    excerpt.length < 100 ||
    !isProsePara(excerpt);

  return { body, excerpt, hasExplicitSection, isThin };
}

/**
 * True when a paragraph looks like prose (not a code block, bullet list,
 * numbered list, blockquote, or metadata line).
 */
function isProsePara(p: string): boolean {
  const t = p.trim();
  if (!t) return false;
  if (t.startsWith("#")) return false;                           // heading
  if (t.startsWith("```") || t.startsWith("~~~")) return false; // code fence
  if (/^[-*+]\s/.test(t)) return false;                          // bullet list
  if (/^\d+[.)]\s/.test(t)) return false;                        // numbered list
  if (t.startsWith(">")) return false;                           // blockquote
  if (t.startsWith("|")) return false;                           // table row
  if (/^[A-Za-z][A-Za-z0-9_ -]{0,30}:\s*\S/.test(t.split("\n")[0]) && t.length < 80) return false; // metadata line
  // Heuristic: needs at least 3 "words" (whitespace-delimited tokens).
  // For CJK content where words aren't space-delimited, accept 20+ chars.
  const words = t.split(/\s+/).length;
  if (words < 3 && t.length < 20) return false;
  return true;
}

/** Convenience: read file and extract excerpt. */
export function extractBody(filePath: string): SkillBody {
  try {
    return extractBodyFromContent(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return { body: "", excerpt: "", hasExplicitSection: false, isThin: true };
  }
}

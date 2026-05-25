#!/usr/bin/env node
/**
 * scripts/auto-translate.mjs
 *
 * Fills empty `en:` fields in src/content/projects/*.md by calling
 * the MyMemory free translation API on the corresponding `ar:` text.
 *
 * Runs as part of the GitHub Actions workflow before `astro build`.
 * Commits the filled-in translations back to the repo on `main` so
 * the next build has the data baked in.
 *
 * HOW THE FILE IS WALKED
 * ----------------------
 * Each project file looks like:
 *
 *   ---
 *   id: roads-jalaa
 *   title:
 *     ar: "تأهيل شارع الجلاء"
 *     en: ""
 *   description:
 *     ar: "..."
 *     en: ""
 *   ---
 *
 * We parse the frontmatter, recursively walk every object that has both
 * `ar` and `en` keys, and when `en` is empty we replace it with a
 * translation. We also set `en_auto: true` on the same object so the
 * public site can flag it as machine-translated.
 *
 * SAFETY
 * ------
 * - If MyMemory rejects a request, we leave the field empty and continue.
 *   The build still succeeds; the loc() helper falls back to AR.
 * - We rate-limit ourselves to one request per 250ms to be a good citizen.
 * - We log every translation we make so commits are reviewable.
 * - We only touch fields where `en` is empty — never overwrite a human edit.
 *
 * USAGE
 * -----
 *   node scripts/auto-translate.mjs
 *
 * Env vars:
 *   MYMEMORY_EMAIL  (optional) — raises daily limit from 5k to 50k chars.
 *                                  Set as a repo secret in GitHub.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const PROJECTS_DIR = path.resolve('src/content/projects');
const RATE_LIMIT_MS = 250;
const MAX_QUERY_BYTES = 480; // MyMemory caps at 500 bytes; keep safety margin
const EMAIL = process.env.MYMEMORY_EMAIL || '';

let translationsAttempted = 0;
let translationsSucceeded = 0;
let translationsFailed = 0;

async function translate(arText) {
  // Skip empty strings
  if (!arText || !arText.trim()) return null;

  // MyMemory rejects requests > 500 bytes; truncate longer ones with a warning
  let q = arText;
  if (Buffer.byteLength(q, 'utf8') > MAX_QUERY_BYTES) {
    // Truncate to ~480 bytes worth of UTF-8 — cut to the nearest space
    while (Buffer.byteLength(q, 'utf8') > MAX_QUERY_BYTES) {
      q = q.slice(0, -1);
    }
    const lastSpace = q.lastIndexOf(' ');
    if (lastSpace > 100) q = q.slice(0, lastSpace) + '…';
    console.warn(`  ⚠ Truncated long text from ${Buffer.byteLength(arText, 'utf8')} to ${Buffer.byteLength(q, 'utf8')} bytes`);
  }

  const params = new URLSearchParams({ q, langpair: 'ar|en' });
  if (EMAIL) params.set('de', EMAIL);
  const url = `https://api.mymemory.translated.net/get?${params}`;

  translationsAttempted++;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  ✗ HTTP ${res.status} for: "${arText.slice(0, 40)}…"`);
      translationsFailed++;
      return null;
    }
    const data = await res.json();
    if (data.responseStatus !== 200) {
      console.warn(`  ✗ API ${data.responseStatus}: ${data.responseDetails} for "${arText.slice(0, 40)}…"`);
      translationsFailed++;
      return null;
    }
    const text = data.responseData?.translatedText;
    if (!text || text.toUpperCase().startsWith('MYMEMORY WARNING')) {
      // MyMemory returns warning strings when it can't translate something
      console.warn(`  ✗ No usable translation for "${arText.slice(0, 40)}…": ${text}`);
      translationsFailed++;
      return null;
    }
    translationsSucceeded++;
    console.log(`  ✓ "${arText.slice(0, 30)}…" → "${text.slice(0, 30)}…"`);
    return text;
  } catch (err) {
    console.warn(`  ✗ Network error: ${err.message} for "${arText.slice(0, 40)}…"`);
    translationsFailed++;
    return null;
  } finally {
    // Rate-limit ourselves regardless of success/failure
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }
}

/**
 * Recursively walk a parsed YAML object, finding every { ar, en } pair
 * where `en` is empty/missing and filling it via translation.
 *
 * Mutates the object in place. Returns the number of fields filled.
 */
async function walkAndTranslate(node) {
  if (!node || typeof node !== 'object') return 0;
  let filled = 0;

  if (Array.isArray(node)) {
    for (const item of node) {
      filled += await walkAndTranslate(item);
    }
    return filled;
  }

  // Is this a bilingual object?
  if ('ar' in node && 'en' in node && typeof node.ar === 'string') {
    const enEmpty = !node.en || (typeof node.en === 'string' && !node.en.trim());
    if (enEmpty && node.ar.trim()) {
      const translation = await translate(node.ar);
      if (translation) {
        node.en = translation;
        // Mark this translation as machine-generated so the public site
        // can show a small "auto-translated" badge.
        node.en_auto = true;
        filled++;
      }
    }
    // Don't recurse into ar/en themselves — they're strings
    return filled;
  }

  // Otherwise, walk every value of this object
  for (const key of Object.keys(node)) {
    filled += await walkAndTranslate(node[key]);
  }
  return filled;
}

/**
 * Parse a Markdown file with YAML frontmatter, run the translator over
 * the frontmatter, and write the file back if anything changed.
 */
async function processFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');

  // Split out the frontmatter between the two `---` lines.
  // We only translate inside the frontmatter; body text is left alone.
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    console.log(`  - Skipping ${path.basename(filePath)} (no frontmatter)`);
    return 0;
  }
  const [, frontmatterText, body] = match;
  let frontmatter;
  try {
    frontmatter = parseYaml(frontmatterText);
  } catch (err) {
    console.warn(`  ✗ YAML parse error in ${path.basename(filePath)}: ${err.message}`);
    return 0;
  }

  const filled = await walkAndTranslate(frontmatter);
  if (filled === 0) return 0;

  // Re-emit the frontmatter. We use yaml.stringify with options that match
  // the existing file style (double-quoted strings).
  const newFrontmatter = stringifyYaml(frontmatter, {
    lineWidth: 0,
    defaultStringType: 'QUOTE_DOUBLE',
    defaultKeyType: 'PLAIN',
  });
  const newContent = `---\n${newFrontmatter}---\n${body}`;
  await fs.writeFile(filePath, newContent, 'utf-8');
  console.log(`  → ${path.basename(filePath)}: filled ${filled} field(s)`);
  return filled;
}

async function main() {
  console.log('Auto-translate: scanning project files for empty EN fields…');
  console.log(`MyMemory email: ${EMAIL ? '(set)' : '(not set — limited to 5,000 chars/day)'}`);
  console.log('');

  let files;
  try {
    files = await fs.readdir(PROJECTS_DIR);
  } catch (err) {
    console.error(`Cannot read ${PROJECTS_DIR}: ${err.message}`);
    process.exit(1);
  }

  const mdFiles = files.filter(f => f.endsWith('.md')).sort();
  let totalFilled = 0;
  for (const f of mdFiles) {
    console.log(`\n${f}:`);
    const filled = await processFile(path.join(PROJECTS_DIR, f));
    totalFilled += filled;
  }

  console.log('');
  console.log('────────────────────────────────────────');
  console.log(`Files scanned:           ${mdFiles.length}`);
  console.log(`Fields filled:           ${totalFilled}`);
  console.log(`Translation attempts:    ${translationsAttempted}`);
  console.log(`Translations succeeded:  ${translationsSucceeded}`);
  console.log(`Translations failed:     ${translationsFailed}`);
  console.log('────────────────────────────────────────');

  if (translationsAttempted > 0 && translationsSucceeded === 0) {
    // All attempts failed — likely hit rate limit or network issue.
    // Exit non-zero so the workflow can surface the problem without blocking deploy.
    console.error('All translation attempts failed; check rate limits or network.');
    process.exit(2);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

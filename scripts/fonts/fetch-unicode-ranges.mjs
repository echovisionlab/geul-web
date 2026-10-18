#!/usr/bin/env node
/**
 * Records the unicode-range slices Google Fonts serves for the reference families. The slices are
 * frequency ordered (a short Hangul or Han text needs a few of them), so `build-fonts.mjs` cuts the
 * Geul font system along the same boundaries. Run when a reference family changes; the build itself
 * never contacts Google.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const REFERENCE_FAMILIES = [
  'Noto Sans',
  'Noto Sans KR',
  'Noto Sans JP',
  'Noto Sans Arabic',
  'Noto Sans Thai',
  'Noto Sans SC',
  'Noto Sans TC',
  'Noto Color Emoji',
];
// Google varies its CSS by browser; a current Chrome receives the sliced WOFF2 variant.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

async function slicesOf(family) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}`;
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(`${family}: ${response.status}`);
  }
  const css = await response.text();
  const slices = [];
  // Script subsets carry a `/* latin */` comment; frequency slices are numbered only in their file name.
  for (const match of css.matchAll(/(?:\/\*\s*([^*]+?)\s*\*\/\s*)?@font-face\s*{([^}]*)}/g)) {
    const range = /unicode-range:\s*([^;]+);/.exec(match[2]);
    const sequence = /\.(\d+)\.woff2\)/.exec(match[2]);
    if (range) {
      slices.push({ name: match[1] ?? `[${sequence?.[1] ?? slices.length}]`, unicodeRange: range[1].trim() });
    }
  }
  if (slices.length === 0) {
    throw new Error(`${family}: no slices`);
  }
  return slices;
}

const result = {};
for (const family of REFERENCE_FAMILIES) {
  result[family] = await slicesOf(family);
  console.log(`${family}: ${result[family].length} slices`);
}
const target = fileURLToPath(new URL('./unicode-ranges.json', import.meta.url));
await writeFile(target, `${JSON.stringify(result, null, 2)}\n`);

#!/usr/bin/env node
/**
 * Builds the Geul font system into `.artifacts/fonts/dist`: content-hashed WOFF2 slices and
 * profile stylesheets whose `@font-face` rules carry exact unicode-ranges and relative URLs for
 * the planned `static.rawsector.com/fonts/` host. Sources are pinned and verified (`fonts.config.mjs`); slice
 * boundaries come from `unicode-ranges.json`.
 *
 *   node scripts/fonts/build-fonts.mjs [--only sans,mono]
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import subsetFont from 'subset-font';
import { Blob, Face } from 'harfbuzzjs';
import { families, stylesheets, localeProfiles, sources, profileStacks, WEIGHTS } from './fonts.config.mjs';
import { claimPoints, compressRange, faceRules } from './font-ranges.mjs';

const { values } = parseArgs({ options: { only: { type: 'string' }, help: { type: 'boolean' } } });

if (values.help) {
  console.log(
    'Usage: pnpm fonts:build [--only sans,mono]\nBuilds the Noto system. --only creates an incomplete development build.',
  );
  process.exit(0);
}

const require = createRequire(import.meta.url);
const fontverter = createRequire(require.resolve('subset-font'))('fontverter');

const root = fileURLToPath(new URL('../../', import.meta.url));
const cacheDir = join(root, '.artifacts/fonts/cache');
const distDir = join(root, '.artifacts/fonts/dist');
const ranges = JSON.parse(await readFile(new URL('./unicode-ranges.json', import.meta.url), 'utf8'));
const only = values.only?.split(',') ?? null;
if (only && only.some((slug) => !families.some((family) => family.slug === slug))) {
  throw new Error('--only requires known family slugs, e.g. --only sans,mono');
}

function digest(algorithm, data, encoding = 'hex') {
  return createHash(algorithm).update(data).digest(encoding);
}

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** Verifies a pinned source before caching it. */
async function fetchSource(id, source) {
  const directory = join(cacheDir, id);
  await mkdir(directory, { recursive: true });
  const file = join(directory, 'source.ttf');
  const local = source.localFile ? join(root, '.artifacts/fonts/sources', source.localFile) : null;
  const data = existsSync(file)
    ? await readFile(file)
    : local && existsSync(local)
      ? await readFile(local)
      : await download(source.url);
  if (digest('sha256', data) !== source.sha256) throw new Error(`${id}: sha256 mismatch`);
  await writeFile(file, data);
  return directory;
}

/** Loads a source as uncompressed SFNT per weight. A variable source serves the whole weight range. */
async function loadSource(id) {
  const source = sources[id];
  const directory = await fetchSource(id, source);
  const read = async (file) => fontverter.convert(await readFile(join(directory, file ?? 'source.ttf')), 'sfnt');
  if (source.variable) {
    return {
      variable: true,
      axes: source.variable.axes ?? {},
      fonts: { [WEIGHTS[0]]: await read(source.variable.file) },
    };
  }
  const fonts = {};
  for (const [weight, file] of Object.entries(source.weights)) {
    fonts[weight] = await read(file);
  }
  return { variable: false, axes: {}, fonts };
}

function codePointsOf(sfnt) {
  const face = new Face(new Blob(sfnt), 0);
  return new Set(face.collectUnicodes());
}

const loaded = new Map();
async function sourceOf(id) {
  if (!loaded.has(id)) {
    const source = await loadSource(id);
    source.codePoints = codePointsOf(Object.values(source.fonts)[0]);
    for (const font of Object.values(source.fonts).slice(1)) {
      const points = codePointsOf(font);
      source.codePoints = new Set([...source.codePoints].filter((point) => points.has(point)));
    }
    loaded.set(id, source);
  }
  return loaded.get(id);
}

// Verify every required source before replacing generated output.
const selectedFamilies = families.filter((candidate) => !only || only.includes(candidate.slug));
for (const family of selectedFamilies) {
  for (const part of family.parts) await sourceOf(part.source);
}
await rm(distDir, { recursive: true, force: true });
const outputDir = join(distDir, 'fonts');
const faces = [];
const files = [];
for (const family of selectedFamilies) {
  const covered = new Set();
  await mkdir(join(outputDir, family.slug), { recursive: true });
  for (const part of family.parts) {
    const source = await sourceOf(part.source);
    const slices = [
      ...ranges[part.reference].filter((slice) => !part.slices || part.slices.includes(slice.name)),
      ...(part.extraRanges ?? []).map((unicodeRange) => ({ name: 'supplemental', unicodeRange })),
    ];
    for (const slice of slices) {
      const points = claimPoints(slice.unicodeRange, source.codePoints, covered, part.filter);
      if (points.length === 0) {
        continue;
      }
      const text = String.fromCodePoint(...points);
      for (const [weight, sfnt] of Object.entries(source.fonts)) {
        const axes = source.variable ? { ...source.axes, wght: { min: WEIGHTS[0], max: WEIGHTS.at(-1) } } : undefined;
        const woff2 = await subsetFont(sfnt, text, { targetFormat: 'woff2', noHinting: true, variationAxes: axes });
        const name = `${digest('sha256', woff2).slice(0, 16)}.woff2`;
        await writeFile(join(outputDir, family.slug, name), woff2);
        // Identical single-weight descriptors let Latin and static script slices form composite faces.
        const weights = source.variable ? WEIGHTS : [Number(weight)];
        faces.push(
          ...faceRules(family.name, `${family.slug}/${name}`, points, source.variable, weight).map((rule) => ({
            key: `${family.slug}:${part.source}`,
            rule,
          })),
        );
        files.push({
          family: family.slug,
          part: part.source,
          slice: slice.name,
          weights,
          file: name,
          bytes: woff2.length,
          codePoints: points.length,
          unicodeRange: compressRange(points),
        });
      }
    }
    console.log(`${family.name} ← ${part.source}: ${covered.size} code points`);
  }
}

const written = {};
const stylesheetSizes = {};
for (const [profile, keys] of Object.entries(stylesheets)) {
  const css = `${faces
    .filter((face) => keys.includes(face.key))
    .map((face) => face.rule)
    .join('\n')}\n`;
  const name = `geul-${profile}.${digest('sha256', css).slice(0, 16)}.css`;
  await writeFile(join(outputDir, name), css);
  written[profile] = name;
  stylesheetSizes[profile] = { bytes: Buffer.byteLength(css), brotliBytes: brotliCompressSync(css).length };
  console.log(`${name}: ${(css.length / 1024).toFixed(0)} KiB`);
}
const total = files.reduce((sum, file) => sum + file.bytes, 0);
console.log(`${files.length} slices, ${(total / 1024 / 1024).toFixed(1)} MiB in total → ${outputDir}`);

await mkdir(join(outputDir, 'licenses'), { recursive: true });
await writeFile(
  join(outputDir, 'licenses', 'OFL-1.1.txt'),
  await readFile(new URL('./licenses/OFL-1.1.txt', import.meta.url)),
);
for (const [id, source] of Object.entries(sources)) {
  if (!files.some((file) => file.part === id)) continue;
  const notice = source.copyright + '\n\nSIL Open Font License 1.1: see OFL-1.1.txt.\n';
  await writeFile(join(outputDir, 'licenses', `${id}.txt`), notice);
}
await writeFile(
  join(outputDir, 'sources.json'),
  JSON.stringify(
    Object.fromEntries(Object.entries(sources).filter(([id]) => files.some((file) => file.part === id))),
    null,
    2,
  ) + '\n',
);
await writeFile(
  join(outputDir, 'manifest.json'),
  `${JSON.stringify({ complete: !only, stylesheets: written, stylesheetSizes, profileStacks, files }, null, 2)}\n`,
);

// Partial development output must never replace the application's complete upload mapping.
if (!only) {
  const mapping = Object.fromEntries(
    Object.entries(localeProfiles).map(([locale, profile]) => [locale, written[profile]]),
  );
  const module = `// Generated by pnpm fonts:build. Do not edit.\nimport type { LocaleFontProfile } from '@/lib/i18n/locale';\n\nexport const geulFontStylesheets = ${JSON.stringify(mapping, null, 2)} as const satisfies Record<LocaleFontProfile, string>;\n`;
  const prettier = await import('prettier');
  const path = join(root, 'lib/styles/geul-fonts.generated.ts');
  await writeFile(path, await prettier.format(module, { ...(await prettier.resolveConfig(path)), filepath: path }));
}

#!/usr/bin/env node
// Checks built artifacts without downloading sources or launching a browser.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import { Blob, Face, Font, Buffer as ShapeBuffer, Variation, shape } from 'harfbuzzjs';
import postcss from 'postcss';
import subsetFont from 'subset-font';
import { families, stylesheets, localeProfiles, profileStacks, sources } from './fonts.config.mjs';
import { geulFontStylesheets } from '../../lib/styles/geul-fonts.generated.ts';
import { compressRange, expandRange } from './font-ranges.mjs';

parseArgs({ options: {} });

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const fontverter = createRequire(require.resolve('subset-font'))('fontverter');
const dist = `${root}.artifacts/fonts/dist/fonts/`;
const output = `${root}.artifacts/fonts/review/`;
const manifest = JSON.parse(await readFile(`${dist}manifest.json`, 'utf8'));
assert.equal(manifest.complete, true, 'Partial development build');
assert.deepEqual(Object.keys(manifest.stylesheets), Object.keys(stylesheets), 'Profile inventory');
assert.deepEqual(manifest.profileStacks, profileStacks);
assert.deepEqual(
  geulFontStylesheets,
  Object.fromEntries(
    Object.entries(localeProfiles).map(([locale, profile]) => [locale, manifest.stylesheets[profile]]),
  ),
  'Application mapping must match the complete built output',
);
const coverage = new Map();
const paths = new Set();
for (const file of manifest.files) {
  const path = `${file.family}/${file.file}`;
  assert.ok(!paths.has(path), `Repeated file record: ${path}`);
  paths.add(path);
  const bytes = await readFile(dist + path);
  assert.equal(bytes.length, file.bytes, path);
  assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0, 16) + '.woff2', file.file, path);
  const sfnt = await fontverter.convert(bytes, 'sfnt');
  const face = new Face(new Blob(sfnt));
  const actual = new Set(face.collectUnicodes());
  if (sources[file.part].variable) {
    const axes = face.getAxisInfos();
    assert.deepEqual(Object.keys(axes), ['wght'], `${path}: only weight must remain variable`);
    assert.equal(axes.wght.min, 400, path);
    assert.equal(axes.wght.max, 600, path);
    assert.deepEqual(file.weights, [400, 500, 600], path);
  }
  const points = expandRange(file.unicodeRange);
  assert.equal(points.length, file.codePoints, path);
  for (const point of points) assert.ok(actual.has(point), `${path}: missing U+${point.toString(16)}`);
  for (const weight of file.weights) {
    const key = `${file.family}:${weight}`;
    if (!coverage.has(key)) coverage.set(key, new Set());
    const seen = coverage.get(key);
    for (const point of points) {
      assert.ok(!seen.has(point), `${key}: duplicate U+${point.toString(16)}`);
      seen.add(point);
    }
  }
}
for (const family of families) {
  for (const part of family.parts) {
    assert.ok(
      manifest.files.some((file) => file.family === family.slug && file.part === part.source),
      `missing ${family.slug}/${part.source}`,
    );
  }
}
const sheets = {};
const profileCoverage = new Map();
for (const [profile, name] of Object.entries(manifest.stylesheets)) {
  const css = await readFile(dist + name, 'utf8');
  assert.equal(name.split('.')[1], createHash('sha256').update(css).digest('hex').slice(0, 16), `${profile}: CSS hash`);
  const seen = new Map();
  const urls = new Set();
  postcss.parse(css).walkAtRules('font-face', (rule) => {
    const props = Object.fromEntries(rule.nodes.map((node) => [node.prop, node.value]));
    assert.match(props['font-weight'], /^(400|500|600)$/);
    assert.equal(props['font-style'], 'normal');
    const family = props['font-family'].replaceAll("'", '');
    const url = /url\(([^)]+)\)/.exec(props.src)[1];
    assert.ok(paths.has(url), `${name}: unknown ${url}`);
    const record = manifest.files.find((file) => `${file.family}/${file.file}` === url);
    assert.equal(families.find((candidate) => candidate.slug === record.family)?.name, family);
    assert.ok(record.weights.includes(Number(props['font-weight'])), `${name}: wrong weight for ${url}`);
    assert.equal(props['unicode-range'], record.unicodeRange, `${name}: range for ${url}`);
    assert.equal(props['font-display'], 'swap');
    urls.add(url);
    const key = `${family}:${props['font-weight']}`;
    if (!seen.has(key)) seen.set(key, new Set());
    for (const point of expandRange(props['unicode-range'])) {
      assert.ok(!seen.get(key).has(point), `${name}: duplicate ${key} U+${point.toString(16)}`);
      seen.get(key).add(point);
    }
  });
  profileCoverage.set(profile, seen);
  const expected = new Map();
  for (const file of manifest.files.filter((f) => stylesheets[profile].includes(`${f.family}:${f.part}`))) {
    const family = families.find((candidate) => candidate.slug === file.family).name;
    for (const weight of file.weights) {
      const key = `${family}:${weight}`;
      if (!expected.has(key)) expected.set(key, new Set());
      for (const point of expandRange(file.unicodeRange)) expected.get(key).add(point);
    }
  }
  for (const family of profileStacks[profile]) {
    assert.ok(expected.has(`${family}:400`), `${profile}: missing stack family ${family}`);
  }
  assert.deepEqual(seen, expected, `${profile}: stylesheet must include every configured slice/weight`);
  for (const family of new Set([...seen.keys()].map((key) => key.split(':')[0]))) {
    if (family === 'Geul Emoji') continue;
    assert.deepEqual(seen.get(`${family}:400`), seen.get(`${family}:500`), `${profile}/${family}: weight coverage`);
    assert.deepEqual(seen.get(`${family}:400`), seen.get(`${family}:600`), `${profile}/${family}: weight coverage`);
  }
  assert.equal(seen.has('Geul Sans Han TC:400'), ['ko', 'zh-hant'].includes(profile), `${profile}: Han TC scope`);
  sheets[profile] = {
    file: name,
    bytes: Buffer.byteLength(css),
    brotliBytes: brotliCompressSync(css).length,
    fontFiles: urls.size,
  };
  assert.deepEqual(manifest.stylesheetSizes[profile], {
    bytes: sheets[profile].bytes,
    brotliBytes: sheets[profile].brotliBytes,
  });
}

const fallback = {};
for (const [profile, stack] of Object.entries(profileStacks)) {
  const available = new Set(stack.flatMap((name) => [...(profileCoverage.get(profile).get(`${name}:400`) ?? [])]));
  const blocks = {};
  for (const [block, from, to] of [
    ['jamo', 0x1100, 0x11ff],
    ['compatibilityJamo', 0x3130, 0x318f],
    ['jamoExtendedA', 0xa960, 0xa97f],
    ['jamoExtendedB', 0xd7b0, 0xd7ff],
    ['cjkPunctuation', 0x3000, 0x303f],
    ['fullwidthForms', 0xff00, 0xffef],
  ]) {
    const missing = Array.from({ length: to - from + 1 }, (_, i) => from + i).filter(
      (p) => !/\p{Unassigned}/u.test(String.fromCodePoint(p)) && !available.has(p),
    );
    blocks[block] = { missing: missing.length, unicodeRange: compressRange(missing) };
  }
  fallback[profile] = blocks;
}
for (const [script, text] of Object.entries({
  latin: 'Geul',
  cyrillic: 'Привет',
  greek: 'Ελληνικά',
  vietnamese: 'Tiếng Việt',
  hangul: '한글',
  arabic: 'العربية',
  thai: 'ภาษาไทย',
})) {
  for (const weight of [400, 500, 600]) {
    for (const char of text)
      assert.ok(coverage.get(`sans:${weight}`).has(char.codePointAt(0)), `${script}/${weight}: ${char}`);
  }
}
for (const point of [0x6f22, 0x5b57]) {
  assert.ok(!coverage.get('sans:400').has(point), 'Hanja must use a Han family');
  assert.ok(coverage.get('han-tc:400').has(point), 'TC must cover sample Hanja');
}

function shaped(sfnt, text, variations) {
  const face = new Face(new Blob(sfnt));
  assert.ok(face.referenceTable('GSUB')?.length, 'Missing GSUB');
  assert.ok(face.referenceTable('GPOS')?.length, 'Missing GPOS');
  const font = new Font(face);
  if (variations) font.setVariations(Object.entries(variations).map(([tag, value]) => new Variation(tag, value)));
  const buffer = new ShapeBuffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  shape(font, buffer);
  const glyphs = buffer.getGlyphInfosAndPositions();
  assert.ok(
    glyphs.every((g) => g.codepoint !== 0),
    `Missing glyph: ${text}`,
  );
  return glyphs.map(({ codepoint, ...position }) => ({ ...position, outline: font.glyphToPath(codepoint) }));
}
const shaping = [];
for (const [part, text] of [
  ['notoSansArabic', 'السَّلَامُعَلَيْكُمْ'],
  ['notoSansThai', 'น้ำกิ่กุ้งผู้เก่ง'],
]) {
  const definition = sources[part];
  const rawVariableSource = definition.variable
    ? await readFile(`${root}.artifacts/fonts/cache/${part}/source.ttf`)
    : null;
  const variableReference = rawVariableSource
    ? await subsetFont(rawVariableSource, undefined, {
        keepAllGlyphs: true,
        targetFormat: 'sfnt',
        noHinting: true,
        variationAxes: { ...definition.variable.axes, wght: { min: 400, max: 600 } },
      })
    : null;
  for (const weight of [400, 500, 600]) {
    const file = manifest.files.find((f) => f.part === part && f.weights.includes(weight));
    const available = new Set(expandRange(file.unicodeRange));
    assert.ok(
      [...text].every((char) => available.has(char.codePointAt(0))),
      'Sample must stay within one slice',
    );
    const source =
      variableReference ??
      (await fontverter.convert(
        await readFile(`${root}.artifacts/fonts/cache/${part}/${definition.weights[weight]}`),
        'sfnt',
      ));
    const subset = await fontverter.convert(await readFile(`${dist}${file.family}/${file.file}`), 'sfnt');
    const variations = sources[part].variable ? { ...sources[part].variable.axes, wght: weight } : undefined;
    const result = shaped(subset, text, variations);
    assert.deepEqual(result, shaped(source, text, variations), `${part}/${weight}: shaping changed`);
    const raw = rawVariableSource ? shaped(rawVariableSource, text, variations) : result;
    assert.equal(raw.length, result.length, `${part}/${weight}: raw glyph count`);
    const maxRawPositionDelta = Math.max(
      ...result.flatMap((glyph, index) =>
        ['xAdvance', 'yAdvance', 'xOffset', 'yOffset'].map((key) => Math.abs(glyph[key] - raw[index][key])),
      ),
    );
    assert.ok(
      result.some((g) => g.xOffset !== 0 || g.yOffset !== 0),
      'Sample must exercise mark positioning',
    );
    shaping.push({
      part,
      weight,
      text,
      glyphs: result.length,
      reference: variableReference ? 'axis-instanced-full-source' : 'pinned-source',
      sameOutlinesAndPositions: true,
      rawSourceExact: JSON.stringify(raw) === JSON.stringify(result),
      maxRawPositionDelta,
      GSUB: true,
      GPOS: true,
    });
  }
}
await mkdir(output, { recursive: true });
const report = {
  files: paths.size,
  bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0),
  sheets,
  fallback,
  shaping,
  hanja: { text: '漢字', family: 'Geul Sans Han TC', profile: 'ko', browserVerified: false },
};
await writeFile(`${output}checks.json`, JSON.stringify(report, null, 2) + '\n');
console.log(`${report.files} slices, ${report.bytes} bytes; checks → ${output}checks.json`);
console.table(sheets);

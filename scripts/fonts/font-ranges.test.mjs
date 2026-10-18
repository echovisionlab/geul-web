import assert from 'node:assert/strict';
import { test } from 'node:test';
import { families, stylesheets, localeProfiles, profileStacks, sources } from './fonts.config.mjs';
import { claimPoints, compressRange, expandRange, faceRules } from './font-ranges.mjs';

test('CSS ranges preserve singleton, interval, wildcard and supplementary code points', () => {
  assert.deepEqual(expandRange('U+41, u+61-63, U+1F60?'), [
    0x41,
    0x61,
    0x62,
    0x63,
    ...Array.from({ length: 16 }, (_, index) => 0x1f600 + index),
  ]);
  assert.equal(compressRange([0x63, 0x41, 0x62, 0x61, 0x41, 0x1f600]), 'U+41, U+61-63, U+1f600');
  assert.equal(compressRange([]), '');
});

test('first eligible source owns each code point, including overlapping reference slices', () => {
  const covered = new Set();
  assert.deepEqual(
    claimPoints('U+41-44, U+41', new Set([0x41, 0x42, 0x44]), covered, (p) => p !== 0x44),
    [0x41, 0x42],
  );
  assert.deepEqual(claimPoints('U+42-44', new Set([0x42, 0x43, 0x44]), covered), [0x43, 0x44]);
  assert.deepEqual(claimPoints('U+41-44', new Set([0x41, 0x42, 0x43, 0x44]), covered), []);
});

test('variable Latin and static Hangul share single-weight descriptors and reuse the variable URL', () => {
  const latin = faceRules('Geul Sans', 'sans/latin.woff2', [0x41], true, 400);
  assert.deepEqual(
    latin.map((rule) => /font-weight:([^;]+)/.exec(rule)[1]),
    ['400', '500', '600'],
  );
  for (const weight of [400, 500, 600]) {
    const [hangul] = faceRules('Geul Sans', `sans/hangul-${weight}.woff2`, [0xac00], false, weight);
    assert.ok(hangul.includes(`font-weight:${weight};`));
    assert.ok(latin[weight / 100 - 4].includes('src:url(sans/latin.woff2)'));
  }
});

test('Han TC is exclusive to Korean and Traditional Chinese profiles', () => {
  const hanTC = families.find((family) => family.slug === 'han-tc');
  const key = `han-tc:${hanTC.parts[0].source}`;
  assert.deepEqual(Object.keys(stylesheets), ['base', 'ko', 'ja', 'zh-hans', 'zh-hant']);
  for (const profile of ['base', 'ja', 'zh-hans']) {
    assert.ok(!stylesheets[profile].includes(key));
    assert.ok(!profileStacks[profile].includes('Geul Sans Han TC'));
  }
  for (const profile of ['ko', 'zh-hant']) {
    assert.ok(stylesheets[profile].includes(key));
    assert.ok(profileStacks[profile].includes('Geul Sans Han TC'));
  }
  assert.ok(!stylesheets.base.some((key) => key.startsWith('han-')));
});

test('Noto supplies every Geul family', () => {
  assert.deepEqual(
    families.map(({ name, slug }) => [name, slug]),
    [
      ['Geul Sans', 'sans'],
      ['Geul Sans Han JP', 'han-jp'],
      ['Geul Sans Han SC', 'han-sc'],
      ['Geul Sans Han TC', 'han-tc'],
      ['Geul Mono', 'mono'],
      ['Geul Emoji', 'emoji'],
    ],
  );
  assert.deepEqual(
    families.flatMap((family) => family.parts.map((part) => part.source)),
    [
      'notoSans',
      'notoSansArabic',
      'notoSansThai',
      'notoSansKR',
      'notoSansJP',
      'notoSansJP',
      'notoSansSC',
      'notoSansTC',
      'notoMono',
      'notoColorEmoji',
    ],
  );
});

test('locale profiles select the adopted upload profiles', () => {
  assert.deepEqual(localeProfiles, {
    latin: 'base',
    korean: 'ko',
    japanese: 'ja',
    'chinese-simplified': 'zh-hans',
    'chinese-traditional': 'zh-hant',
    arabic: 'base',
  });
});

test('every Noto source has a commit-pinned URL and SHA-256; width axes stay at 100', () => {
  for (const [id, source] of Object.entries(sources)) {
    assert.match(source.url, /google\/fonts\/47d54ca1ebb14fd864695f1d39dc734f39017c33\/ofl\//, id);
    assert.match(source.sha256, /^[a-f0-9]{64}$/, id);
    assert.ok(source.localFile.endsWith('.ttf'), id);
    if (decodeURIComponent(source.url).includes('[wdth,wght]')) {
      assert.equal(source.variable.axes.wdth, 100, id);
    }
  }
});

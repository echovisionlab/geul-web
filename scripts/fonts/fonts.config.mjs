/**
 * The Geul font system: one sans and one mono family assembled from pinned OFL sources and cut into
 * unicode-range slices (see `unicode-ranges.json`), so a page downloads only the slices its text uses.
 *
 * Han ideographs share code points between Japanese, Simplified and Traditional Chinese but differ in
 * shape, so each form is its own family that the locale's font stack places after `Geul Sans`. Korean
 * text borrows Traditional forms for Hanja.
 */

const GOOGLE_FONTS = 'https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl';

/** Weights the interface uses: regular text, medium headings and strong emphasis. */
export const WEIGHTS = [400, 500, 600];

/** Each source is downloaded once, verified, and cached under `.artifacts/fonts/cache/<id>`. */
export const sources = {
  notoSans: {
    copyright: 'Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic)',
    url: `${GOOGLE_FONTS}/notosans/NotoSans%5Bwdth%2Cwght%5D.ttf`,
    sha256: 'bfb7bb691513f12e734dc346c03a03f784912432d7e3fa8e56efcf906fe86b3d',
    localFile: 'noto-sans/NotoSans[wdth,wght].ttf',
    variable: { axes: { wdth: 100 } },
  },
  notoSansKR: {
    copyright: "Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'",
    url: `${GOOGLE_FONTS}/notosanskr/NotoSansKR%5Bwght%5D.ttf`,
    sha256: '194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252',
    localFile: 'noto-sans-kr/NotoSansKR[wght].ttf',
    variable: {},
  },
  notoSansJP: {
    copyright: "Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'",
    url: `${GOOGLE_FONTS}/notosansjp/NotoSansJP%5Bwght%5D.ttf`,
    sha256: 'c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f',
    localFile: 'noto-sans-jp/NotoSansJP[wght].ttf',
    variable: {},
  },
  notoSansArabic: {
    copyright: 'Copyright 2022 The Noto Project Authors (https://github.com/notofonts/arabic)',
    url: `${GOOGLE_FONTS}/notosansarabic/NotoSansArabic%5Bwdth%2Cwght%5D.ttf`,
    sha256: '63111b5b2e074dd48cc67692e0a2726d86ee94c1c37fe8598257b7b4e87e869e',
    localFile: 'noto-sans-arabic/NotoSansArabic[wdth,wght].ttf',
    variable: { axes: { wdth: 100 } },
  },
  notoSansThai: {
    copyright: 'Copyright 2022 The Noto Project Authors (https://github.com/notofonts/thai)',
    url: `${GOOGLE_FONTS}/notosansthai/NotoSansThai%5Bwdth%2Cwght%5D.ttf`,
    sha256: '5a1c559bb539583c8a1fd99d1c5b9491e5e14478c9cd2bd0970d5c3096cc9ef8',
    localFile: 'noto-sans-thai/NotoSansThai[wdth,wght].ttf',
    variable: { axes: { wdth: 100 } },
  },
  notoMono: {
    copyright: 'Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic)',
    url: `${GOOGLE_FONTS}/notosansmono/NotoSansMono%5Bwdth%2Cwght%5D.ttf`,
    sha256: '2cb2adb378a8f574213e23df697050b83c54c27df465a2015552740b2769a081',
    localFile: 'noto-sans-mono/NotoSansMono[wdth,wght].ttf',
    variable: { axes: { wdth: 100 } },
  },
  notoSansSC: {
    copyright: "(c) 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'.",
    url: `${GOOGLE_FONTS}/notosanssc/NotoSansSC%5Bwght%5D.ttf`,
    sha256: 'a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da',
    localFile: 'noto-sans-sc/NotoSansSC[wght].ttf',
    variable: {},
  },
  notoSansTC: {
    copyright: "(c) 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'.",
    url: `${GOOGLE_FONTS}/notosanstc/NotoSansTC%5Bwght%5D.ttf`,
    sha256: '864727d210d54f2537bbe23b3a839436c3992af72de9322af5270897246bd44f',
    localFile: 'noto-sans-tc/NotoSansTC[wght].ttf',
    variable: {},
  },
  notoColorEmoji: {
    copyright: 'Copyright 2022 Google Inc.',
    url: `${GOOGLE_FONTS}/notocoloremoji/NotoColorEmoji-Regular.ttf`,
    sha256: '4d82a18d8d95f60ba883ce242bbadbf84a576e987745dd7ba38d71c67cff2d73',
    localFile: 'noto-color-emoji/NotoColorEmoji-Regular.ttf',
    weights: { 400: null },
  },
};

const HAN = /\p{Script=Han}/u;
const isHan = (codePoint) => HAN.test(String.fromCodePoint(codePoint));
const notHan = (codePoint) => !isHan(codePoint);

/**
 * Parts are resolved in order: a code point belongs to the first part that covers it, so each face's
 * unicode-range is exact and no two faces of a family compete for a character.
 */
export const families = [
  {
    name: 'Geul Sans',
    slug: 'sans',
    parts: [
      { source: 'notoSans', reference: 'Noto Sans' },
      { source: 'notoSansArabic', reference: 'Noto Sans Arabic', slices: ['arabic'] },
      { source: 'notoSansThai', reference: 'Noto Sans Thai', slices: ['thai'] },
      { source: 'notoSansKR', reference: 'Noto Sans KR', filter: notHan, extraRanges: ['U+301a-301b'] },
      { source: 'notoSansJP', reference: 'Noto Sans JP', filter: notHan },
    ],
  },
  {
    name: 'Geul Sans Han JP',
    slug: 'han-jp',
    parts: [{ source: 'notoSansJP', reference: 'Noto Sans JP', filter: isHan }],
  },
  {
    name: 'Geul Sans Han SC',
    slug: 'han-sc',
    parts: [{ source: 'notoSansSC', reference: 'Noto Sans SC', filter: isHan }],
  },
  {
    name: 'Geul Sans Han TC',
    slug: 'han-tc',
    parts: [{ source: 'notoSansTC', reference: 'Noto Sans TC', filter: isHan }],
  },
  { name: 'Geul Mono', slug: 'mono', parts: [{ source: 'notoMono', reference: 'Noto Sans' }] },
  { name: 'Geul Emoji', slug: 'emoji', parts: [{ source: 'notoColorEmoji', reference: 'Noto Color Emoji' }] },
];

const key = (slug, index = 0) => {
  const family = families.find((candidate) => candidate.slug === slug);
  return `${slug}:${family.parts[index].source}`;
};
const base = [...families[0].parts.slice(0, 4).map((part) => `sans:${part.source}`), key('mono'), key('emoji')];
export const stylesheets = {
  base,
  ko: [...base, key('han-tc')],
  ja: [...base, key('sans', 4), key('han-jp')],
  'zh-hans': [...base, key('han-sc')],
  'zh-hant': [...base, key('han-tc')],
};

export const localeProfiles = {
  latin: 'base',
  korean: 'ko',
  japanese: 'ja',
  'chinese-simplified': 'zh-hans',
  'chinese-traditional': 'zh-hant',
  arabic: 'base',
};

/** Shared profile stacks; mirrored by the production font assignment contract. */
export const profileStacks = {
  base: ['Geul Sans', 'Geul Emoji'],
  ko: ['Geul Sans', 'Geul Sans Han TC', 'Geul Emoji'],
  ja: ['Geul Sans', 'Geul Sans Han JP', 'Geul Emoji'],
  'zh-hans': ['Geul Sans', 'Geul Sans Han SC', 'Geul Emoji'],
  'zh-hant': ['Geul Sans', 'Geul Sans Han TC', 'Geul Emoji'],
};

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { editor } from 'monaco-editor';
import { describe, expect, it } from 'vitest';
import { getThemeTokens, themeIds } from '@/lib/theme/themes';
import { sourceEditorTheme } from './source-editor-presentation';

interface Rgb {
  r: number;
  g: number;
  b: number;
}
interface ResolvedTokenTheme {
  match: (languageId: number, token: string) => number;
  getColorMap: () => { rgba: Rgb }[];
}

// Exercise the installed SDK's trie and base-rule precedence, not a copied matcher.
const require = createRequire(import.meta.url);
const sdkUrl = (id: string) => pathToFileURL(require.resolve(`monaco-editor/${id}`)).href;
const { vs, vs_dark } = (await import(sdkUrl('editor/standalone/common/themes'))) as {
  vs: editor.IStandaloneThemeData;
  vs_dark: editor.IStandaloneThemeData;
};
const { TokenTheme } = (await import(sdkUrl('editor/common/languages/supports/tokenization'))) as {
  TokenTheme: { createFromRawTokenTheme: (rules: editor.ITokenThemeRule[], colors: string[]) => ResolvedTokenTheme };
};
const { TokenMetadata } = (await import(sdkUrl('editor/common/encodedTokenAttributes'))) as {
  TokenMetadata: { getForeground: (metadata: number) => number };
};

function rgb(value: string): Rgb {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  return { r: channels[0], g: channels[1], b: channels[2] };
}

function luminance(value: Rgb): number {
  return [value.r, value.g, value.b]
    .map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(first: Rgb, second: Rgb): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const textSurfaces = [
  'editor.background',
  'editor.lineHighlightBackground',
  'editor.selectionBackground',
  'editor.inactiveSelectionBackground',
  'editor.selectionHighlightBackground',
  'editor.wordHighlightBackground',
  'editor.wordHighlightStrongBackground',
  'editor.findMatchBackground',
  'editor.findMatchHighlightBackground',
] as const;

// Current first-class JS/TS/GLSL grammar categories, plus every inherited VS foreground.
const categories = [
  'identifier.js',
  'comment.doc.js',
  'number.float.glsl',
  'keyword.directive.glsl',
  'type.identifier.ts',
  'string.escape.glsl',
  'string.invalid.js',
  'string.quote.glsl',
  'delimiter.bracket.js',
  'operator.glsl',
  ...new Set([...vs.rules, ...vs_dark.rules].filter((rule) => rule.foreground).map((rule) => `${rule.token}.language`)),
];

describe('actual Monaco syntax color resolution', () => {
  it.each(themeIds)('%s keeps inherited syntax and first-class language text readable', (themeId) => {
    const theme = sourceEditorTheme(themeId);
    const base = theme.base === 'vs-dark' ? vs_dark : vs;
    // This matches StandaloneTheme.tokenTheme's default-color rule and concatenation.
    const resolved = TokenTheme.createFromRawTokenTheme(
      [
        ...base.rules,
        {
          token: '',
          foreground: theme.colors['editor.foreground'],
          background: theme.colors['editor.background'],
        },
        ...theme.rules,
      ],
      theme.encodedTokensColors ?? [],
    );
    const roles = getThemeTokens(themeId);
    const allowedInk = [
      roles['text-primary'],
      roles['document-text-green'],
      roles['document-text-blue'],
      roles['document-text-red'],
      roles['status-danger'],
    ].map(rgb);
    for (const category of categories) {
      const ink = resolved.getColorMap()[TokenMetadata.getForeground(resolved.match(1, category))].rgba;
      expect(allowedInk, `${themeId} ${category} uses the existing semantic palette`).toContainEqual({
        r: ink.r,
        g: ink.g,
        b: ink.b,
      });
      for (const surface of textSurfaces) {
        expect(
          contrast(ink, rgb(theme.colors[surface])),
          `${themeId} ${category} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(themeIds)('%s keeps every paired and unexpected bracket readable', (themeId) => {
    const theme = sourceEditorTheme(themeId);
    const foregrounds = [
      ...Array.from({ length: 6 }, (_, index) => `editorBracketHighlight.foreground${index + 1}`),
      'editorBracketHighlight.unexpectedBracket.foreground',
    ];
    for (const foreground of foregrounds) {
      for (const surface of textSurfaces) {
        expect(
          contrast(rgb(theme.colors[foreground]), rgb(theme.colors[surface])),
          `${themeId} ${foreground} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

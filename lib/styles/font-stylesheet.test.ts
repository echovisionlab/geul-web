import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import type { LocaleFontProfile } from '@/lib/i18n/locale';
import { buildFontStylesheetHref } from './font-stylesheet';
import { geulFontStylesheets } from './geul-fonts.generated';

const PROFILE: Record<LocaleFontProfile, string> = {
  latin: 'base',
  korean: 'ko',
  japanese: 'ja',
  'chinese-simplified': 'zh-hans',
  'chinese-traditional': 'zh-hant',
  arabic: 'base',
};

describe('buildFontStylesheetHref', () => {
  it.each(Object.entries(PROFILE) as Array<[LocaleFontProfile, string]>)(
    'loads the exact hashed stylesheet for %s without other locale profiles',
    (profile, outputProfile) => {
      const href = buildFontStylesheetHref('https://static.example.com/fonts///', profile);
      expect(href).toBe(`https://static.example.com/fonts/${geulFontStylesheets[profile]}`);
      expect(href).toMatch(new RegExp(`/geul-${outputProfile}\\.[a-f0-9]{16}\\.css$`));
      expect(href).not.toContain('?');
    },
  );

  it('supports the same relative base used by local Storybook', () => {
    expect(buildFontStylesheetHref('/fonts/', 'korean')).toBe(`/fonts/${geulFontStylesheets.korean}`);
  });
});

describe('font assignment contract', () => {
  const assignments = new Map<string, Record<string, string>>();
  postcss.parse(readFileSync(new URL('./font-assignment.css', import.meta.url), 'utf8')).walkRules((rule) => {
    const declarations: Record<string, string> = {};
    rule.walkDecls((decl) => {
      declarations[decl.prop] = decl.value.replace(/\s+/g, ' ');
    });
    assignments.set(rule.selector, declarations);
  });

  it.each([
    ['latin', "'Geul Sans', 'Geul Emoji'"],
    ['arabic', "'Geul Sans', 'Geul Emoji'"],
    ['korean', "'Geul Sans', 'Geul Sans Han TC', 'Geul Emoji'"],
    ['japanese', "'Geul Sans', 'Geul Sans Han JP', 'Geul Emoji'"],
    ['chinese-simplified', "'Geul Sans', 'Geul Sans Han SC', 'Geul Emoji'"],
    ['chinese-traditional', "'Geul Sans', 'Geul Sans Han TC', 'Geul Emoji'"],
  ])('assigns %s to its Geul sans and Han families', (profile, expected) => {
    const selected = assignments.get(`html[data-font-profile='${profile}']`) ?? assignments.get(':root');
    expect(selected?.['--font-family-sans']).toBe(expected);
  });

  it('uses Noto-backed Geul Mono, Geul Sans, system monospace fallbacks and Geul Emoji', () => {
    expect(assignments.get(':root')?.['--font-mono']).toBe(
      "'Geul Mono', 'Geul Sans', ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'Geul Emoji', monospace",
    );
  });
});

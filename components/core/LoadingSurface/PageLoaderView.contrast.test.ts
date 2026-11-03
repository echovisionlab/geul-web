import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { invariantTokens, semanticThemes } from '../design-tokens';

type Color = readonly [number, number, number, number];
function color(value: string): Color {
  if (/^#[\da-f]{6}$/iu.test(value)) {
    return [1, 3, 5]
      .map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16))
      .concat(1) as unknown as Color;
  }
  const channels = value.match(/^rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)$/u);
  if (!channels) {
    throw new Error(`Unsupported contrast color: ${value}`);
  }
  return [Number(channels[1]), Number(channels[2]), Number(channels[3]), Number(channels[4]) / 100];
}
function over(ink: Color, background: Color): Color {
  return [0, 1, 2].map((index) => ink[index] * ink[3] + background[index] * (1 - ink[3])).concat(1) as unknown as Color;
}
function contrast(first: Color, second: Color) {
  const luminance = (value: Color) =>
    value.slice(0, 3).reduce((sum, channel, index) => {
      const normalized = channel / 255;
      const linear = normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      return sum + linear * [0.2126, 0.7152, 0.0722][index];
    }, 0);
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const loaderCss = readFileSync(new URL('./PageLoaderView.module.css', import.meta.url), 'utf8');
const surfaceCss = readFileSync(new URL('../Section/Surface.module.css', import.meta.url), 'utf8');
function role(css: string, selector: string, property: string) {
  const rule = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
  const name = rule.match(new RegExp(`${property}: var\\(--geul-([\\w-]+)\\)`))?.[1];
  if (!name) {
    throw new Error(`Missing ${selector} ${property} role`);
  }
  return name as keyof (typeof semanticThemes.light & typeof invariantTokens);
}

const standardRole = role(loaderCss, '.root', 'color');
const inverseRole = role(loaderCss, ".root[data-contrast='inverse']", 'color');
const overlayRole = role(surfaceCss, ".surface[data-appearance='overlay']", 'background');

describe('PageLoaderView contrast on the existing form surface', () => {
  it.each(['light', 'dark'] as const)(
    '%s meets 4.5:1 for standard surfaces and the inverse submission scrim',
    (mode) => {
      const roles = { ...semanticThemes[mode], ...invariantTokens };
      const surface = color(roles.surface);
      const overlay = over(color(roles[overlayRole]), surface);
      expect(
        contrast(over(color(roles[standardRole]), surface), surface),
        'standard form surface',
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(over(color(roles[inverseRole]), overlay), overlay),
        'inverse submission scrim',
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('guards the light scrim boundary where 88% inverse text still fails normal text contrast', () => {
    const roles = { ...semanticThemes.light, ...invariantTokens };
    const overlay = over(color(roles[overlayRole]), color(roles.surface));
    expect(contrast(over(color(roles['text-inverse-primary']), overlay), overlay)).toBeLessThan(4.5);
    expect(contrast(over(color(roles[inverseRole]), overlay), overlay)).toBeGreaterThanOrEqual(4.5);
  });
});

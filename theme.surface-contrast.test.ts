import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { invariantTokens, primitiveTokens } from './components/core/design-tokens';
import { getThemeTokens, themeIds } from '@/lib/theme/themes';

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

function over(foreground: Color, background: Color): Color {
  return [0, 1, 2]
    .map((index) => foreground[index] * foreground[3] + background[index] * (1 - foreground[3]))
    .concat(1) as unknown as Color;
}

function contrast(first: Color, second: Color) {
  const luminance = (value: Color) =>
    value
      .slice(0, 3)
      .map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const displayCss = readFileSync(new URL('./components/core/Display/Display.module.css', import.meta.url), 'utf8');
const overlayCss = readFileSync(
  new URL('./components/core/LoadingSurface/ProcessingOverlay.module.css', import.meta.url),
  'utf8',
);

describe('Core content contrast on composed surfaces', () => {
  it.each(themeIds)(
    '%s preserves inactive table data across ordinary, striped and selected row surfaces',
    (themeId) => {
      const rules = displayCss.match(/\.table tr\[data-disabled\] \{([^}]+)\}/u)?.[1];
      expect(rules).toBeDefined();
      const roles = getThemeTokens(themeId);
      const name = rules?.match(/color: var\(--geul-([\w-]+)\)/u)?.[1] as keyof typeof roles;
      const ink = color(roles[name] ?? roles['text-primary']);
      const opacityRole = rules?.match(
        /opacity: var\(--geul-opacity-([\w-]+)\)/u,
      )?.[1] as keyof typeof primitiveTokens.opacity;
      const opacity = opacityRole ? Number(primitiveTokens.opacity[opacityRole]) : 1;
      for (const surface of ['background', 'surface', 'surface-muted', 'surface-hover', 'surface-active'] as const) {
        const background = color(roles[surface]);
        const composedInk = over([ink[0], ink[1], ink[2], opacity], background);
        expect(contrast(composedInk, background), `${themeId} inactive row on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('keeps processing status text readable over the brightest and darkest authored pixels', () => {
    const backgroundRole = overlayCss.match(/background: var\(--geul-([\w-]+)\)/u)?.[1] as keyof typeof invariantTokens;
    const foregroundRole = overlayCss.match(/color: var\(--geul-([\w-]+)\)/u)?.[1] as keyof typeof invariantTokens;
    expect(backgroundRole).toBeDefined();
    expect(foregroundRole).toBeDefined();
    for (const pixel of [primitiveTokens.colors.white, primitiveTokens.colors.black]) {
      const surface = over(color(invariantTokens[backgroundRole]), color(pixel));
      const ink = over(color(invariantTokens[foregroundRole]), surface);
      expect(contrast(ink, surface), `processing status over ${pixel}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

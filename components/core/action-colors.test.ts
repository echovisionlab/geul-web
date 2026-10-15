import { expect, it } from 'vitest';
import { semanticThemes } from './design-tokens';

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

it('keeps filled action labels readable in both themes, including hover and pressed', () => {
  for (const theme of Object.values(semanticThemes)) {
    for (const tone of ['primary', 'accent', 'positive', 'warning', 'danger'] as const) {
      for (const key of [`action-${tone}`, `action-${tone}-hover`, `action-${tone}-pressed`] as const) {
        const a = luminance(theme[key]);
        const b = luminance(theme['text-on-action']);
        expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), key).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

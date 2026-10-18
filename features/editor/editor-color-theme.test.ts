import { describe, expect, it } from 'vitest';
import { EDITOR_COLOR_VALUES } from './toolbars/EditorColorStyleButton';
import { semanticThemes } from '@/components/core/design-tokens';

function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const red = channel(1);
  const green = channel(3);
  const blue = channel(5);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

describe('editor semantic color theme', () => {
  it('keeps both themes readable on document surfaces, highlights and matching backgrounds', () => {
    for (const [mode, roles] of Object.entries(semanticThemes)) {
      EDITOR_COLOR_VALUES.filter((color) => color !== 'default').forEach((color) => {
        const text = roles[`document-text-${color}`];
        const background = roles[`document-background-${color}`];
        expect(contrastRatio(text, roles.surface), `${mode}: ${color} on surface`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(text, roles.background), `${mode}: ${color} on document`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(text, background), `${mode}: ${color} on ${color}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(roles['text-primary'], background), `${mode}: default on ${color}`).toBeGreaterThanOrEqual(
          4.5,
        );
      });
      for (const textColor of EDITOR_COLOR_VALUES) {
        for (const backgroundColor of EDITOR_COLOR_VALUES) {
          const text = roles[`document-text-${textColor}`];
          const background =
            backgroundColor === 'default' ? roles.surface : roles[`document-background-${backgroundColor}`];
          expect(contrastRatio(text, background), `${mode}: ${textColor} on ${backgroundColor}`).toBeGreaterThanOrEqual(
            4.5,
          );
        }
      }
    }
  });
});

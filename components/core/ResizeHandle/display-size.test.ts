import { describe, expect, it } from 'vitest';
import {
  displaySizeInlineSize,
  displaySizeIsPortrait,
  displaySizePreset,
  normalizeDisplaySize,
  parseAspectRatio,
  snapDisplaySize,
} from './display-size';

describe('display size', () => {
  it('fills the column at full size and shares it below', () => {
    expect(displaySizeInlineSize(100)).toBeUndefined();
    expect(displaySizeInlineSize('60')).toBe('60%');
  });

  it('also caps a block with an aspect ratio at its share of 80svh', () => {
    // A 9:19.5 phone screenshot at XL stays one screen tall.
    expect(displaySizeInlineSize(100, 9 / 19.5)).toBe('min(100%, calc(80svh * 0.4615))');
    expect(displaySizeInlineSize(60, 16 / 9)).toBe('min(60%, calc(48svh * 1.7778))');
  });

  it('keeps stored values in range', () => {
    expect(normalizeDisplaySize(undefined)).toBe(100);
    expect(normalizeDisplaySize('5')).toBe(10);
    expect(normalizeDisplaySize(140)).toBe(100);
    expect(normalizeDisplaySize(47.6)).toBe(48);
  });

  it('lands a drag near a preset on the preset', () => {
    expect(snapDisplaySize(58)).toBe(60);
    expect(snapDisplaySize(54)).toBe(54);
    expect(displaySizePreset(40)).toBe('s');
    expect(displaySizePreset(47)).toBeUndefined();
  });

  it('reads authored ratios and tells portrait media apart', () => {
    expect(parseAspectRatio('9:16')).toBe(9 / 16);
    expect(parseAspectRatio('auto')).toBeUndefined();
    expect(displaySizeIsPortrait(9 / 16)).toBe(true);
    expect(displaySizeIsPortrait(16 / 9)).toBe(false);
    expect(displaySizeIsPortrait(undefined)).toBe(false);
  });
});

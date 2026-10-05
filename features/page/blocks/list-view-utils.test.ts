import { build } from 'esbuild';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { imageAspectRatioSchema, listLayoutSchema, toAspectRatio as legacyToAspectRatio } from './list-shared';
import { parseBooleanProp, parseIntegerProp, splitCsv, toAspectRatio } from './list-view-utils';

describe('list view utilities', () => {
  it('preserves CSV order, trims entries, and drops empty entries', () => {
    expect(splitCsv(undefined)).toEqual([]);
    expect(splitCsv('')).toEqual([]);
    expect(splitCsv(' a, , b ,a,')).toEqual(['a', 'b', 'a']);
  });

  it('preserves integer parsing and explicit boolean strings with caller fallbacks', () => {
    expect(parseIntegerProp(undefined, 12)).toBe(12);
    expect(parseIntegerProp('invalid', 3)).toBe(3);
    expect(parseIntegerProp('0', 3)).toBe(0);
    expect(parseIntegerProp('24px', 3)).toBe(24);
    expect(parseBooleanProp('true', false)).toBe(true);
    expect(parseBooleanProp('false', true)).toBe(false);
    expect(parseBooleanProp(undefined, true)).toBe(true);
    expect(parseBooleanProp('TRUE', false)).toBe(false);
  });

  it('preserves image ratio fallbacks and the legacy schema/default API', () => {
    expect(toAspectRatio('4:3', '16:9')).toBe('4 / 3');
    expect(toAspectRatio('auto', '1:1')).toBe('1 / 1');
    expect(toAspectRatio(undefined, '16:9')).toBe('16 / 9');
    expect(legacyToAspectRatio).toBe(toAspectRatio);
    expect(listLayoutSchema.default('grid').parse(undefined)).toBe('grid');
    expect(imageAspectRatioSchema.default('16:9').parse(undefined)).toBe('16:9');
  });

  it('keeps the browser helper graph free of schema initialization and Zod', async () => {
    const result = await build({
      entryPoints: [resolve(process.cwd(), 'features/page/blocks/list-view-utils.ts')],
      bundle: true,
      platform: 'browser',
      format: 'esm',
      write: false,
      metafile: true,
    });
    expect(Object.keys(result.metafile!.inputs)).toHaveLength(1);
    expect(Object.keys(result.metafile!.inputs).some((path) => path.includes('zod'))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { marqueeCommonSchema, parseMarqueeIds, parseTextMarqueeItems, stringifyTextMarqueeItems } from './schema';

describe('marquee block schema helpers', () => {
  it('normalizes selected entity ids from comma separated props', () => {
    expect(parseMarqueeIds(' client-1, ,client-2 , client-1 ')).toEqual(['client-1', 'client-2', 'client-1']);
  });

  it('keeps slider-controlled speed and height as shared block props', () => {
    expect(
      marqueeCommonSchema.parse({
        speedPxPerSecond: '18',
        itemHeightPx: '24',
      }),
    ).toMatchObject({
      direction: 'left',
      speed: 'normal',
      speedPxPerSecond: '18',
      itemHeight: 'md',
      itemHeightPx: '24',
    });
  });

  it('keeps text marquee items as shared static JSON, not locale props', () => {
    const encoded = stringifyTextMarqueeItems([
      { text: '  First item  ', href: ' https://example.com ' },
      { text: 'Second item' },
      { text: '   ', href: 'https://ignored.example.com' },
    ]);

    expect(parseTextMarqueeItems(encoded)).toEqual([
      { text: 'First item', href: 'https://example.com' },
      { text: 'Second item' },
    ]);
  });

  it('drops malformed text marquee data instead of throwing during page render', () => {
    expect(parseTextMarqueeItems('not-json')).toEqual([]);
    expect(parseTextMarqueeItems(JSON.stringify({ text: 'not-array' }))).toEqual([]);
    expect(parseTextMarqueeItems(JSON.stringify([{ href: 'https://example.com' }]))).toEqual([]);
  });
});

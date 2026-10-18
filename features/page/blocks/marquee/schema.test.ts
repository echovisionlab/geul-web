import { describe, expect, it } from 'vitest';
import { parseClientMarqueeProps } from '../client-marquee/schema';
import { parseLabelMarqueeProps } from '../label-marquee/schema';
import { parseTextMarqueeProps } from '../text-marquee/schema';
import { parseMarqueeIds, parseTextMarqueeItems, stringifyTextMarqueeItems } from './schema';

const commonDefaults = {
  direction: 'left',
  speed: 'normal',
  itemHeight: 'md',
  gap: 'lg',
  pauseOnHover: 'true',
  linkTarget: 'same-tab',
};

describe.each([
  ['client', parseClientMarqueeProps],
  ['label', parseLabelMarqueeProps],
])('%s marquee props', (_, parse) => {
  it.each([undefined, null, {}])('apply the shared contract defaults to stored props %j', (props) => {
    expect(parse(props)).toEqual({
      ...commonDefaults,
      source: 'all',
      ids: '',
      linkMode: 'entity',
      logoScale: 'contain',
      fallbackMode: 'name',
      limit: '24',
    });
  });

  it.each([
    { direction: 'up' },
    { itemHeight: 'xxl' },
    { speedPxPerSecond: 30 },
    { source: 'some' },
    { linkMode: 'url' },
    { limit: 4 },
  ])('reject malformed stored props %j', (props) => {
    expect(() => parse(props)).toThrow();
  });
});

describe('text marquee props', () => {
  it.each([undefined, null, {}])('apply the shared contract defaults with no items to stored props %j', (props) => {
    expect(parseTextMarqueeProps(props)).toEqual({ ...commonDefaults, itemsJson: '[]' });
  });

  it.each([{ itemsJson: [] }, { linkTarget: 'popup' }, { pauseOnHover: false }])(
    'reject malformed stored props %j',
    (props) => {
      expect(() => parseTextMarqueeProps(props)).toThrow();
    },
  );
});

describe('marquee block schema helpers', () => {
  it('normalizes selected entity ids from comma separated props', () => {
    expect(parseMarqueeIds(' client-1, ,client-2 , client-1 ')).toEqual(['client-1', 'client-2', 'client-1']);
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

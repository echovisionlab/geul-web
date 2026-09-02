import { describe, expect, it } from 'vitest';
import {
  moveTextMarqueeEditorItem,
  parseTextMarqueeEditorItems,
  serializeTextMarqueeEditorItems,
} from './editor-items';

describe('text marquee editor item helpers', () => {
  it('preserves blank draft rows for the editor', () => {
    const items = parseTextMarqueeEditorItems(
      JSON.stringify([
        { text: 'Alpha', href: 'https://example.com' },
        { text: '', href: '' },
      ]),
    );

    expect(items).toEqual([
      { text: 'Alpha', href: 'https://example.com' },
      { text: '', href: '' },
    ]);
    expect(serializeTextMarqueeEditorItems(items)).toBe(
      JSON.stringify([{ text: 'Alpha', href: 'https://example.com' }, { text: '' }]),
    );
  });

  it('reorders items by zero-based indexes', () => {
    const items = [
      { text: '0', href: '' },
      { text: '1', href: '' },
      { text: '2', href: '' },
    ];

    expect(moveTextMarqueeEditorItem(items, 2, 0)).toEqual([
      { text: '2', href: '' },
      { text: '0', href: '' },
      { text: '1', href: '' },
    ]);
  });

  it('leaves the item order unchanged for invalid indexes', () => {
    const items = [{ text: 'Only', href: '' }];

    expect(moveTextMarqueeEditorItem(items, -1, 0)).toBe(items);
    expect(moveTextMarqueeEditorItem(items, 0, 3)).toBe(items);
  });
});

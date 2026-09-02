// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { geulTiptapEmojis } from './emoji-extension';
import { filterTiptapEmojiItems } from './TiptapEmojiPicker';

describe('Tiptap Emoji picker adapter', () => {
  it('uses official extension data for default and searched picker results', () => {
    const defaults = filterTiptapEmojiItems(geulTiptapEmojis, '');
    expect(defaults.some((item) => item.shortcodes.includes('smile'))).toBe(true);
    expect(defaults.length).toBeGreaterThan(1_900);
    expect(new Set(defaults.map((item) => item.name)).size).toBe(defaults.length);
    expect(defaults.every((item) => item.group !== 'components' && !item.name.startsWith('regional_indicator_'))).toBe(
      true,
    );

    const hearts = filterTiptapEmojiItems(geulTiptapEmojis, 'heart');
    expect(hearts.length).toBeGreaterThan(1);
    expect(
      hearts.every((item) => [item.name, ...item.shortcodes, ...item.tags].some((value) => value.includes('heart'))),
    ).toBe(true);
    expect(geulTiptapEmojis.every((item) => item.fallbackImage === undefined)).toBe(true);
  });
});

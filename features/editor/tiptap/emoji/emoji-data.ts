// Loaded on demand through emoji-runtime.ts. Do not import this module from eagerly loaded editor code.
import { emojis, type EmojiItem } from '@tiptap/extension-emoji';
import emojiRegex from 'emoji-regex';
import type { TiptapEmojiData } from './emoji-runtime';

/** Geul renders Unicode through its own font stack and never loads Emoji fallback images from a third-party CDN. */
export const geulTiptapEmojis: readonly EmojiItem[] = emojis.map(({ fallbackImage: _fallbackImage, ...item }) => item);

function removeVariationSelector(value: string): string {
  return value.replace('︎', '').replace('️', '');
}

export function createTiptapEmojiData(items: readonly EmojiItem[] = geulTiptapEmojis): TiptapEmojiData {
  const byShortcode = new Map<string, EmojiItem>();
  const byEmoji = new Map<string, EmojiItem>();
  for (const item of items) {
    for (const key of [item.name, ...item.shortcodes]) {
      if (!byShortcode.has(key)) {
        byShortcode.set(key, item);
      }
    }
    if (item.emoji && !byEmoji.has(item.emoji)) {
      byEmoji.set(item.emoji, item);
    }
  }
  return {
    items,
    find: (shortcode) => byShortcode.get(shortcode),
    shortcodeFor: (emoji) => byEmoji.get(removeVariationSelector(emoji))?.shortcodes[0],
    regex: emojiRegex,
  };
}

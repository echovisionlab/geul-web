import Emoji, { emojis, shortcodeToEmoji, type EmojiItem } from '@tiptap/extension-emoji';

/** Geul renders Unicode through its own font stack and never loads Emoji fallback images from a third-party CDN. */
export const geulTiptapEmojis: readonly EmojiItem[] = emojis.map(({ fallbackImage: _fallbackImage, ...item }) => item);

export const GeulTiptapEmoji = Emoji.configure({ emojis: [...geulTiptapEmojis] });

export function emojiTextForName(name: string): string | null {
  return shortcodeToEmoji(name, [...geulTiptapEmojis])?.emoji ?? null;
}

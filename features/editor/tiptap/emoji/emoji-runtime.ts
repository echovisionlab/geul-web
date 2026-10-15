import type { EmojiItem } from '@tiptap/extension-emoji';

/** Emoji lookups backed by the Tiptap data set, which is loaded only when authoring needs it. */
export interface TiptapEmojiData {
  readonly items: readonly EmojiItem[];
  /** Same first match as Tiptap `shortcodeToEmoji`: by name or any shortcode. */
  find: (shortcode: string) => EmojiItem | undefined;
  /** Same first match as Tiptap `emojiToShortcode`. */
  shortcodeFor: (emoji: string) => string | undefined;
  regex: () => RegExp;
}

let loaded: TiptapEmojiData | null = null;
let pending: Promise<TiptapEmojiData> | null = null;
const listeners = new Set<() => void>();

export function getTiptapEmojiData(): TiptapEmojiData | null {
  return loaded;
}

/** Loads the Emoji data chunk (about 105 kB gzip) once; a failed load can be retried. */
export function loadTiptapEmojiData(): Promise<TiptapEmojiData> {
  pending ??= import('./emoji-data').then(
    ({ createTiptapEmojiData }) => {
      loaded = createTiptapEmojiData();
      for (const listener of listeners) {
        listener();
      }
      return loaded;
    },
    (error: unknown) => {
      pending = null;
      throw error;
    },
  );
  return pending;
}

/** Fire-and-forget load for editor triggers; a failed chunk load is retried by the next trigger. */
export function requestTiptapEmojiData(): void {
  if (!loaded) {
    void loadTiptapEmojiData().catch(() => undefined);
  }
}

export function subscribeTiptapEmojiData(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Emoji nodes exist only after the data has loaded, so the codec can resolve them synchronously. */
export function emojiTextForName(name: string): string | null {
  return loaded?.find(name)?.emoji ?? null;
}

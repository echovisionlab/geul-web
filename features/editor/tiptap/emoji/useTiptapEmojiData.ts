'use client';

import { useSyncExternalStore } from 'react';
import { getTiptapEmojiData, subscribeTiptapEmojiData, type TiptapEmojiData } from './emoji-runtime';

// Kept apart from emoji-runtime, which server document codecs import, so React hooks stay client-only.
export function useTiptapEmojiData(): TiptapEmojiData | null {
  return useSyncExternalStore(subscribeTiptapEmojiData, getTiptapEmojiData, getTiptapEmojiData);
}

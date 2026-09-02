'use client';

import { useMemo, useState } from 'react';
import type { EmojiItem } from '@tiptap/extension-emoji';
import { EmojiPicker, type EmojiPickerItem } from '@/components/core/EmojiPicker';
import { geulTiptapEmojis } from './emoji-extension';

const POPULAR_SHORTCODES = [
  'grinning',
  'smiley',
  'smile',
  'joy',
  'rofl',
  'relaxed',
  'heart_eyes',
  'kissing_heart',
  'wink',
  'thinking',
  'sunglasses',
  'partying_face',
  'sob',
  'cry',
  'angry',
  'rage',
  'scream',
  'flushed',
  'pleading_face',
  'eyes',
  'wave',
  'clap',
  'raised_hands',
  'pray',
  'thumbsup',
  'thumbsdown',
  'ok_hand',
  'muscle',
  'point_right',
  'point_left',
  'heart',
  'orange_heart',
  'yellow_heart',
  'green_heart',
  'blue_heart',
  'purple_heart',
  'broken_heart',
  'sparkles',
  'fire',
  'star',
  'tada',
  'rocket',
  'bulb',
  'warning',
  'white_check_mark',
  'x',
  '100',
  'musical_note',
] as const;

function itemLabel(item: EmojiItem): string {
  return item.shortcodes[0] ?? item.name;
}

export function tiptapEmojiPickerItems(query: string): EmojiPickerItem[] {
  return filterTiptapEmojiItems(geulTiptapEmojis, query).flatMap((item) =>
    item.emoji ? [{ id: item.name, value: item.emoji, label: `:${itemLabel(item)}:` }] : [],
  );
}

export function filterTiptapEmojiItems(items: readonly EmojiItem[], query: string): EmojiItem[] {
  const available = items.filter(
    (item): item is EmojiItem & { emoji: string } =>
      Boolean(item.emoji) && item.group !== 'components' && !item.name.startsWith('regional_indicator_'),
  );
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    const byShortcode = new Map(available.flatMap((item) => item.shortcodes.map((shortcode) => [shortcode, item])));
    const popular = POPULAR_SHORTCODES.flatMap((shortcode) => {
      const item = byShortcode.get(shortcode);
      return item ? [item] : [];
    });
    const popularNames = new Set(popular.map((item) => item.name));
    return [...popular, ...available.filter((item) => !popularNames.has(item.name))];
  }
  return available.filter((item) =>
    [item.name, ...item.shortcodes, ...item.tags].some((value) => value.toLocaleLowerCase().includes(normalized)),
  );
}

export interface TiptapEmojiPickerProps {
  opened: boolean;
  title: string;
  searchPlaceholder: string;
  noResults: string;
  closeLabel: string;
  onClose: () => void;
  onSelect: (name: string) => void;
}

export function TiptapEmojiPicker({
  opened,
  title,
  searchPlaceholder,
  noResults,
  closeLabel,
  onClose,
  onSelect,
}: TiptapEmojiPickerProps) {
  const [query, setQuery] = useState('');
  const pickerItems = useMemo(() => tiptapEmojiPickerItems(query), [query]);

  return (
    <EmojiPicker
      opened={opened}
      title={title}
      searchPlaceholder={searchPlaceholder}
      noResults={noResults}
      closeLabel={closeLabel}
      query={query}
      items={pickerItems}
      onQueryChange={setQuery}
      onClose={() => {
        setQuery('');
        onClose();
      }}
      onSelect={(item) => {
        setQuery('');
        onSelect(item.id);
      }}
    />
  );
}

'use client';

import { ScrollArea, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconButton } from '../IconButton';
import { TextInput } from '../Input';
import { ContentModal } from '../Modal';

export interface EmojiPickerItem {
  id: string;
  value: string;
  label: string;
}

export interface EmojiPickerProps {
  opened: boolean;
  title: string;
  searchPlaceholder: string;
  noResults: string;
  closeLabel: string;
  query: string;
  items: readonly EmojiPickerItem[];
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onSelect: (item: EmojiPickerItem) => void;
}

export interface EmojiPickerPanelProps {
  title: string;
  searchPlaceholder: string;
  noResults: string;
  query: string;
  items: readonly EmojiPickerItem[];
  onQueryChange: (query: string) => void;
  onSelect: (item: EmojiPickerItem) => void;
}

/** Searchable Emoji grid shared by modal and anchored picker surfaces. */
export function EmojiPickerPanel({
  title,
  searchPlaceholder,
  noResults,
  query,
  items,
  onQueryChange,
  onSelect,
}: EmojiPickerPanelProps) {
  return (
    <Stack gap="sm">
      <TextInput
        autoFocus
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
      />
      {items.length > 0 ? (
        <ScrollArea h={320} type="auto" scrollbars="y">
          <SimpleGrid cols={{ base: 9, xs: 11 }} spacing={2} role="listbox" aria-label={title} p={4} pr="xs">
            {items.map((item) => (
              <IconButton
                key={item.id}
                type="button"
                emphasis="low"
                size="md"
                label={item.label}
                title={item.label}
                role="option"
                aria-selected={false}
                fz="lg"
                onClick={() => onSelect(item)}
              >
                {item.value}
              </IconButton>
            ))}
          </SimpleGrid>
        </ScrollArea>
      ) : (
        <Text c="dimmed" ta="center" py="md">
          {noResults}
        </Text>
      )}
    </Stack>
  );
}

/** Controlled, editor-agnostic Emoji selection surface. */
export function EmojiPicker({
  opened,
  title,
  searchPlaceholder,
  noResults,
  closeLabel,
  query,
  items,
  onQueryChange,
  onClose,
  onSelect,
}: EmojiPickerProps) {
  return (
    <ContentModal opened={opened} onClose={onClose} title={title} closeLabel={closeLabel} centered size="compact">
      <EmojiPickerPanel
        title={title}
        searchPlaceholder={searchPlaceholder}
        noResults={noResults}
        query={query}
        items={items}
        onQueryChange={onQueryChange}
        onSelect={onSelect}
      />
    </ContentModal>
  );
}

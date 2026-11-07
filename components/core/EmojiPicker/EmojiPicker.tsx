'use client';
import { SupportingText } from '../Typography';

import { LayoutStack as DsLayoutStack, LayoutInset as DsLayoutInset } from '../Layout';

import { GridLayout, ListBox, ListBoxItem, Size, Virtualizer } from 'react-aria-components';
import { primitiveTokens } from '@echovisionlab/design-system/tokens';
import type { ClosedVisualProps } from '../visual-contract';
import controlClasses from '../Control.module.css';
import classes from './EmojiPicker.module.css';
import { TextInput } from '../Input';
import { ContentModal } from '../Modal';

export type EmojiPickerDensity = 'compact' | 'standard';

export interface EmojiPickerItem {
  id: string;
  value: string;
  label: string;
}

export interface EmojiPickerProps extends ClosedVisualProps {
  density?: EmojiPickerDensity;
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

export interface EmojiPickerPanelProps extends ClosedVisualProps {
  density?: EmojiPickerDensity;
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
  density = 'standard',
  title,
  searchPlaceholder,
  noResults,
  query,
  items,
  onQueryChange,
  onSelect,
}: EmojiPickerPanelProps) {
  if (density !== 'compact' && density !== 'standard') {
    throw new RangeError('Core EmojiPicker density must be compact or standard');
  }
  const controlSize = density === 'compact' ? 'xs' : 'md';
  const rootFontSize =
    typeof document === 'undefined' ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  // Coarse pointers lay out cells at the shared touch minimum so neighbouring 44px targets never overlap.
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(any-pointer: coarse)').matches;
  const itemSize =
    Math.max(
      parseFloat(primitiveTokens.controlHeight[controlSize]),
      coarse ? parseFloat(primitiveTokens.interaction.touch) : 0,
    ) * rootFontSize;
  const spacing = parseFloat(primitiveTokens.spacing.xxs) * rootFontSize;
  return (
    <DsLayoutStack gap={density === 'compact' ? 'xs' : 'sm'}>
      <TextInput
        size={density === 'compact' ? 'xs' : 'sm'}
        autoFocus
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
      />
      {items.length > 0 ? (
        <DsLayoutInset space="xxs" inlineEnd="xs">
          <Virtualizer
            layout={GridLayout}
            layoutOptions={{
              minItemSize: new Size(itemSize, itemSize),
              maxItemSize: new Size(itemSize, itemSize),
              minSpace: new Size(spacing, spacing),
              maxHorizontalSpace: spacing,
              maxColumns: 11,
              preserveAspectRatio: true,
            }}
          >
            <ListBox
              aria-label={title}
              items={items}
              layout="grid"
              className={classes.grid}
              data-core-emoji-density={density}
              data-core-emoji-sparse={items.length <= 4 || undefined}
              selectionMode="none"
              onAction={(id) => {
                const item = items.find((candidate) => candidate.id === id);
                if (item) {
                  onSelect(item);
                }
              }}
            >
              {(item) => (
                <ListBoxItem
                  id={item.id}
                  key={item.id}
                  textValue={item.label}
                  aria-label={item.label}
                  className={`${controlClasses.root} ${classes.item}`}
                  data-tone="neutral"
                  data-emphasis="low"
                  data-control-size={controlSize}
                  data-control-kind="icon"
                >
                  {item.value}
                </ListBoxItem>
              )}
            </ListBox>
          </Virtualizer>
        </DsLayoutInset>
      ) : (
        <DsLayoutInset block="md">
          <SupportingText tone="secondary" align="center" role="status">
            {noResults}
          </SupportingText>
        </DsLayoutInset>
      )}
    </DsLayoutStack>
  );
}

/** Controlled, editor-agnostic Emoji selection surface. */
export function EmojiPicker({
  density = 'standard',
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
        density={density}
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

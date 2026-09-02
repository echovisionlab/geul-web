import { useCallback, useEffect, useRef, useState } from 'react';
import type { SocialLinks } from '@/lib/types/common/social-links';
import { formatOrderedLinksForSave, toEditableOrderedArray } from '@/lib/utils/social-links';

export interface SocialLinkItem {
  key: string;
  platform: string;
  value: string;
}

export interface UseSocialLinksEditorOptions {
  value: SocialLinks;
  onChange: (links: SocialLinks) => void;
  maxLinks?: number;
}

/**
 * Manages social links editing state with external value synchronization
 * Uses ref-based tracking to prevent self-sync loops
 */
export function useSocialLinksEditor({ value, onChange, maxLinks = 20 }: UseSocialLinksEditorOptions) {
  // Internal array state (to preserve empty items during editing)
  const [items, setItems] = useState<SocialLinkItem[]>(() => toEditableOrderedArray(value ?? {}));

  // Track last emitted value to avoid self-sync
  const lastEmittedRef = useRef(value);

  // Sync only on external changes (e.g., form reset, data load)
  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      setItems(toEditableOrderedArray(value ?? {}));
      lastEmittedRef.current = value;
    }
  }, [value]);

  const emitChange = useCallback(
    (newItems: SocialLinkItem[]) => {
      setItems(newItems);
      const formatted = formatOrderedLinksForSave(newItems);
      lastEmittedRef.current = formatted;
      onChange(formatted);
    },
    [onChange],
  );

  const addLink = useCallback(() => {
    if (items.length >= maxLinks) {
      return;
    }
    emitChange([...items, { key: '', platform: '', value: '' }]);
  }, [items, maxLinks, emitChange]);

  const removeLink = useCallback(
    (index: number) => {
      emitChange(items.filter((_, i) => i !== index));
    },
    [items, emitChange],
  );

  const updateLink = useCallback(
    (index: number, field: 'platform' | 'value', newValue: string) => {
      const updated = [...items];
      updated[index] = { ...updated[index], [field]: newValue };
      emitChange(updated);
    },
    [items, emitChange],
  );

  const moveLink = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= items.length ||
        toIndex >= items.length
      ) {
        return;
      }

      const updated = [...items];
      const [moved] = updated.splice(fromIndex, 1);
      if (!moved) {
        return;
      }

      updated.splice(toIndex, 0, moved);
      emitChange(updated);
    },
    [items, emitChange],
  );

  return {
    items,
    canAddMore: items.length < maxLinks,
    addLink,
    removeLink,
    updateLink,
    moveLink,
  };
}

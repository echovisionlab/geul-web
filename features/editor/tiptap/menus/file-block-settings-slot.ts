'use client';

import { useSyncExternalStore } from 'react';

/**
 * The element a selected File block renders its settings into. It lives in the
 * File menu's settings popover beside the editor, so the fields (and the hidden
 * collection templates React Aria builds for their lists) stay out of the
 * contenteditable.
 */
export interface FileBlockSettingsSlot {
  get: () => HTMLElement | null;
  set: (element: HTMLElement | null) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createFileBlockSettingsSlot(): FileBlockSettingsSlot {
  let current: HTMLElement | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set(element) {
      if (element !== current) {
        current = element;
        listeners.forEach((listener) => listener());
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const subscribeNothing = () => () => {};
const noElement = () => null;

export function useFileBlockSettingsSlot(slot: FileBlockSettingsSlot | undefined): HTMLElement | null {
  return useSyncExternalStore(slot?.subscribe ?? subscribeNothing, slot?.get ?? noElement, noElement);
}

'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ContextualBlockAlignment } from './AlignmentMenuActions';
import type { MapSelectionPlace } from './MapSelectionMenu';

export interface TiptapMapSelectionMenuSnapshot {
  places: readonly MapSelectionPlace[];
  textAlignment: ContextualBlockAlignment;
  previewWidth: string | number;
  isResizing?: boolean;
  disabled?: boolean;
}

export interface TiptapMapSelectionMenuCommands {
  openPlaceManager?: () => void;
  removePlace?: (placeId: string) => void;
  centerPlace?: (placeId: string) => void;
  changeAlignment?: (alignment: ContextualBlockAlignment) => void;
  focusCaption?: () => void;
  deleteBlock?: () => void;
}

/** A live NodeView-owned port. It deliberately contains no API or persistence methods. */
export interface TiptapMapSelectionMenuBinding {
  snapshot: TiptapMapSelectionMenuSnapshot;
  commands: TiptapMapSelectionMenuCommands;
}

export interface TiptapMapSelectionMenuRegistry {
  register: (blockId: string, binding: TiptapMapSelectionMenuBinding) => () => void;
  get: (blockId: string) => TiptapMapSelectionMenuBinding | undefined;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Creates an editor-instance-local bridge between a map NodeView and its
 * contextual BubbleMenu. Registration must be refreshed whenever the NodeView
 * snapshot or command closures change.
 */
export function createTiptapMapSelectionMenuRegistry(): TiptapMapSelectionMenuRegistry {
  const entries = new Map<string, TiptapMapSelectionMenuBinding>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  return {
    register(blockId, binding) {
      entries.set(blockId, binding);
      emit();
      return () => {
        if (entries.get(blockId) === binding) {
          entries.delete(blockId);
          emit();
        }
      };
    },
    get: (blockId) => entries.get(blockId),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const MapSelectionMenuRegistryContext = createContext<TiptapMapSelectionMenuRegistry | null>(null);

export function TiptapMapSelectionMenuRegistryProvider({
  registry,
  children,
}: {
  registry: TiptapMapSelectionMenuRegistry;
  children: ReactNode;
}) {
  return (
    <MapSelectionMenuRegistryContext.Provider value={registry}>{children}</MapSelectionMenuRegistryContext.Provider>
  );
}

export function useTiptapMapSelectionMenuRegistry(): TiptapMapSelectionMenuRegistry | null {
  return useContext(MapSelectionMenuRegistryContext);
}

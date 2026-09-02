'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ContextualBlockAlignment } from '../map-external/AlignmentMenuActions';

export type ExecutableBlockMode = 'edit' | 'source' | 'preview';
export type ExecutableBlockType = 'p5Sketch' | 'threeScene' | 'shader';

export interface ExecutableSelectionMenuLabels {
  menu: string;
  edit: string;
  source: string;
  preview: string;
  run: string;
  stop: string;
  restart: string;
  deleteBlock: string;
  alignment: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
}

export interface ExecutableSelectionMenuSnapshot {
  blockType: ExecutableBlockType;
  mode: ExecutableBlockMode;
  running: boolean;
  textAlignment: ContextualBlockAlignment;
  disabled?: boolean;
  labels: ExecutableSelectionMenuLabels;
}

export interface ExecutableSelectionMenuCommands {
  setMode: (mode: ExecutableBlockMode) => void;
  run: () => void;
  stop: () => void;
  restart: () => void;
  setAlignment: (alignment: ContextualBlockAlignment) => void;
  deleteBlock: () => void;
}

export interface ExecutableSelectionMenuBinding {
  snapshot: ExecutableSelectionMenuSnapshot;
  commands: ExecutableSelectionMenuCommands;
}

export interface ExecutableSelectionMenuRegistry {
  register: (blockId: string, binding: ExecutableSelectionMenuBinding) => () => void;
  get: (blockId: string) => ExecutableSelectionMenuBinding | undefined;
  subscribe: (listener: () => void) => () => void;
  notify: () => void;
}

export function createExecutableSelectionMenuRegistry(): ExecutableSelectionMenuRegistry {
  const entries = new Map<string, ExecutableSelectionMenuBinding>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    register(blockId, binding) {
      const previous = entries.get(blockId);
      entries.set(blockId, binding);
      if (
        !previous ||
        previous.snapshot.blockType !== binding.snapshot.blockType ||
        previous.snapshot.mode !== binding.snapshot.mode ||
        previous.snapshot.running !== binding.snapshot.running ||
        previous.snapshot.textAlignment !== binding.snapshot.textAlignment ||
        previous.snapshot.disabled !== binding.snapshot.disabled
      ) {
        emit();
      }
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
    notify: emit,
  };
}

const ExecutableSelectionMenuRegistryContext = createContext<ExecutableSelectionMenuRegistry | null>(null);

export function ExecutableSelectionMenuRegistryProvider({
  registry,
  children,
}: {
  registry: ExecutableSelectionMenuRegistry;
  children: ReactNode;
}) {
  return (
    <ExecutableSelectionMenuRegistryContext.Provider value={registry}>
      {children}
    </ExecutableSelectionMenuRegistryContext.Provider>
  );
}

export function useExecutableSelectionMenuRegistry(): ExecutableSelectionMenuRegistry | null {
  return useContext(ExecutableSelectionMenuRegistryContext);
}

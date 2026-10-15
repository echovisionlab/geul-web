'use client';

import { createContext, useContext } from 'react';
import type { RuntimeEntityType } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type { BlockRoomSnapshot } from '@/lib/collab/block-room-protocol';
import type {
  EditorRuntimeEventListener,
  EditorRuntimeEventSubscriptionOptions,
} from '@/lib/collab/subscribe-runtime-events';

// Context object and consumer hook only. Upload and translation hooks read the optional
// runtime from here so routes without an editor do not load the provider's Yjs/collaboration code.

export interface EditorRuntimeContextValue {
  provider: HocuspocusProvider | null;
  entityType: RuntimeEntityType;
  entityId: string;
  persistNow: () => Promise<void>;
  getContributorMemberIds: () => string[];
  getBlockRoomSnapshot: () => Promise<BlockRoomSnapshot>;
  subscribeToRuntimeEvents: (
    onEvent: EditorRuntimeEventListener,
    options?: EditorRuntimeEventSubscriptionOptions,
  ) => () => void;
}

export const EditorRuntimeContext = createContext<EditorRuntimeContextValue | null>(null);

export function useOptionalEditorRuntimeContext(): EditorRuntimeContextValue | null {
  return useContext(EditorRuntimeContext);
}

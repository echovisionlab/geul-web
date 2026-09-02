'use client';

import type { OgGenerationLifecycleRuntimeEvent } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { useEditorRuntimeEvents } from './useEditorRuntimeEvents';

export function useOgLifecycleSubscription(
  provider: HocuspocusProvider | null,
  onLifecycle: (event: OgGenerationLifecycleRuntimeEvent) => void,
  options: {
    enabled?: boolean;
    entityType: OgGenerationLifecycleRuntimeEvent['entityType'];
    entityId?: string;
    locale?: string | null;
  },
): void {
  useEditorRuntimeEvents(
    provider,
    (event) => {
      if (options.enabled !== false && event.kind === 'og.lifecycle') {
        onLifecycle(event);
      }
    },
    {
      entityType: options.entityType,
      entityId: options.entityId,
      locale: options.locale,
    },
  );
}

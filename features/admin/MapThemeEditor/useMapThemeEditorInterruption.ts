'use client';

import type { HocuspocusProvider } from '@hocuspocus/provider';
import { useEditorPermissionRevocation } from '@/features/editor/useEditorPermissionRevocation';

export function useMapThemeEditorInterruption(provider: HocuspocusProvider | null, themeId: string) {
  const access = useEditorPermissionRevocation(provider, 'map-theme', themeId);

  return {
    blocked: access.blocked,
    interruption: access.interruption,
  };
}

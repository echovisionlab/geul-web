'use client';

import type { HocuspocusProvider } from '@hocuspocus/provider';
import { useEditorPermissionRevocation } from '@/features/editor/useEditorPermissionRevocation';
import { useMapThemeReloadRequired } from './useMapThemeReloadRequired';

export function useMapThemeEditorInterruption(provider: HocuspocusProvider | null, themeId: string) {
  const access = useEditorPermissionRevocation(provider, 'map-theme', themeId);
  const revision = useMapThemeReloadRequired(provider);

  return {
    blocked: access.blocked || revision.reloadRequired,
    interruption: access.interruption,
    reloadRequired: revision.reloadRequired,
  };
}

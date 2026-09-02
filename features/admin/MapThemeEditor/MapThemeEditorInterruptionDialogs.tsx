'use client';

import { EditorPermissionRevokedDialog } from '@/features/editor/EditorPermissionRevokedDialog';
import { EditorSessionExpiredDialog } from '@/features/editor/EditorSessionExpiredDialog';
import type { EditorAccessInterruption } from '@/features/editor/useEditorPermissionRevocation';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { MapThemeReloadRequiredDialog } from './MapThemeReloadRequiredDialog';

type Navigate = (destination: string) => void;

export interface MapThemeEditorInterruptionDialogsProps {
  interruption: EditorAccessInterruption | null;
  reloadRequired: boolean;
  navigate?: Navigate;
  reload?: () => void;
}

export function MapThemeEditorInterruptionDialogs({
  interruption,
  reloadRequired,
  navigate = (destination) => window.location.assign(destination),
  reload = () => window.location.reload(),
}: MapThemeEditorInterruptionDialogsProps) {
  if (interruption === 'permission_revoked') {
    return <EditorPermissionRevokedDialog opened onConfirm={() => navigate('/')} />;
  }

  if (interruption === 'session_expired') {
    return <EditorSessionExpiredDialog opened onConfirm={() => navigate(buildLoginRedirectHref(currentPagePath()))} />;
  }

  if (reloadRequired) {
    return <MapThemeReloadRequiredDialog opened onReload={reload} />;
  }

  return null;
}

export function currentPagePath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

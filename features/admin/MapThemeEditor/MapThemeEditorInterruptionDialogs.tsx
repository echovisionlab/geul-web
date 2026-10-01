'use client';

import { EditorPermissionRevokedDialog } from '@/features/editor/EditorPermissionRevokedDialog';
import { EditorSessionExpiredDialog } from '@/features/editor/EditorSessionExpiredDialog';
import type { EditorAccessInterruption } from '@/features/editor/useEditorPermissionRevocation';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';

type Navigate = (destination: string) => void;

export interface MapThemeEditorInterruptionDialogsProps {
  interruption: EditorAccessInterruption | null;
  navigate?: Navigate;
}

export function MapThemeEditorInterruptionDialogs({
  interruption,
  navigate = (destination) => window.location.assign(destination),
}: MapThemeEditorInterruptionDialogsProps) {
  if (interruption === 'permission_revoked') {
    return <EditorPermissionRevokedDialog opened onConfirm={() => navigate('/')} />;
  }

  if (interruption === 'session_expired') {
    return <EditorSessionExpiredDialog opened onConfirm={() => navigate(buildLoginRedirectHref(currentPagePath()))} />;
  }

  return null;
}

export function currentPagePath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

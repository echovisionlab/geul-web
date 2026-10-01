'use client';

import { EditorPermissionRevokedDialog } from '@/features/editor/EditorPermissionRevokedDialog';
import { EditorSessionExpiredDialog } from '@/features/editor/EditorSessionExpiredDialog';
import type { EditorAccessInterruption } from '@/features/editor/useEditorPermissionRevocation';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';

type Navigate = (destination: string) => void;

export interface PageEditorInterruptionDialogsProps {
  interruption: EditorAccessInterruption | null;
  permissionRevokedDestination: string;
  navigate?: Navigate;
  currentPath?: () => string;
}

export function PageEditorInterruptionDialogs({
  interruption,
  permissionRevokedDestination,
  navigate = (destination) => window.location.assign(destination),
  currentPath = getCurrentPagePath,
}: PageEditorInterruptionDialogsProps) {
  if (interruption === 'permission_revoked') {
    return <EditorPermissionRevokedDialog opened onConfirm={() => navigate(permissionRevokedDestination)} />;
  }

  if (interruption === 'session_expired') {
    return <EditorSessionExpiredDialog opened onConfirm={() => navigate(buildLoginRedirectHref(currentPath()))} />;
  }

  return null;
}

function getCurrentPagePath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

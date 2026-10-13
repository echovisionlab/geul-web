'use client';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';

import { EntityTranslationsPanel } from './EntityTranslationsPanel';

interface EmailEntityTranslationsPanelProps {
  entityId: string;
  canManage?: boolean;
}

export function EmailEntityTranslationsPanel({ entityId, canManage = true }: EmailEntityTranslationsPanelProps) {
  return (
    <AuthoringExtension kind="translations">
      <EntityTranslationsPanel entityType="email_layout" entityId={entityId} canManage={canManage} />
    </AuthoringExtension>
  );
}

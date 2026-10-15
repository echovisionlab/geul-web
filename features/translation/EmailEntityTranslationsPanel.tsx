'use client';

import { AuthoringExtension } from '@/features/authoring/AuthoringExtensionsContext';

import { EntityTranslationsPanel } from './EntityTranslationsPanel';

interface EmailEntityTranslationsPanelProps {
  entityId: string;
  canManage?: boolean;
  canEdit?: boolean;
}

export function EmailEntityTranslationsPanel({
  entityId,
  canManage = true,
  canEdit = canManage,
}: EmailEntityTranslationsPanelProps) {
  return (
    <AuthoringExtension kind="translations">
      <EntityTranslationsPanel
        entityType="email_layout"
        entityId={entityId}
        canManage={canManage}
        canAdministerTranslations={canEdit}
        canMutateTargets={canEdit}
      />
    </AuthoringExtension>
  );
}

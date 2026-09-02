'use client';

import { EntityTranslationsPanel } from './EntityTranslationsPanel';

interface EmailEntityTranslationsPanelProps {
  entityId: string;
  canManage?: boolean;
}

export function EmailEntityTranslationsPanel({ entityId, canManage = true }: EmailEntityTranslationsPanelProps) {
  return <EntityTranslationsPanel entityType="email_layout" entityId={entityId} canManage={canManage} />;
}

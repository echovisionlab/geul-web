'use client';

import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { useFormEditorContext } from '@/lib/contexts/FormEditorContext';

export function FormTranslationsPanel({ formId }: { formId: string }) {
  const { provider } = useFormEditorContext();
  const canEdit = useEditorAccessLevel(provider) === 'edit';
  return (
    <EntityTranslationsPanel
      entityType="form"
      entityId={formId}
      collapsible={false}
      canManage
      canAdministerTranslations={canEdit}
      canMutateTargets={canEdit}
    />
  );
}

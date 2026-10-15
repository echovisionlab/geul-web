'use client';

import { useEditorAccessLevel } from '@/features/editor/useEditorAccessLevel';

import { useCallback } from 'react';
import { useFormEditorContext } from '@/lib/contexts/FormEditorContext';
import { useFormTranslationContext } from '@/features/form/FormTranslationContext';
import type { FormSchema } from '@/lib/types/form/schema';
import { FormBuilder } from '../FormBuilder/FormBuilder';

export function FormEditor() {
  const { fields, isSynced, setField, provider } = useFormEditorContext();
  const { activeEditLocale, isEditingScopedLocale } = useFormTranslationContext();
  const canEdit = useEditorAccessLevel(provider) === 'edit';
  const isViewingTargetLocale = Boolean(activeEditLocale.activeLocale) && !activeEditLocale.isSourceLocale;
  const isExistingTargetLocale = isViewingTargetLocale && activeEditLocale.hasLiveRow;

  const handleSchemaChange = useCallback(
    (newSchema: FormSchema) => {
      if (canEdit && isSynced && (!isViewingTargetLocale || isExistingTargetLocale)) {
        setField('schema', newSchema);
      }
    },
    [canEdit, isExistingTargetLocale, isSynced, isViewingTargetLocale, setField],
  );

  return (
    <FormBuilder
      schema={fields.schema}
      onChange={handleSchemaChange}
      title={fields.title}
      mode={
        !canEdit || !isSynced
          ? 'readOnly'
          : isExistingTargetLocale
            ? 'translation'
            : isEditingScopedLocale
              ? 'readOnly'
              : 'full'
      }
    />
  );
}

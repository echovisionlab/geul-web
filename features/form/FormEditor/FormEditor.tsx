'use client';

import { useCallback } from 'react';
import { useFormEditorContext } from '@/lib/contexts/FormEditorContext';
import { useFormTranslationContext } from '@/features/form/FormTranslationContext';
import type { FormSchema } from '@/lib/types/form/schema';
import { FormBuilder } from '../FormBuilder/FormBuilder';

export function FormEditor() {
  const { fields, setField } = useFormEditorContext();
  const { activeEditLocale, isEditingScopedLocale } = useFormTranslationContext();
  const isViewingTargetLocale = Boolean(activeEditLocale.activeLocale) && !activeEditLocale.isSourceLocale;
  const isExistingTargetLocale = isViewingTargetLocale && activeEditLocale.hasLiveRow;

  const handleSchemaChange = useCallback(
    (newSchema: FormSchema) => {
      if (!isViewingTargetLocale || isExistingTargetLocale) {
        setField('schema', newSchema);
      }
    },
    [isExistingTargetLocale, isViewingTargetLocale, setField],
  );

  return (
    <FormBuilder
      schema={fields.schema}
      onChange={handleSchemaChange}
      title={fields.title}
      mode={isExistingTargetLocale ? 'translation' : isEditingScopedLocale ? 'readOnly' : 'full'}
    />
  );
}

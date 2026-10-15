'use client';

import { LayoutStack as DsLayoutStack, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { useState } from 'react';
import { SortableSurface, useSortableItem } from '@/components/core/Sortable';
import { IconGripVertical, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Disclosure } from '@/components/core/Disclosure';
import { IconButton } from '@/components/core/IconButton';
import { TextInput, NumberInput } from '@/components/core/Input';
import { SectionCard } from '@/components/core/Section';
import type { FieldType } from '@/lib/types/form/model';
import type { FieldValidator } from '@/lib/types/form/schema';
import { getLocalizedPredicateLabel } from '../i18n';
import { getValidatorLabel } from './helpers';

interface ValidatorEditorProps {
  id: string;
  validator: FieldValidator;
  fieldType: FieldType;
  onChange: (validator: FieldValidator) => void;
  onRemove: () => void;
  mode?: 'full' | 'translation' | 'readOnly';
}

export function ValidatorEditor({ id, validator, fieldType, onChange, onRemove, mode = 'full' }: ValidatorEditorProps) {
  const t = useTranslations('formAdmin.builder');
  const tCommonLabels = useTranslations('common.labels');
  const [isOpen, setIsOpen] = useState(false);
  const hasValueInput = ['gt', 'gte', 'lt', 'lte', 'eq', 'regex', 'minDate', 'maxDate', 'minAge', 'maxAge'].includes(
    validator.predicate,
  );
  const isDateValuePredicate = ['minDate', 'maxDate'].includes(validator.predicate);
  const isAgeValuePredicate = ['minAge', 'maxAge'].includes(validator.predicate);
  const canEditLocalizedText = mode !== 'readOnly';
  const canEditStructure = mode === 'full';

  const sortable = useSortableItem({
    id,
    disabled: !canEditStructure,
  });

  const getValueLabel = (): string => {
    if (['text', 'textarea', 'email'].includes(fieldType)) {
      return t('validators.length');
    }
    if (fieldType === 'number') {
      return tCommonLabels('value');
    }
    if (fieldType === 'multiselect') {
      return t('validators.count');
    }
    return tCommonLabels('value');
  };

  const isComparisonOperator = ['gt', 'gte', 'lt', 'lte', 'eq'].includes(validator.predicate);

  return (
    <SortableSurface ref={sortable.setNodeRef} motion={sortable.motion}>
      <SectionCard padding="none" appearance="plain">
        <Disclosure
          nested
          label={getValidatorLabel(validator, (predicateName) =>
            getLocalizedPredicateLabel(t, predicateName, tCommonLabels),
          )}
          density="compact"
          chevronPosition="end"
          withDivider={false}
          contentIndent="label"
          opened={isOpen}
          onChange={setIsOpen}
          leadingActions={
            canEditStructure ? (
              <IconButton
                aria-label={t('validators.dragValidator')}
                interaction="drag-handle"
                draggable={false}
                {...sortable.handle}
              >
                <IconGripVertical aria-hidden />
              </IconButton>
            ) : undefined
          }
          actions={
            canEditStructure ? (
              <IconButton size="compact" tone="danger" aria-label={t('validators.removeValidator')} onClick={onRemove}>
                <IconTrash size={16} aria-hidden />
              </IconButton>
            ) : undefined
          }
        >
          <DsLayoutInset space="none">
            <DsLayoutStack gap="xxs">
              {hasValueInput && isComparisonOperator && (
                <NumberInput
                  label={getValueLabel()}
                  size="xs"
                  value={validator.value?.toString() ?? ''}
                  onChange={(val) => {
                    if (!canEditStructure) {
                      return;
                    }
                    const num = fieldType === 'number' ? parseFloat(String(val)) : parseInt(String(val), 10);
                    if (!isNaN(num)) {
                      onChange({ ...validator, value: num });
                    }
                  }}
                  readOnly={!canEditStructure}
                />
              )}
              {isDateValuePredicate && (
                <TextInput
                  label={t('validators.date')}
                  size="xs"
                  type="date"
                  value={typeof validator.value === 'string' ? validator.value : ''}
                  onChange={(e) => onChange({ ...validator, value: e.currentTarget.value || undefined })}
                  readOnly={!canEditStructure}
                />
              )}
              {isAgeValuePredicate && (
                <NumberInput
                  label={t('validators.age')}
                  size="xs"
                  min={0}
                  value={validator.value?.toString() ?? ''}
                  onChange={(val) => {
                    if (!canEditStructure) {
                      return;
                    }
                    const num = parseInt(String(val), 10);
                    if (!isNaN(num) && num >= 0) {
                      onChange({ ...validator, value: num });
                    }
                  }}
                  readOnly={!canEditStructure}
                />
              )}
              {validator.predicate === 'regex' && (
                <TextInput
                  label={t('validators.pattern')}
                  size="xs"
                  placeholder={t('validators.patternPlaceholder')}
                  value={typeof validator.value === 'string' ? validator.value : ''}
                  onChange={(e) => {
                    onChange({ ...validator, value: e.currentTarget.value });
                  }}
                  readOnly={!canEditStructure}
                />
              )}
              <TextInput
                label={t('validators.customErrorMessage')}
                size="xs"
                placeholder={t('validators.optional')}
                value={validator.message ?? ''}
                onChange={(e) => {
                  const msg = e.currentTarget.value;
                  onChange({ ...validator, message: msg || undefined });
                }}
                readOnly={!canEditLocalizedText}
              />
            </DsLayoutStack>
          </DsLayoutInset>
        </Disclosure>
      </SectionCard>
    </SortableSurface>
  );
}

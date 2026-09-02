'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconChevronDown, IconChevronRight, IconGripVertical, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Collapse, Group, Stack, Text } from '@mantine/core';
import { IconButton } from '@/components/core/IconButton';
import { TextInput } from '@/components/core/Input';
import { SectionCard } from '@/components/core/Section';
import { TextButton } from '@/components/core/TextButton';
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
  const detailsPanelId = `validator-details-${id}`;
  const hasValueInput = ['gt', 'gte', 'lt', 'lte', 'eq', 'regex', 'minDate', 'maxDate', 'minAge', 'maxAge'].includes(
    validator.predicate,
  );
  const isDateValuePredicate = ['minDate', 'maxDate'].includes(validator.predicate);
  const isAgeValuePredicate = ['minAge', 'maxAge'].includes(validator.predicate);
  const canEditLocalizedText = mode !== 'readOnly';
  const canEditStructure = mode === 'full';

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !canEditStructure,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

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
    <SectionCard ref={setNodeRef} style={style} p="xs">
      <Group justify="space-between" gap="xs">
        <Group gap="xs" style={{ flex: 1 }}>
          <IconButton
            size="xs"
            emphasis="low"
            aria-label="Drag validator"
            style={{ cursor: 'grab', touchAction: 'none' }}
            {...(canEditStructure ? attributes : {})}
            {...(canEditStructure ? listeners : {})}
            disabled={!canEditStructure}
          >
            <IconGripVertical size={12} />
          </IconButton>
          <TextButton
            appearance="default"
            size="xs"
            fullWidth
            display="flex"
            aria-expanded={isOpen}
            aria-controls={detailsPanelId}
            onClick={() => setIsOpen((open) => !open)}
            style={{ flex: 1 }}
          >
            <Group gap="xs">
              {isOpen ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
              <Text size="xs" fw={500}>
                {getValidatorLabel(validator, (predicateName) =>
                  getLocalizedPredicateLabel(t, predicateName, tCommonLabels),
                )}
              </Text>
              {validator.message && (
                <Text size="xs" c="dimmed" truncate style={{ maxWidth: 120 }}>
                  ({validator.message})
                </Text>
              )}
            </Group>
          </TextButton>
        </Group>
        {canEditStructure ? (
          <IconButton
            size="xs"
            tone="danger"
            emphasis="low"
            aria-label={t('validators.removeValidator')}
            onClick={onRemove}
          >
            <IconTrash size={12} />
          </IconButton>
        ) : null}
      </Group>

      <Collapse id={detailsPanelId} expanded={isOpen}>
        <Stack gap="xs" mt="xs">
          {hasValueInput && isComparisonOperator && (
            <TextInput
              label={getValueLabel()}
              size="xs"
              type="number"
              value={validator.value?.toString() ?? ''}
              onChange={(e) => {
                if (!canEditStructure) {
                  return;
                }
                const val = e.currentTarget.value;
                const num = fieldType === 'number' ? parseFloat(val) : parseInt(val, 10);
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
            <TextInput
              label={t('validators.age')}
              size="xs"
              type="number"
              min={0}
              value={validator.value?.toString() ?? ''}
              onChange={(e) => {
                if (!canEditStructure) {
                  return;
                }
                const val = e.currentTarget.value;
                const num = parseInt(val, 10);
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
        </Stack>
      </Collapse>
    </SectionCard>
  );
}

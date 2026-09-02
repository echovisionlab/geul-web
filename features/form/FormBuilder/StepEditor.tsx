'use client';

import { useState } from 'react';
import { IconChevronDown, IconChevronRight, IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Collapse, Group, Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Textarea, TextInput, Checkbox } from '@/components/core/Input';
import { SectionCard } from '@/components/core/Section';
import { TextButton } from '@/components/core/TextButton';
import type { DragHandleProps } from '@/components/core/Sortable';
import type { FormStepSchema } from '@/lib/types/form/schema';
import { getFieldLabel } from '../FormField/utils';
import { StepConditionEditor } from './ConditionEditor';

// =============================================================================
// Step Editor
// =============================================================================

interface StepEditorProps {
  step: FormStepSchema;
  allSteps: FormStepSchema[];
  stepIndex: number;
  isDropTarget: boolean;
  dragHandleProps: DragHandleProps;
  children: React.ReactNode;
  onChange: (step: FormStepSchema) => void;
  onRemove: () => void;
  onAddField: () => void;
  mode?: 'full' | 'translation' | 'readOnly';
}

export function StepEditor({
  step,
  allSteps,
  stepIndex,
  isDropTarget,
  dragHandleProps,
  children,
  onChange,
  onRemove,
  onAddField,
  mode = 'full',
}: StepEditorProps) {
  const t = useTranslations('formAdmin.builder');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');
  const tPageEditor = useTranslations('pageEditor');
  const [isOpen, setIsOpen] = useState(false);
  const detailsPanelId = `step-details-${step.id}`;
  const fields = step.fields ?? [];
  const canEditLocalizedText = mode !== 'readOnly';
  const canEditStructure = mode === 'full';

  // Previous steps' fields (for condition setup)
  const previousFields = allSteps
    .slice(0, stepIndex)
    .flatMap((s) => s.fields ?? [])
    .map((f) => ({
      label: getFieldLabel(f),
      value: f.id,
      field: f,
    }));

  return (
    <SectionCard
      withBorder
      p="sm"
      mb="sm"
      style={{
        borderColor: isDropTarget ? 'var(--mantine-color-blue-filled)' : undefined,
        backgroundColor: isDropTarget ? 'var(--mantine-color-blue-light)' : undefined,
      }}
    >
      <Group justify="space-between">
        <Group gap="xs" style={{ flex: 1 }}>
          <IconButton
            size="sm"
            emphasis="low"
            style={{ cursor: 'grab', touchAction: 'none' }}
            aria-label={t('step.dragStep', { index: stepIndex + 1 })}
            {...(canEditStructure ? dragHandleProps.attributes : {})}
            {...(canEditStructure ? dragHandleProps.listeners : {})}
            disabled={!canEditStructure}
          >
            <IconGripVertical size={16} />
          </IconButton>
          <TextButton
            appearance="default"
            size="sm"
            fullWidth
            display="flex"
            aria-expanded={isOpen}
            aria-controls={detailsPanelId}
            onClick={() => setIsOpen((open) => !open)}
            style={{ flex: 1 }}
          >
            <Group gap="xs">
              {isOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              <Text size="sm" fw={500}>
                {step.title || tCommonStates('untitledPlain')}
              </Text>
              <Text size="xs" c="dimmed">
                {t('step.fieldsCount', { count: fields.length })}
              </Text>
            </Group>
          </TextButton>
        </Group>
        {canEditStructure ? (
          <IconButton
            tone="danger"
            emphasis="low"
            aria-label={t('step.removeStep', { index: stepIndex + 1 })}
            onClick={onRemove}
          >
            <IconTrash size={16} />
          </IconButton>
        ) : null}
      </Group>

      <Collapse id={detailsPanelId} expanded={isOpen}>
        <Stack gap="xs" mt="xs">
          <TextInput
            label={tCommonLabels('title')}
            size="xs"
            value={step.title ?? ''}
            onChange={(e) =>
              onChange({
                ...step,
                title: e.currentTarget.value.trim() ? e.currentTarget.value : undefined,
              })
            }
            readOnly={!canEditLocalizedText}
          />
          {canEditStructure ? (
            <Checkbox
              label={tPageEditor('showTitleOnPage')}
              size="xs"
              checked={step.showTitle !== false}
              onChange={(e) => onChange({ ...step, showTitle: e.currentTarget.checked })}
            />
          ) : null}
          <Textarea
            label={tCommonLabels('description')}
            size="xs"
            value={step.description ?? ''}
            onChange={(e) => onChange({ ...step, description: e.currentTarget.value || undefined })}
            minRows={1}
            readOnly={!canEditLocalizedText}
          />

          <Box>
            <Group justify="space-between" mb="xs">
              <Text size="xs" fw={500}>
                {t('step.fieldsLabel', { count: fields.length })}
              </Text>
              {canEditStructure ? (
                <Button size="xs" emphasis="medium" leftSection={<IconPlus size={12} />} onClick={onAddField}>
                  {t('step.addField')}
                </Button>
              ) : null}
            </Group>
            {children}
          </Box>

          {mode === 'full' && previousFields.length > 0 && (
            <Box>
              <Checkbox
                label={t('step.hasCondition')}
                size="xs"
                checked={!!step.condition}
                onChange={(e) => {
                  if (e.currentTarget.checked) {
                    onChange({
                      ...step,
                      condition: { fieldId: previousFields[0].value, operator: 'eq', value: '' },
                    });
                  } else {
                    const { condition: _, ...rest } = step;
                    onChange(rest);
                  }
                }}
              />
              {step.condition && (
                <Box mt="xs">
                  <StepConditionEditor
                    condition={step.condition}
                    availableFields={previousFields}
                    onChange={(condition) => {
                      if (condition) {
                        onChange({ ...step, condition });
                      } else {
                        const { condition: _, ...rest } = step;
                        onChange(rest);
                      }
                    }}
                  />
                </Box>
              )}
            </Box>
          )}
        </Stack>
      </Collapse>
    </SectionCard>
  );
}

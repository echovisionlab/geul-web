'use client';

import { interactionBindings } from '@/components/core/bindings';
import {
  LayoutInline as DsLayoutInline,
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
  LayoutInset,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';

import { useState } from 'react';
import { IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Disclosure } from '@/components/core/Disclosure';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Textarea, TextInput, Checkbox } from '@/components/core/Input';
import { SectionCard } from '@/components/core/Section';
import type { DragHandleProps } from '@/components/core/Sortable';
import type { FormStepSchema } from '@/lib/types/form/schema';
import { getFieldLabel } from '../FormField/utils';
import { StepConditionEditor } from './ConditionEditor';

// =============================================================================
// Step Editor
// =============================================================================

interface StepEditorProps {
  containerId?: string;
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
  containerId,
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
    <LayoutInset id={containerId} space="none" blockEnd="xxs">
      <SectionCard state={isDropTarget ? 'drop-target' : 'default'} appearance="plain" padding="none">
        <Disclosure
          label={
            <DsLayoutInline gap="xxs">
              <DsText size="xs" weight="medium">
                {step.title || tCommonStates('untitledPlain')}
              </DsText>
              <DsText size="xs" tone="secondary">
                {t('step.fieldsCount', { count: fields.length })}
              </DsText>
            </DsLayoutInline>
          }
          opened={isOpen}
          onChange={setIsOpen}
          density="compact"
          withDivider={false}
          chevronPosition="end"
          leadingActions={
            canEditStructure ? (
              <IconButton
                emphasis="low"
                interaction="drag-handle"
                draggable={false}
                aria-label={t('step.dragStep', { index: stepIndex + 1 })}
                {...interactionBindings(dragHandleProps.attributes)}
                {...interactionBindings(dragHandleProps.listeners)}
              >
                <IconGripVertical aria-hidden />
              </IconButton>
            ) : undefined
          }
          actions={
            canEditStructure ? (
              <IconButton
                size="compact"
                tone="danger"
                emphasis="low"
                aria-label={t('step.removeStep', { index: stepIndex + 1 })}
                onClick={onRemove}
              >
                <IconTrash size={16} aria-hidden />
              </IconButton>
            ) : undefined
          }
        >
          <DsLayoutInset space="none">
            <DsLayoutStack gap="xxs">
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

              <div>
                <DsLayoutInset blockEnd="xxs">
                  <DsLayoutInline justify="between">
                    <DsText size="xs" weight="medium">
                      {t('step.fieldsLabel', { count: fields.length })}
                    </DsText>
                    {canEditStructure ? (
                      <Button
                        id={containerId ? `${containerId}-add` : undefined}
                        size="xs"
                        emphasis="medium"
                        leftSection={<IconPlus size={12} />}
                        onClick={onAddField}
                      >
                        {t('step.addField')}
                      </Button>
                    ) : null}
                  </DsLayoutInline>
                </DsLayoutInset>
                {children}
              </div>

              {mode === 'full' && previousFields.length > 0 && (
                <div>
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
                    <DsLayoutInset blockStart="xs">
                      <DsLayoutInset space="none">
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
                      </DsLayoutInset>
                    </DsLayoutInset>
                  )}
                </div>
              )}
            </DsLayoutStack>
          </DsLayoutInset>
        </Disclosure>
      </SectionCard>
    </LayoutInset>
  );
}

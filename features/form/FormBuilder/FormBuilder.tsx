'use client';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutGrid as DsLayoutGrid,
  LayoutGridItem as DsLayoutGridItem,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import { useId, useMemo, useRef, useState } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { Disclosure } from '@/components/core/Disclosure';
import { SectionCard } from '@/components/core/Section';
import { Textarea } from '@/components/core/Input';
import { SortableGroups, type RenderGroupProps, type RenderItemProps } from '@/components/core/Sortable';
import { FormRenderer } from '@/features/form/FormRenderer';
import { useFormValidationMessages } from '@/features/form/useFormValidationMessages';
import { buildForm } from '@/lib/form/build';
import { validateCanonicalFormSchemaForPersistence } from '@/lib/form/schema-persistence';
import { isConditionGroup, type FieldItem, type StepGroup } from '@/lib/types/form/model';
import type { FormFieldSchema, FormSchema, FormStepCondition, FormStepSchema } from '@/lib/types/form/schema';
// Editing surfaces ship every field type up front: this static edge keeps the phone field (and its
// validation library) in the builder bundle, while public forms load it only when they need it.
import '../FormField/fields/PhoneField';
import { getFieldLabel } from '../FormField/utils';
import { FieldEditor } from './FieldEditor';
import { StepEditor } from './StepEditor';

// =============================================================================
// Condition Reference Helpers
// =============================================================================

/**
 * Get all field IDs referenced in a condition (recursively for groups)
 */
function getReferencedFieldIDs(condition: FormStepCondition): string[] {
  if (isConditionGroup(condition)) {
    return condition.conditions.flatMap(getReferencedFieldIDs);
  }
  return [condition.fieldId ?? condition.field ?? ''];
}

/**
 * Find all steps that have conditions referencing a specific field ID
 */
function findStepsReferencingField(steps: FormStepSchema[], fieldId: string): FormStepSchema[] {
  return steps.filter((step) => {
    if (!step.condition) {
      return false;
    }
    const referencedFields = getReferencedFieldIDs(step.condition);
    return referencedFields.includes(fieldId);
  });
}

// =============================================================================
// FormBuilder Component
// =============================================================================

interface FormBuilderProps {
  initialSchema?: FormSchema;
  schema?: FormSchema;
  onChange?: (schema: FormSchema) => void;
  title?: string;
  mode?: 'full' | 'translation' | 'readOnly';
}

export function FormBuilder({
  initialSchema,
  schema: controlledSchema,
  onChange,
  title,
  mode = 'full',
}: FormBuilderProps) {
  const t = useTranslations('formAdmin.builder');
  const tCommonLabels = useTranslations('common.labels');
  const tA11y = useTranslations('pageEditor.a11y');
  const scopeId = useId();
  const focusEditor = (kind: 'step' | 'field', id?: string) => {
    requestAnimationFrame(() => {
      if (id) {
        document
          .getElementById(`${scopeId}-${kind}-${id}`)
          ?.querySelector<HTMLButtonElement>('button[data-accordion-control]')
          ?.focus();
      } else {
        document.getElementById(`${scopeId}-add-step`)?.focus();
      }
    });
  };
  const validationMessages = useFormValidationMessages();
  const [localSchema, setLocalSchema] = useState<FormSchema>(() => {
    if (initialSchema) {
      return initialSchema;
    }

    return {
      id: 'new-form',
      steps: [
        {
          id: 'intro',
          showTitle: true,
          title: t('defaults.initialStepTitle'),
          description: t('defaults.initialStepDescription'),
        },
      ],
    };
  });
  const schema = controlledSchema ?? localSchema;
  const canEditStructure = mode === 'full';
  const isReadOnly = mode === 'readOnly';

  const updateSchema = (newSchema: FormSchema) => {
    if (isReadOnly) {
      return;
    }
    if (!controlledSchema) {
      setLocalSchema(newSchema);
    }
    onChange?.(newSchema);
  };

  // Convert schema to SortableGroups format with memoization
  const groups = useMemo(
    (): StepGroup[] =>
      schema.steps.map((step, stepIndex) => ({
        id: step.id,
        step,
        stepIndex,
        items: (step.fields ?? []).map((field, fieldIndex) => ({
          id: field.id,
          field,
          fieldIndex,
        })),
      })),
    [schema.steps],
  );

  // SortableGroups announces stable schema entities rather than generated IDs.
  const dragSubject = useRef<{ id: string; kind: 'step' | 'field'; label: string } | null>(null);
  const describeDrag = (id: string | number) => {
    for (const group of groups) {
      const stepLabel = group.step.title || tCommonLabels('title');
      if (String(id) === `group-${group.id}`) {
        return {
          id: group.id,
          kind: 'step' as const,
          label: stepLabel,
          index: group.stepIndex + 1,
          count: groups.length,
        };
      }
      for (const item of group.items) {
        if (String(id) === `item-${group.id}-${item.id}`) {
          return {
            id: item.id,
            kind: 'field' as const,
            label: `${getFieldLabel(item.field)} · ${stepLabel}`,
            index: item.fieldIndex + 1,
            count: group.items.length,
          };
        }
      }
    }
    return undefined;
  };
  const announceDrag = (
    event: 'dragStart' | 'dragOver' | 'dragEnd' | 'dragCancel',
    activeId: string | number,
    targetId?: string | number,
  ) => {
    const active = describeDrag(activeId);
    if (event === 'dragStart' && active) {
      dragSubject.current = active;
    }
    const subject = active ?? dragSubject.current;
    if (!subject) {
      return undefined;
    }
    const target = targetId === undefined ? active : describeDrag(targetId);
    const fieldPosition =
      subject.kind === 'field'
        ? groups
            .flatMap((group) => group.items.map((item) => ({ item, group })))
            .find(({ item }) => item.id === subject.id)
        : undefined;
    const index =
      target?.kind === subject.kind
        ? target.index
        : fieldPosition
          ? fieldPosition.item.fieldIndex + 1
          : (active?.index ?? 1);
    const count =
      target?.kind === subject.kind
        ? target.count
        : (fieldPosition?.group.items.length ?? active?.count ?? groups.length);
    const section = target && target.kind !== subject.kind ? `${subject.label} · ${target.label}` : subject.label;
    return tA11y(event, { section, index, count });
  };

  const persistenceValidation = useMemo(() => validateCanonicalFormSchemaForPersistence(schema), [schema]);

  // Handle groups change from SortableGroups
  const handleGroupsChange = (newGroups: StepGroup[]) => {
    const newSteps = newGroups.map((group) => ({
      ...group.step,
      fields: group.items.map((item) => item.field),
    }));
    updateSchema({ ...schema, steps: newSteps });
  };

  const updateStep = (stepIndex: number, step: FormStepSchema) => {
    const newSteps = [...schema.steps];
    newSteps[stepIndex] = step;
    updateSchema({ ...schema, steps: newSteps });
  };

  const removeStep = (stepIndex: number) => {
    const step = schema.steps[stepIndex];
    const fields = step.fields ?? [];
    const fieldIDs = fields.map((f) => f.id);

    // Check if any fields from this step are referenced by later steps
    if (fieldIDs.length > 0) {
      const laterSteps = schema.steps.slice(stepIndex + 1);
      for (const field of fields) {
        const referencingSteps = findStepsReferencingField(laterSteps, field.id);
        if (referencingSteps.length > 0) {
          const stepNames = referencingSteps.map((s) => `"${s.title}"`).join(', ');
          notifications.show({
            title: t('notifications.cannotDeleteStepTitle'),
            message: t('notifications.cannotDeleteStepMessage', {
              fieldName: getFieldLabel(field),
              stepNames,
            }),
            tone: 'danger',
          });
          return;
        }
      }
    }

    const nextSteps = schema.steps.filter((_, i) => i !== stepIndex);
    updateSchema({ ...schema, steps: nextSteps });
    focusEditor('step', nextSteps[Math.min(stepIndex, nextSteps.length - 1)]?.id);
  };

  const addStep = () => {
    const newId = `step_${crypto.randomUUID().slice(0, 8)}`;
    updateSchema({
      ...schema,
      steps: [...schema.steps, { id: newId, showTitle: true, title: t('defaults.newStepTitle') }],
    });
  };

  const addField = (stepIndex: number) => {
    const step = schema.steps[stepIndex];
    const fields = step.fields ?? [];
    const newFieldId = crypto.randomUUID();
    updateStep(stepIndex, {
      ...step,
      fields: [
        ...fields,
        {
          id: newFieldId,
          key: `field_${fields.length + 1}`,
          label: t('defaults.newFieldName'),
          type: 'text',
        },
      ],
    });
  };

  const updateField = (stepIndex: number, fieldIndex: number, field: FormFieldSchema) => {
    const step = schema.steps[stepIndex];
    const newFields = [...(step.fields ?? [])];
    newFields[fieldIndex] = field;
    updateStep(stepIndex, { ...step, fields: newFields });
  };

  const removeField = (stepIndex: number, fieldIndex: number) => {
    const step = schema.steps[stepIndex];
    const field = step.fields?.[fieldIndex];

    // Check if field is referenced by any condition
    if (field) {
      const referencingSteps = findStepsReferencingField(schema.steps, field.id);
      if (referencingSteps.length > 0) {
        const stepNames = referencingSteps.map((s) => `"${s.title}"`).join(', ');
        notifications.show({
          title: t('notifications.cannotDeleteFieldTitle'),
          message: t('notifications.fieldReferencedMessage', { stepNames }),
          tone: 'danger',
        });
        return;
      }
    }

    const nextFields = (step.fields ?? []).filter((_, i) => i !== fieldIndex);
    updateStep(stepIndex, { ...step, fields: nextFields });
    if (nextFields.length) {
      focusEditor('field', nextFields[Math.min(fieldIndex, nextFields.length - 1)].id);
    } else {
      requestAnimationFrame(() => document.getElementById(`${scopeId}-step-${step.id}-add`)?.focus());
    }
  };

  // Render functions for SortableGroups
  const renderGroup = ({ group, children, isDropTarget, dragHandleProps }: RenderGroupProps<StepGroup, FieldItem>) => (
    <StepEditor
      containerId={`${scopeId}-step-${group.id}`}
      step={group.step}
      allSteps={schema.steps}
      stepIndex={group.stepIndex}
      isDropTarget={isDropTarget}
      dragHandleProps={dragHandleProps}
      onChange={(step) => updateStep(group.stepIndex, step)}
      onRemove={() => removeStep(group.stepIndex)}
      onAddField={() => addField(group.stepIndex)}
      mode={mode}
    >
      {children}
    </StepEditor>
  );

  const renderItem = ({ item, groupId, dragHandleProps }: RenderItemProps<FieldItem>) => {
    const stepIndex = schema.steps.findIndex((s) => s.id === groupId);

    // Available fields for condition: fields from previous steps + fields before this one in current step
    const availableFields = [
      // Fields from previous steps
      ...schema.steps.slice(0, stepIndex).flatMap((s) => s.fields ?? []),
      // Fields before this one in the current step
      ...(schema.steps[stepIndex]?.fields ?? []).slice(0, item.fieldIndex),
    ].map((f) => ({
      label: getFieldLabel(f),
      value: f.id,
      field: f,
    }));

    return (
      <FieldEditor
        containerId={`${scopeId}-field-${item.id}`}
        field={item.field}
        dragHandleProps={dragHandleProps}
        onChange={(field) => updateField(stepIndex, item.fieldIndex, field)}
        onRemove={() => removeField(stepIndex, item.fieldIndex)}
        fieldKeyError={
          persistenceValidation.fieldKeyIssues[item.field.id] === 'field.key.required'
            ? `${tCommonLabels('key')} ${tCommonLabels('required')}`
            : persistenceValidation.fieldKeyIssues[item.field.id] === 'field.key.duplicate'
              ? t('field.fieldNameUnique')
              : undefined
        }
        availableFields={availableFields}
        mode={mode}
      />
    );
  };

  // Serialize → Deserialize → Build to validate round-trip
  const builtForm = useMemo(() => {
    if (!persistenceValidation.valid) {
      return null;
    }
    try {
      const serialized = JSON.stringify(schema);
      const deserialized: FormSchema = JSON.parse(serialized);
      return buildForm(deserialized, { validationMessages });
    } catch {
      return null;
    }
  }, [persistenceValidation.valid, schema, validationMessages]);

  return (
    <DsLayoutGrid columns={{ base: 1, md: 12 }} gap="sm">
      {/* Builder */}
      <DsLayoutGridItem span={{ base: 1, md: 7 }}>
        <DsLayoutInset space="xs">
          <DsLayoutStack gap="xxs">
            <DsHeading level={4} aria-level={2}>
              {t('title')}
            </DsHeading>

            <DsLayoutInline justify="between">
              <DsText size="sm" weight="strong">
                {t('steps')}
              </DsText>
              {canEditStructure ? (
                <Button
                  id={`${scopeId}-add-step`}
                  size="xs"
                  emphasis="medium"
                  leftSection={<IconPlus aria-hidden />}
                  onClick={addStep}
                >
                  {t('addStep')}
                </Button>
              ) : null}
            </DsLayoutInline>

            <SortableGroups
              groups={groups}
              accessibility={{
                instructions: tA11y('dragInstructions'),
                announcements: {
                  onDragStart: ({ active }) => announceDrag('dragStart', active.id),
                  onDragOver: ({ active, over }) => announceDrag('dragOver', active.id, over?.id),
                  onDragEnd: ({ active, over }) => announceDrag('dragEnd', active.id, over?.id),
                  onDragCancel: ({ active }) => announceDrag('dragCancel', active.id),
                },
              }}
              getGroupLabel={(group) => group.step.title || tCommonLabels('title')}
              getItemLabel={(item) => getFieldLabel(item.field) || t('field.untitledField')}
              onGroupsChange={handleGroupsChange}
              renderGroup={renderGroup}
              renderItem={renderItem}
            />

            <Disclosure label={t('schemaJson')} density="compact" withDivider={false}>
              <Textarea
                textRole="code"
                aria-label={t('schemaJson')}
                value={JSON.stringify(schema, null, 2)}
                autosize
                minRows={12}
                maxRows={30}
                readOnly
              />
            </Disclosure>
          </DsLayoutStack>
        </DsLayoutInset>
      </DsLayoutGridItem>

      {/* Preview follows the editing controls at every viewport. */}
      <DsLayoutGridItem span={{ base: 1, md: 5 }}>
        <DsLayoutInset space="xs">
          <DsLayoutStack gap="xs">
            <DsHeading level={4} aria-level={2}>
              {tCommonLabels('preview')}
            </DsHeading>

            <SectionCard padding="lg">
              {builtForm ? (
                <DsLayoutStack gap="lg">
                  {title && (
                    <DsHeading level={2} aria-level={3}>
                      {title}
                    </DsHeading>
                  )}
                  <FormRenderer
                    key={schema.id}
                    form={builtForm}
                    stepHeadingLevel={title ? 3 : 2}
                    stepHeadingAriaLevel={title ? 4 : 3}
                    onSubmit={(values) => {
                      alert(JSON.stringify(values, null, 2));
                    }}
                  />
                </DsLayoutStack>
              ) : (
                <DsText size="sm" tone="danger">
                  {t('invalidSchema')}
                </DsText>
              )}
            </SectionCard>
          </DsLayoutStack>
        </DsLayoutInset>
      </DsLayoutGridItem>
    </DsLayoutGrid>
  );
}

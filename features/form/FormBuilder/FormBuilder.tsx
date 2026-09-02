'use client';

import { useMemo, useState } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Group, Stack, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
import { Textarea } from '@/components/core/Input';
import { SortableGroups, type RenderGroupProps, type RenderItemProps } from '@/components/core/Sortable';
import { FormRenderer } from '@/features/form/FormRenderer';
import { useFormValidationMessages } from '@/features/form/useFormValidationMessages';
import { buildForm } from '@/lib/form/build';
import { validateCanonicalFormSchemaForPersistence } from '@/lib/form/schema-persistence';
import { isConditionGroup, type FieldItem, type StepGroup } from '@/lib/types/form/model';
import type { FormFieldSchema, FormSchema, FormStepCondition, FormStepSchema } from '@/lib/types/form/schema';
import { getFieldKey, getFieldLabel } from '../FormField/utils';
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
  const tCommonStates = useTranslations('common.states');
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
  const isMobile = useMediaQuery('(max-width: 768px)');
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
            color: 'red',
          });
          return;
        }
      }
    }

    updateSchema({ ...schema, steps: schema.steps.filter((_, i) => i !== stepIndex) });
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
          color: 'red',
        });
        return;
      }
    }

    updateStep(stepIndex, {
      ...step,
      fields: (step.fields ?? []).filter((_, i) => i !== fieldIndex),
    });
  };

  // Render functions for SortableGroups
  const renderGroup = ({ group, children, isDropTarget, dragHandleProps }: RenderGroupProps<StepGroup, FieldItem>) => (
    <StepEditor
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
    <Box
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 'var(--mantine-spacing-md)',
      }}
    >
      {/* Preview - shown first on mobile */}
      <Box
        p="md"
        style={{
          flex: 1,
          minWidth: 0,
          order: isMobile ? 1 : 2,
        }}
      >
        <Stack gap="md">
          <Title order={4}>{tCommonLabels('preview')}</Title>

          <Box>
            {builtForm ? (
              <Stack gap="lg">
                {title && <Title order={2}>{title}</Title>}
                <FormRenderer
                  key={schema.id}
                  form={builtForm}
                  onSubmit={(values) => {
                    alert(JSON.stringify(values, null, 2));
                  }}
                />
              </Stack>
            ) : (
              <Text c="red">{t('invalidSchema')}</Text>
            )}
          </Box>
        </Stack>
      </Box>

      {/* Builder */}
      <Box
        p="md"
        style={{
          width: isMobile ? '100%' : '33.33%',
          flexShrink: 0,
          order: isMobile ? 2 : 1,
        }}
      >
        <Stack gap="md">
          <Title order={4}>{t('title')}</Title>

          <Group justify="space-between">
            <Text fw={500}>{t('steps')}</Text>
            {canEditStructure ? (
              <Button size="xs" leftSection={<IconPlus size={14} />} onClick={addStep}>
                {t('addStep')}
              </Button>
            ) : null}
          </Group>

          <SortableGroups
            groups={groups}
            onGroupsChange={handleGroupsChange}
            renderGroup={renderGroup}
            renderItem={renderItem}
            getGroupLabel={(group) => group.step.title || tCommonStates('untitledPlain')}
            getItemLabel={(item) => item.field.label || getFieldKey(item.field) || t('field.untitledField')}
          />

          <Textarea
            label={t('schemaJson')}
            value={JSON.stringify(schema, null, 2)}
            autosize
            minRows={12}
            maxRows={30}
            readOnly
            styles={{
              input: {
                fontFamily: 'monospace',
                fontSize: 12,
                lineHeight: 1.45,
                resize: 'vertical',
              },
            }}
          />
        </Stack>
      </Box>
    </Box>
  );
}

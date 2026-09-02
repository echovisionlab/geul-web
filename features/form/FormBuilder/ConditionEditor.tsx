'use client';

import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Group, Stack, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { MultiSelect, Select, TextInput, NumberInput, SegmentedControl, TagsInput } from '@/components/core/Input';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { SectionCard } from '@/components/core/Section';
import { hasOptions, isConditionGroup, isConditionOperator } from '@/lib/types/form/model';
import type {
  FormConditionGroup,
  FormConditionOperator,
  FormConditionSchema,
  FormFieldSchema,
  FormStepCondition,
} from '@/lib/types/form/schema';
import { getLocalizedOperatorOptions } from './i18n';

// =============================================================================
// Types
// =============================================================================

interface AvailableField {
  label: string;
  value: string;
  field: FormFieldSchema;
}

// =============================================================================
// ConditionValueEditor
// =============================================================================

interface ConditionValueEditorProps {
  operator: FormConditionOperator;
  targetField: FormFieldSchema | undefined;
  value: FormConditionSchema['value'];
  onChange: (value: FormConditionSchema['value']) => void;
}

function ConditionValueEditor({ operator, targetField, value, onChange }: ConditionValueEditorProps) {
  const t = useTranslations('formAdmin.builder');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  // 1. exists operator - no value input needed
  if (operator === 'exists') {
    return null;
  }

  // 2. in / notIn operators - multi-select for arrays
  if (operator === 'in' || operator === 'notIn') {
    if (targetField && hasOptions(targetField)) {
      return (
        <MultiSelect
          size="xs"
          data={targetField.options}
          value={Array.isArray(value) ? value.map(String) : []}
          onChange={(v) => onChange(v)}
          placeholder={
            operator === 'in' ? tCommonPlaceholders('selectValues') : t('conditions.excludeValuesPlaceholder')
          }
          style={{ flex: 1 }}
        />
      );
    }
    // Non-select fields: use TagsInput for array input
    return (
      <TagsInput
        size="xs"
        value={Array.isArray(value) ? value.map(String) : []}
        onChange={(v) => onChange(v)}
        placeholder={t('conditions.enterValuesPlaceholder')}
        style={{ flex: 1 }}
      />
    );
  }

  // 3. contains/containsAny/containsAll - for array fields
  if (['contains', 'containsAny', 'containsAll'].includes(operator)) {
    if (targetField && hasOptions(targetField)) {
      // contains: single select, containsAny/containsAll: multi select
      if (operator === 'contains') {
        return (
          <Select
            size="xs"
            data={targetField.options}
            value={typeof value === 'string' ? value : null}
            onChange={(v) => onChange(v ?? '')}
            placeholder={t('conditions.selectValuePlaceholder')}
            style={{ flex: 1 }}
          />
        );
      }
      return (
        <MultiSelect
          size="xs"
          data={targetField.options}
          value={Array.isArray(value) ? value.map(String) : []}
          onChange={(v) => onChange(v)}
          placeholder={tCommonPlaceholders('selectValues')}
          style={{ flex: 1 }}
        />
      );
    }
    // Non-option fields: TagsInput
    return (
      <TagsInput
        size="xs"
        value={Array.isArray(value) ? value.map(String) : []}
        onChange={(v) => onChange(v)}
        placeholder={t('conditions.enterValuesShortPlaceholder')}
        style={{ flex: 1 }}
      />
    );
  }

  // 4. Single value based on field type (eq, neq, gt, gte, lt, lte)
  if (!targetField) {
    return (
      <TextInput
        size="xs"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={tCommonLabels('value')}
        style={{ flex: 1 }}
      />
    );
  }

  switch (targetField.type) {
    case 'select':
      return (
        <Select
          size="xs"
          data={targetField.options}
          value={typeof value === 'string' ? value : null}
          onChange={(v) => onChange(v ?? '')}
          placeholder={t('conditions.selectValuePlaceholder')}
          style={{ flex: 1 }}
        />
      );

    case 'multiselect':
      // For eq/neq with array field, select one option to compare
      return (
        <Select
          size="xs"
          data={targetField.options}
          value={typeof value === 'string' ? value : null}
          onChange={(v) => onChange(v ?? '')}
          placeholder={t('conditions.selectCompareValuePlaceholder')}
          style={{ flex: 1 }}
        />
      );

    case 'switch':
    case 'checkbox':
      return (
        <Select
          size="xs"
          data={[
            { label: t('conditions.trueOption'), value: 'true' },
            { label: t('conditions.falseOption'), value: 'false' },
          ]}
          value={String(value ?? 'true')}
          onChange={(v) => onChange(v === 'true')}
          style={{ flex: 1 }}
        />
      );

    case 'number':
      return (
        <NumberInput
          size="xs"
          value={typeof value === 'number' ? value : undefined}
          onChange={(v) => onChange(typeof v === 'number' ? v : undefined)}
          placeholder={tCommonLabels('value')}
          style={{ flex: 1 }}
        />
      );

    case 'date':
      return (
        <DateInput
          size="xs"
          value={typeof value === 'string' ? value : null}
          onChange={(v) => onChange(v ?? undefined)}
          placeholder={t('conditions.selectDatePlaceholder')}
          valueFormat="YYYY-MM-DD"
          style={{ flex: 1 }}
        />
      );

    default:
      return (
        <TextInput
          size="xs"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder={tCommonLabels('value')}
          style={{ flex: 1 }}
        />
      );
  }
}

// =============================================================================
// SingleConditionEditor
// =============================================================================

interface SingleConditionEditorProps {
  condition: FormConditionSchema;
  availableFields: AvailableField[];
  onChange: (condition: FormConditionSchema) => void;
  onRemove?: () => void;
}

function SingleConditionEditor({ condition, availableFields, onChange, onRemove }: SingleConditionEditorProps) {
  const t = useTranslations('formAdmin.builder');
  const isMobile = useMediaQuery('(max-width: 768px)');
  const targetField = availableFields.find((f) => f.value === condition.fieldId)?.field;
  const fieldType = targetField?.type;
  const operators = getLocalizedOperatorOptions(t, fieldType);

  const handleFieldChange = (fieldId: string | null) => {
    if (!fieldId) {
      return;
    }
    const newField = availableFields.find((f) => f.value === fieldId)?.field;
    const newOperators = getLocalizedOperatorOptions(t, newField?.type);
    // Reset to first operator if current is not valid for new field
    const isCurrentValid = newOperators.some((o) => o.value === condition.operator);
    onChange({
      ...condition,
      fieldId,
      operator: isCurrentValid ? condition.operator : newOperators[0].value,
      value: undefined,
    });
  };

  const handleOperatorChange = (op: string | null) => {
    if (!op || !isConditionOperator(op)) {
      return;
    }
    // Reset value when changing operator
    onChange({
      ...condition,
      operator: op,
      value: undefined,
    });
  };

  return (
    <SectionCard withBorder p="xs">
      <Group gap="xs" wrap={isMobile ? 'wrap' : 'nowrap'}>
        <Select
          size="xs"
          data={availableFields.map((f) => ({ label: f.label, value: f.value }))}
          value={condition.fieldId}
          onChange={handleFieldChange}
          style={{ flex: 1, minWidth: isMobile ? '100%' : 100 }}
          placeholder={t('conditions.selectFieldPlaceholder')}
        />
        <Select
          size="xs"
          data={operators}
          value={condition.operator}
          onChange={handleOperatorChange}
          style={{ width: isMobile ? '100%' : 120 }}
        />
        <ConditionValueEditor
          operator={condition.operator}
          targetField={targetField}
          value={condition.value}
          onChange={(v) => onChange({ ...condition, value: v })}
        />
        {onRemove && (
          <IconButton
            size="sm"
            tone="danger"
            emphasis="low"
            aria-label={t('conditions.removeCondition')}
            onClick={onRemove}
          >
            <IconTrash size={14} />
          </IconButton>
        )}
      </Group>
    </SectionCard>
  );
}

// =============================================================================
// ConditionGroupEditor
// =============================================================================

interface ConditionGroupEditorProps {
  group: FormConditionGroup;
  availableFields: AvailableField[];
  onChange: (group: FormConditionGroup) => void;
  onRemove?: () => void;
  depth?: number;
}

const MAX_DEPTH = 2;

function ConditionGroupEditor({ group, availableFields, onChange, onRemove, depth = 0 }: ConditionGroupEditorProps) {
  const t = useTranslations('formAdmin.builder');
  const tCommonActions = useTranslations('common.actions');
  const addCondition = () => {
    if (availableFields.length === 0) {
      return;
    }
    const newCondition: FormConditionSchema = {
      fieldId: availableFields[0].value,
      operator: 'eq',
      value: '',
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  };

  const addGroup = () => {
    if (depth >= MAX_DEPTH || availableFields.length === 0) {
      return;
    }
    const newGroup: FormConditionGroup = {
      logic: 'and',
      conditions: [
        {
          fieldId: availableFields[0].value,
          operator: 'eq',
          value: '',
        },
      ],
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newGroup],
    });
  };

  const updateCondition = (index: number, updated: FormConditionSchema | FormConditionGroup) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updated;
    onChange({ ...group, conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    onChange({ ...group, conditions: newConditions });
  };

  return (
    <SectionCard withBorder p="xs" bg={depth > 0 ? 'var(--mantine-color-gray-0)' : undefined}>
      <Group justify="space-between" mb="xs">
        <SegmentedControl
          size="xs"
          data={[
            { label: t('conditions.logicAnd'), value: 'and' },
            { label: t('conditions.logicOr'), value: 'or' },
          ]}
          value={group.logic}
          onChange={(logic) => onChange({ ...group, logic: logic === 'or' ? 'or' : 'and' })}
        />
        <Group gap="xs">
          <DropdownMenu size="compact">
            <DropdownMenu.Target>
              <Button size="xs" emphasis="medium" leftSection={<IconPlus size={12} />}>
                {tCommonActions('add')}
              </Button>
            </DropdownMenu.Target>
            <DropdownMenu.Dropdown>
              <DropdownMenu.Item onClick={addCondition}>{t('conditions.condition')}</DropdownMenu.Item>
              {depth < MAX_DEPTH && (
                <DropdownMenu.Item onClick={addGroup}>{t('conditions.nestedGroup')}</DropdownMenu.Item>
              )}
            </DropdownMenu.Dropdown>
          </DropdownMenu>
          {onRemove && (
            <IconButton
              size="sm"
              tone="danger"
              emphasis="low"
              aria-label={t('conditions.removeConditionGroup')}
              onClick={onRemove}
            >
              <IconTrash size={14} />
            </IconButton>
          )}
        </Group>
      </Group>

      <Stack gap="xs">
        {group.conditions.length === 0 ? (
          <Text size="xs" c="dimmed" ta="center" py="xs">
            {t('conditions.noConditions')}
          </Text>
        ) : (
          group.conditions.map((c, i) =>
            isConditionGroup(c) ? (
              <ConditionGroupEditor
                key={i}
                group={c}
                availableFields={availableFields}
                onChange={(updated) => updateCondition(i, updated)}
                onRemove={() => removeCondition(i)}
                depth={depth + 1}
              />
            ) : (
              <SingleConditionEditor
                key={i}
                condition={c}
                availableFields={availableFields}
                onChange={(updated) => updateCondition(i, updated)}
                onRemove={() => removeCondition(i)}
              />
            ),
          )
        )}
      </Stack>
    </SectionCard>
  );
}

// =============================================================================
// StepConditionEditor (Main Export)
// =============================================================================

interface StepConditionEditorProps {
  condition: FormStepCondition | undefined;
  availableFields: AvailableField[];
  onChange: (condition: FormStepCondition | undefined) => void;
}

export function StepConditionEditor({ condition, availableFields, onChange }: StepConditionEditorProps) {
  const t = useTranslations('formAdmin.builder');
  if (availableFields.length === 0) {
    return null;
  }

  const isGroup = condition && isConditionGroup(condition);
  const mode = isGroup ? 'advanced' : 'simple';

  const handleModeChange = (newMode: string) => {
    if (newMode === 'advanced' && condition && !isConditionGroup(condition)) {
      // Convert single condition to group
      onChange({
        logic: 'and',
        conditions: [condition],
      });
    } else if (newMode === 'simple' && condition && isConditionGroup(condition)) {
      // Convert group to single condition (take first)
      const first = condition.conditions[0];
      if (first && !isConditionGroup(first)) {
        onChange(first);
      } else {
        // If first is a group or empty, create new single condition
        onChange({
          fieldId: availableFields[0].value,
          operator: 'eq',
          value: '',
        });
      }
    }
  };

  const handleRemoveCondition = () => {
    onChange(undefined);
  };

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <SegmentedControl
          size="xs"
          data={[
            { label: t('conditions.simple'), value: 'simple' },
            { label: t('conditions.advanced'), value: 'advanced' },
          ]}
          value={mode}
          onChange={handleModeChange}
        />
        <Button size="xs" tone="danger" emphasis="low" onClick={handleRemoveCondition}>
          {t('conditions.removeConditionAction')}
        </Button>
      </Group>

      {condition &&
        (isConditionGroup(condition) ? (
          <ConditionGroupEditor
            group={condition}
            availableFields={availableFields}
            onChange={(updated) => onChange(updated)}
          />
        ) : (
          <SingleConditionEditor
            condition={condition}
            availableFields={availableFields}
            onChange={(updated) => onChange(updated)}
          />
        ))}
    </Stack>
  );
}

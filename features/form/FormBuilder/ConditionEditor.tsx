'use client';

import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
  LayoutGrid as DsLayoutGrid,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import {
  DateInput,
  MultiSelect,
  Select,
  TextInput,
  NumberInput,
  SegmentedControl,
  TagsInput,
} from '@/components/core/Input';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';

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
          aria-label={tCommonLabels('value')}
          grow
          size="xs"
          data={targetField.options}
          value={Array.isArray(value) ? value.map(String) : []}
          onChange={(v) => onChange(v)}
          placeholder={
            operator === 'in' ? tCommonPlaceholders('selectValues') : t('conditions.excludeValuesPlaceholder')
          }
        />
      );
    }
    // Non-select fields: use TagsInput for array input
    return (
      <TagsInput
        aria-label={tCommonLabels('value')}
        grow
        size="xs"
        value={Array.isArray(value) ? value.map(String) : []}
        onChange={(v) => onChange(v)}
        placeholder={t('conditions.enterValuesPlaceholder')}
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
            aria-label={tCommonLabels('value')}
            grow
            size="xs"
            data={targetField.options}
            value={typeof value === 'string' ? value : null}
            onChange={(v) => onChange(v ?? '')}
            placeholder={t('conditions.selectValuePlaceholder')}
          />
        );
      }
      return (
        <MultiSelect
          aria-label={tCommonLabels('value')}
          grow
          size="xs"
          data={targetField.options}
          value={Array.isArray(value) ? value.map(String) : []}
          onChange={(v) => onChange(v)}
          placeholder={tCommonPlaceholders('selectValues')}
        />
      );
    }
    // Non-option fields: TagsInput
    return (
      <TagsInput
        aria-label={tCommonLabels('value')}
        grow
        size="xs"
        value={Array.isArray(value) ? value.map(String) : []}
        onChange={(v) => onChange(v)}
        placeholder={t('conditions.enterValuesShortPlaceholder')}
      />
    );
  }

  // 4. Single value based on field type (eq, neq, gt, gte, lt, lte)
  if (!targetField) {
    return (
      <TextInput
        aria-label={tCommonLabels('value')}
        grow
        size="xs"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={tCommonLabels('value')}
      />
    );
  }

  switch (targetField.type) {
    case 'select':
      return (
        <Select
          aria-label={tCommonLabels('value')}
          grow
          size="xs"
          data={targetField.options}
          value={typeof value === 'string' ? value : null}
          onChange={(v) => onChange(v ?? '')}
          placeholder={t('conditions.selectValuePlaceholder')}
        />
      );

    case 'multiselect':
      // For eq/neq with array field, select one option to compare
      return (
        <Select
          aria-label={tCommonLabels('value')}
          grow
          size="xs"
          data={targetField.options}
          value={typeof value === 'string' ? value : null}
          onChange={(v) => onChange(v ?? '')}
          placeholder={t('conditions.selectCompareValuePlaceholder')}
        />
      );

    case 'switch':
    case 'checkbox':
      return (
        <Select
          aria-label={tCommonLabels('value')}
          grow
          size="xs"
          data={[
            { label: t('conditions.trueOption'), value: 'true' },
            { label: t('conditions.falseOption'), value: 'false' },
          ]}
          value={String(value ?? 'true')}
          onChange={(v) => onChange(v === 'true')}
        />
      );

    case 'number':
      return (
        <NumberInput
          aria-label={tCommonLabels('value')}
          grow
          size="xs"
          value={typeof value === 'number' ? value : undefined}
          onChange={(v) => onChange(typeof v === 'number' ? v : undefined)}
          placeholder={tCommonLabels('value')}
        />
      );

    case 'date':
      return (
        <DateInput
          aria-label={tCommonLabels('value')}
          size="xs"
          value={typeof value === 'string' ? value : null}
          onChange={(v) => onChange(v ?? undefined)}
          placeholder={t('conditions.selectDatePlaceholder')}
        />
      );

    default:
      return (
        <TextInput
          aria-label={tCommonLabels('value')}
          grow
          size="xs"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder={tCommonLabels('value')}
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
  const tCommonLabels = useTranslations('common.labels');
  const tFilter = useTranslations('dataTable.filter');
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
    <SectionCard withBorder padding="xs">
      <DsLayoutGrid role="group" aria-label={t('conditions.condition')} columns={{ base: 1, sm: 2 }} gap="xxs">
        <div>
          <Select
            grow
            size="xs"
            aria-label={tCommonLabels('fields')}
            data={availableFields.map((f) => ({ label: f.label, value: f.value }))}
            value={condition.fieldId}
            onChange={handleFieldChange}
            placeholder={t('conditions.selectFieldPlaceholder')}
          />
        </div>
        <div>
          <Select
            aria-label={tFilter('operator')}
            grow
            size="xs"
            data={operators}
            value={condition.operator}
            onChange={handleOperatorChange}
          />
        </div>
        <ConditionValueEditor
          operator={condition.operator}
          targetField={targetField}
          value={condition.value}
          onChange={(v) => onChange({ ...condition, value: v })}
        />
        {onRemove && (
          <IconButton
            size="xs"
            tone="danger"
            emphasis="low"
            aria-label={t('conditions.removeCondition')}
            onClick={onRemove}
          >
            <IconTrash size={14} />
          </IconButton>
        )}
      </DsLayoutGrid>
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
    <SectionCard nested={depth > 0} appearance={depth > 0 ? 'muted' : 'surface'} withBorder padding="xs">
      <DsLayoutInset blockEnd="xs">
        <DsLayoutInline justify="between">
          <SegmentedControl
            aria-label={t('conditions.nestedGroup')}
            size="xs"
            data={[
              { label: t('conditions.logicAnd'), value: 'and' },
              { label: t('conditions.logicOr'), value: 'or' },
            ]}
            value={group.logic}
            onChange={(logic) => onChange({ ...group, logic: logic === 'or' ? 'or' : 'and' })}
          />
          <DsLayoutInline gap="xs">
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
                size="xs"
                tone="danger"
                emphasis="low"
                aria-label={t('conditions.removeConditionGroup')}
                onClick={onRemove}
              >
                <IconTrash size={14} />
              </IconButton>
            )}
          </DsLayoutInline>
        </DsLayoutInline>
      </DsLayoutInset>

      <DsLayoutStack gap="xs">
        {group.conditions.length === 0 ? (
          <DsLayoutInset block="xs">
            <DsText size="xs" tone="secondary" align="center">
              {t('conditions.noConditions')}
            </DsText>
          </DsLayoutInset>
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
      </DsLayoutStack>
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
    <DsLayoutStack gap="xs">
      <DsLayoutInline justify="between">
        <SegmentedControl
          aria-label={t('conditions.condition')}
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
      </DsLayoutInline>

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
    </DsLayoutStack>
  );
}

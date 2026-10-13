'use client';

import { interactionBindings } from '@/components/core/bindings';
import { Text as DsText } from '@/components/core/Typography';
import {
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset,
  LayoutGrid as DsLayoutGrid,
  LayoutGridItem as DsLayoutGridItem,
} from '@/components/core/Layout';

import { useMemo, useState } from 'react';
import { IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Disclosure } from '@/components/core/Disclosure';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Select, TextInput, Checkbox } from '@/components/core/Input';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { SectionCard } from '@/components/core/Section';
import type { DragHandleProps } from '@/components/core/Sortable';
import { isBoolean, isString, isStringArray } from '@/lib/types/form/guards';
import { createFieldWithType, hasOptions, isFieldType, updateFieldOptions } from '@/lib/types/form/model';
import type { FieldValidator, FormFieldOption, FormFieldSchema } from '@/lib/types/form/schema';
import { COMMON_TIMEZONES } from '@/lib/utils/timezone';
import { getFieldLabel } from '../FormField/utils';
import { StepConditionEditor } from './ConditionEditor';
import { getLocalizedFieldTypeLabel, getLocalizedFieldTypeOptions, getLocalizedPredicateLabel } from './i18n';
import { createValidator, getAvailablePredicates } from './validators/helpers';
import { ValidatorsList } from './validators/ValidatorsList';

// =============================================================================
// Types
// =============================================================================

interface AvailableField {
  label: string;
  value: string;
  field: FormFieldSchema;
}

// =============================================================================
// Helper Components (replacing inline IIFEs)
// =============================================================================

interface SelectDefaultValueProps {
  options: { label: string; value: string }[];
  defaultValue: unknown;
  onChange: (value: string | undefined) => void;
}

function SelectDefaultValue({ options, defaultValue, onChange }: SelectDefaultValueProps) {
  const t = useTranslations('formAdmin.builder');
  const uniqueOptions = useMemo(() => {
    const seen = new Set<string>();
    return options.filter((opt) => {
      if (opt.value === '' || seen.has(opt.value)) {
        return false;
      }
      seen.add(opt.value);
      return true;
    });
  }, [options]);

  return (
    <LayoutInset space="none" blockStart="xs">
      <Select
        label={t('field.defaultValue')}
        size="xs"
        clearable
        data={uniqueOptions}
        value={isString(defaultValue) ? defaultValue : null}
        onChange={(value) => onChange(value || undefined)}
      />
    </LayoutInset>
  );
}

interface MultiselectDefaultValueProps {
  options: { label: string; value: string }[];
  defaultValue: unknown;
  onChange: (value: string[] | undefined) => void;
}

function MultiselectDefaultValue({ options, defaultValue, onChange }: MultiselectDefaultValueProps) {
  const t = useTranslations('formAdmin.builder');
  const uniqueOptions = useMemo(() => {
    const seen = new Set<string>();
    return options.filter((opt) => {
      if (opt.value === '' || seen.has(opt.value)) {
        return false;
      }
      seen.add(opt.value);
      return true;
    });
  }, [options]);

  return (
    <DsLayoutInset blockStart="xs">
      <DsLayoutInset space="none">
        <DsLayoutInset blockEnd="xxs">
          <DsText size="xs" weight="medium">
            {t('field.defaultSelected')}
          </DsText>
        </DsLayoutInset>
        <Checkbox.Group
          aria-label={t('field.defaultSelected')}
          value={isStringArray(defaultValue) ? defaultValue : []}
          onChange={(value) => onChange(value.length > 0 ? value : undefined)}
        >
          <DsLayoutStack gap="xxs">
            {uniqueOptions.map((opt, index) => (
              <Checkbox key={`${opt.value}-${index}`} value={opt.value} label={opt.label || opt.value} size="xs" />
            ))}
          </DsLayoutStack>
        </Checkbox.Group>
      </DsLayoutInset>
    </DsLayoutInset>
  );
}

// =============================================================================
// Field Editor
// =============================================================================

interface FieldEditorProps {
  containerId?: string;
  field: FormFieldSchema;
  dragHandleProps: DragHandleProps;
  onChange: (field: FormFieldSchema) => void;
  onRemove: () => void;
  fieldKeyError?: string;
  availableFields?: AvailableField[];
  mode?: 'full' | 'translation' | 'readOnly';
}

export function FieldEditor({
  containerId,
  field,
  dragHandleProps,
  onChange,
  onRemove,
  fieldKeyError,
  availableFields = [],
  mode = 'full',
}: FieldEditorProps) {
  const t = useTranslations('formAdmin.builder');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const [isOpen, setIsOpen] = useState(false);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const fieldType = field.type;
  const canEditLocalizedText = mode !== 'readOnly';
  const canEditStructure = mode === 'full';
  const fieldHasOptions = hasOptions(field);
  const hasPlaceholder = ['text', 'email', 'textarea', 'number'].includes(fieldType);

  const validators = field.validation?.validators ?? [];
  const hasValidators = validators.length > 0;
  const hasRequired = validators.some((v) => v.predicate === 'required');

  const fieldKey = field.key ?? field.name ?? '';
  const keyError = fieldKeyError;

  const handleRequiredChange = (checked: boolean) => {
    if (checked && !hasRequired) {
      // Add required at the beginning
      const requiredValidator: FieldValidator = {
        id: crypto.randomUUID(),
        name: 'Required',
        predicate: 'required',
      };
      onChange({
        ...field,
        validation: { validators: [requiredValidator, ...validators] },
      });
    } else if (!checked && hasRequired) {
      // Remove required
      const filtered = validators.filter((v) => v.predicate !== 'required');
      onChange({
        ...field,
        validation: filtered.length > 0 ? { validators: filtered } : undefined,
      });
    }
  };

  const getFieldOptions = (): FormFieldOption[] => {
    if (hasOptions(field)) {
      return field.options;
    }
    return [];
  };

  const handleUpdateOptions = (options: FormFieldOption[]) => {
    onChange(updateFieldOptions(field, options));
  };

  return (
    <LayoutInset id={containerId} space="none" blockEnd="xxs">
      <SectionCard appearance="plain" padding="none">
        <Disclosure
          nested
          label={
            <DsLayoutInline gap="xxs">
              <DsText size="xs" weight="medium">
                {getFieldLabel(field) || t('field.untitledField')}
              </DsText>
              <DsText size="xs" tone="secondary">
                ({getLocalizedFieldTypeLabel(t, fieldType, tCommonLabels)})
              </DsText>
            </DsLayoutInline>
          }
          opened={isOpen}
          onChange={setIsOpen}
          density="compact"
          chevronPosition="end"
          withDivider={false}
          contentIndent="label"
          leadingActions={
            canEditStructure ? (
              <IconButton
                emphasis="low"
                interaction="drag-handle"
                draggable={false}
                aria-label={t('field.dragField', {
                  name: getFieldLabel(field) || t('field.untitledField'),
                })}
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
                aria-label={t('field.removeField', {
                  name: getFieldLabel(field) || t('field.untitledField'),
                })}
                onClick={onRemove}
              >
                <IconTrash size={16} aria-hidden />
              </IconButton>
            ) : undefined
          }
        >
          <DsLayoutInset space="none">
            <DsLayoutStack gap="xxs">
              <DsLayoutGrid columns={{ base: 1, sm: 2, md: 4 }} gap="xxs" align="end">
                <DsLayoutGridItem>
                  <TextInput
                    grow
                    label={tCommonLabels('label')}
                    size="xs"
                    value={field.label ?? ''}
                    onChange={(e) => onChange({ ...field, label: e.currentTarget.value || undefined })}
                    readOnly={!canEditLocalizedText}
                  />
                </DsLayoutGridItem>
                <DsLayoutGridItem>
                  <TextInput
                    grow
                    label={tCommonLabels('key')}
                    size="xs"
                    value={fieldKey}
                    onChange={(e) => onChange({ ...field, key: e.currentTarget.value })}
                    error={keyError}
                    readOnly={!canEditStructure}
                  />
                </DsLayoutGridItem>
                <DsLayoutGridItem>
                  <Select
                    label={tCommonLabels('type')}
                    size="xs"
                    data={getLocalizedFieldTypeOptions(t, tCommonLabels)}
                    value={fieldType}
                    onChange={(value) => {
                      if (!canEditStructure) {
                        return;
                      }
                      if (!value || !isFieldType(value)) {
                        return;
                      }
                      onChange(createFieldWithType(field, value));
                    }}
                    disabled={!canEditStructure}
                  />
                </DsLayoutGridItem>
                <DsLayoutGridItem>
                  <Checkbox
                    label={tCommonLabels('required')}
                    size="xs"
                    checked={hasRequired}
                    onChange={(e) => handleRequiredChange(e.currentTarget.checked)}
                    disabled={!canEditStructure}
                  />
                </DsLayoutGridItem>
              </DsLayoutGrid>
              {fieldHasOptions && (
                <div>
                  <DsLayoutInset blockEnd="xxs">
                    <DsText size="xs" weight="medium">
                      {t('field.options')}
                    </DsText>
                  </DsLayoutInset>
                  {getFieldOptions().map((option, optIndex) => (
                    <DsLayoutInset key={option.id} blockEnd="xxs">
                      <DsLayoutInline gap="xs" wrap="nowrap" align="end">
                        <DsLayoutInset space="none" flexible>
                          <DsLayoutGrid columns={{ base: 1, sm: 2 }} gap="xxs">
                            <TextInput
                              label={tCommonLabels('label')}
                              size="xs"
                              value={option.label}
                              onChange={(e) => {
                                const options = [...getFieldOptions()];
                                options[optIndex] = { ...options[optIndex], label: e.currentTarget.value };
                                handleUpdateOptions(options);
                              }}
                              readOnly={!canEditLocalizedText}
                            />
                            <TextInput
                              label={tCommonLabels('value')}
                              size="xs"
                              value={option.value}
                              onChange={(e) => {
                                const options = [...getFieldOptions()];
                                options[optIndex] = { ...options[optIndex], value: e.currentTarget.value };
                                handleUpdateOptions(options);
                              }}
                              readOnly={!canEditStructure}
                            />
                          </DsLayoutGrid>
                        </DsLayoutInset>
                        {canEditStructure ? (
                          <IconButton
                            size="compact"
                            tone="danger"
                            aria-label={t('field.removeOption', { index: optIndex + 1 })}
                            onClick={() => handleUpdateOptions(getFieldOptions().filter((_, i) => i !== optIndex))}
                          >
                            <IconTrash size={16} aria-hidden />
                          </IconButton>
                        ) : null}
                      </DsLayoutInline>
                    </DsLayoutInset>
                  ))}
                  {canEditStructure ? (
                    <Button
                      size="xs"
                      emphasis="medium"
                      leftSection={<IconPlus size={12} />}
                      onClick={() => {
                        const options = [...getFieldOptions(), { id: crypto.randomUUID(), label: '', value: '' }];
                        handleUpdateOptions(options);
                      }}
                    >
                      {t('field.addOption')}
                    </Button>
                  ) : null}

                  {canEditStructure && fieldType === 'select' && (
                    <SelectDefaultValue
                      options={getFieldOptions()}
                      defaultValue={field.defaultValue}
                      onChange={(value) => onChange({ ...field, defaultValue: value })}
                    />
                  )}

                  {canEditStructure && fieldType === 'multiselect' && (
                    <MultiselectDefaultValue
                      options={getFieldOptions()}
                      defaultValue={field.defaultValue}
                      onChange={(value) => onChange({ ...field, defaultValue: value })}
                    />
                  )}
                </div>
              )}

              {/* Conditional Visibility */}
              {mode === 'full' && availableFields.length > 0 && (
                <div>
                  <Checkbox
                    label={t('field.conditional')}
                    description={t('field.conditionalDescription')}
                    size="xs"
                    checked={!!field.condition}
                    onChange={(e) => {
                      if (e.currentTarget.checked) {
                        // Add default condition
                        const firstField = availableFields[0];
                        onChange({
                          ...field,
                          condition: {
                            fieldId: firstField.value,
                            operator: 'exists',
                          },
                        });
                      } else {
                        // Remove condition
                        const { condition: _, ...rest } = field;
                        onChange(rest);
                      }
                    }}
                  />
                  {field.condition && (
                    <DsLayoutInset blockStart="xs">
                      <DsLayoutInset space="none">
                        <StepConditionEditor
                          condition={field.condition}
                          availableFields={availableFields}
                          onChange={(condition) => {
                            if (condition) {
                              onChange({ ...field, condition });
                            } else {
                              const { condition: _, ...rest } = field;
                              onChange(rest);
                            }
                          }}
                        />
                      </DsLayoutInset>
                    </DsLayoutInset>
                  )}
                </div>
              )}

              <Disclosure
                nested
                label={tCommonLabels('settings')}
                density="compact"
                chevronPosition="end"
                withDivider={false}
                contentIndent="label"
              >
                <DsLayoutStack gap="xxs">
                  <TextInput
                    grow
                    label={tCommonLabels('description')}
                    size="xs"
                    value={field.description ?? ''}
                    onChange={(e) => onChange({ ...field, description: e.currentTarget.value || undefined })}
                    readOnly={!canEditLocalizedText}
                  />
                  {hasPlaceholder && (
                    <TextInput
                      grow
                      label={t('field.placeholder')}
                      size="xs"
                      value={field.placeholder ?? ''}
                      onChange={(e) => onChange({ ...field, placeholder: e.currentTarget.value || undefined })}
                      readOnly={!canEditLocalizedText}
                    />
                  )}
                  {/* Date Field Settings */}
                  {fieldType === 'date' && (
                    <>
                      <TextInput
                        grow
                        label={t('field.minDate')}
                        size="xs"
                        type="date"
                        value={'minDate' in field ? (field.minDate ?? '') : ''}
                        onChange={(e) => onChange({ ...field, minDate: e.currentTarget.value || undefined })}
                        readOnly={!canEditStructure}
                      />
                      <TextInput
                        grow
                        label={t('field.maxDate')}
                        size="xs"
                        type="date"
                        value={'maxDate' in field ? (field.maxDate ?? '') : ''}
                        onChange={(e) => onChange({ ...field, maxDate: e.currentTarget.value || undefined })}
                        readOnly={!canEditStructure}
                      />
                      <Select
                        label={t('field.timezone')}
                        size="xs"
                        placeholder={t('field.browserDefault')}
                        data={COMMON_TIMEZONES.map((tz) => ({ value: tz.value, label: tz.label }))}
                        value={'timezone' in field ? (field.timezone ?? null) : null}
                        onChange={(val) => onChange({ ...field, timezone: val || undefined })}
                        searchable
                        clearable
                        disabled={!canEditStructure}
                      />
                    </>
                  )}
                  {hasPlaceholder && (
                    <TextInput
                      grow
                      label={t('field.defaultValue')}
                      size="xs"
                      value={isString(field.defaultValue) ? field.defaultValue : String(field.defaultValue ?? '')}
                      onChange={(e) => {
                        if (!canEditStructure) {
                          return;
                        }
                        const val = e.currentTarget.value;
                        if (fieldType === 'number') {
                          const num = parseFloat(val);
                          onChange({ ...field, defaultValue: isNaN(num) ? undefined : num });
                        } else {
                          onChange({ ...field, defaultValue: val || undefined });
                        }
                      }}
                      readOnly={!canEditStructure}
                    />
                  )}

                  {(fieldType === 'switch' || fieldType === 'checkbox') && (
                    <Checkbox
                      label={t('field.defaultChecked')}
                      size="xs"
                      checked={isBoolean(field.defaultValue) ? field.defaultValue : false}
                      onChange={(e) => onChange({ ...field, defaultValue: e.currentTarget.checked || undefined })}
                      disabled={!canEditStructure}
                    />
                  )}

                  {fieldType === 'checkbox' && (
                    <TextInput
                      grow
                      label={t('field.checkboxLabel')}
                      description={t('field.checkboxLabelDescription')}
                      size="xs"
                      value={'checkboxLabel' in field ? (field.checkboxLabel ?? '') : ''}
                      onChange={(e) => onChange({ ...field, checkboxLabel: e.currentTarget.value || undefined })}
                      readOnly={!canEditLocalizedText}
                    />
                  )}
                </DsLayoutStack>
              </Disclosure>
              <Disclosure
                nested
                label={
                  <DsLayoutInline gap="xxs">
                    <DsText size="xs" weight="medium">
                      {t('field.validators')}
                    </DsText>
                    {hasValidators ? (
                      <DsText size="xs" tone="secondary">
                        ({validators.length})
                      </DsText>
                    ) : null}
                  </DsLayoutInline>
                }
                chevronPosition="end"
                density="compact"
                withDivider={false}
                contentIndent="label"
                opened={isValidationOpen}
                onChange={setIsValidationOpen}
                actions={
                  isValidationOpen && canEditStructure ? (
                    <DropdownMenu>
                      <DropdownMenu.Target>
                        <IconButton size="compact" emphasis="medium" label={tCommonActions('add')}>
                          <IconPlus aria-hidden />
                        </IconButton>
                      </DropdownMenu.Target>
                      <DropdownMenu.Dropdown>
                        {getAvailablePredicates(fieldType, validators).map((def) => (
                          <DropdownMenu.Item
                            key={def.name}
                            onClick={() => {
                              onChange({
                                ...field,
                                validation: { validators: [...validators, createValidator(def.name)] },
                              });
                            }}
                          >
                            {getLocalizedPredicateLabel(t, def.name, tCommonLabels)}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Dropdown>
                    </DropdownMenu>
                  ) : undefined
                }
              >
                <ValidatorsList
                  validators={validators}
                  fieldType={fieldType}
                  mode={mode}
                  onChange={(updatedValidators) => {
                    onChange({
                      ...field,
                      validation: updatedValidators.length > 0 ? { validators: updatedValidators } : undefined,
                    });
                  }}
                />
              </Disclosure>
            </DsLayoutStack>
          </DsLayoutInset>
        </Disclosure>
      </SectionCard>
    </LayoutInset>
  );
}

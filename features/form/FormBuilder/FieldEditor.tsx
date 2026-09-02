'use client';

import { useMemo, useState } from 'react';
import { IconChevronDown, IconChevronRight, IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Collapse, Group, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Select, TextInput, Checkbox } from '@/components/core/Input';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { SectionCard } from '@/components/core/Section';
import { TextButton } from '@/components/core/TextButton';
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
    <Select
      label={t('field.defaultValue')}
      size="xs"
      mt="xs"
      clearable
      data={uniqueOptions}
      value={isString(defaultValue) ? defaultValue : null}
      onChange={(value) => onChange(value || undefined)}
    />
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
    <Box mt="xs">
      <Text size="xs" fw={500} mb={4}>
        {t('field.defaultSelected')}
      </Text>
      <Checkbox.Group
        value={isStringArray(defaultValue) ? defaultValue : []}
        onChange={(value) => onChange(value.length > 0 ? value : undefined)}
      >
        <Stack gap={4}>
          {uniqueOptions.map((opt, index) => (
            <Checkbox key={`${opt.value}-${index}`} value={opt.value} label={opt.label || opt.value} size="xs" />
          ))}
        </Stack>
      </Checkbox.Group>
    </Box>
  );
}

// =============================================================================
// Field Editor
// =============================================================================

interface FieldEditorProps {
  field: FormFieldSchema;
  dragHandleProps: DragHandleProps;
  onChange: (field: FormFieldSchema) => void;
  onRemove: () => void;
  fieldKeyError?: string;
  availableFields?: AvailableField[];
  mode?: 'full' | 'translation' | 'readOnly';
}

export function FieldEditor({
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
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isOpen, setIsOpen] = useState(false);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const detailsPanelId = `field-details-${field.id}`;
  const validatorsPanelId = `field-validators-${field.id}`;
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
    <SectionCard withBorder p="xs" mb="xs">
      <Group justify="space-between">
        <Group gap="xs" style={{ flex: 1 }}>
          <IconButton
            size={isMobile ? 'md' : 'xs'}
            emphasis="low"
            style={{ cursor: 'grab', touchAction: 'none' }}
            aria-label={t('field.dragField', {
              name: getFieldLabel(field) || t('field.untitledField'),
            })}
            {...(canEditStructure ? dragHandleProps.attributes : {})}
            {...(canEditStructure ? dragHandleProps.listeners : {})}
            disabled={!canEditStructure}
          >
            <IconGripVertical size={isMobile ? 20 : 12} />
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
              {isOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              <Text size="xs" fw={500}>
                {getFieldLabel(field) || t('field.untitledField')}
              </Text>
              <Text size="xs" c="dimmed">
                ({getLocalizedFieldTypeLabel(t, fieldType, tCommonLabels)})
              </Text>
            </Group>
          </TextButton>
        </Group>
        {canEditStructure ? (
          <IconButton
            size="xs"
            tone="danger"
            emphasis="low"
            aria-label={t('field.removeField', {
              name: getFieldLabel(field) || t('field.untitledField'),
            })}
            onClick={onRemove}
          >
            <IconTrash size={12} />
          </IconButton>
        ) : null}
      </Group>

      <Collapse id={detailsPanelId} expanded={isOpen}>
        <Stack gap="xs" mt="xs">
          <TextInput
            label={tCommonLabels('label')}
            size="xs"
            value={field.label ?? ''}
            onChange={(e) => onChange({ ...field, label: e.currentTarget.value || undefined })}
            readOnly={!canEditLocalizedText}
          />
          <TextInput
            label={tCommonLabels('key')}
            size="xs"
            value={fieldKey}
            onChange={(e) => onChange({ ...field, key: e.currentTarget.value })}
            error={keyError}
            readOnly={!canEditStructure}
          />
          <TextInput
            label={tCommonLabels('description')}
            size="xs"
            value={field.description ?? ''}
            onChange={(e) => onChange({ ...field, description: e.currentTarget.value || undefined })}
            readOnly={!canEditLocalizedText}
          />
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
          {hasPlaceholder && (
            <TextInput
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
                label={t('field.minDate')}
                size="xs"
                type="date"
                value={'minDate' in field ? (field.minDate ?? '') : ''}
                onChange={(e) => onChange({ ...field, minDate: e.currentTarget.value || undefined })}
                readOnly={!canEditStructure}
              />
              <TextInput
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
          {/* Required Checkbox */}
          <Checkbox
            label={tCommonLabels('required')}
            size="xs"
            checked={hasRequired}
            onChange={(e) => handleRequiredChange(e.currentTarget.checked)}
            disabled={!canEditStructure}
          />

          {/* Conditional Visibility */}
          {mode === 'full' && availableFields.length > 0 && (
            <Box>
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
                <Box mt="xs">
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
                </Box>
              )}
            </Box>
          )}

          {/* Validators Section */}
          <Box>
            <Group justify="space-between" mb="xs">
              <TextButton
                appearance="default"
                size="xs"
                aria-expanded={isValidationOpen}
                aria-controls={validatorsPanelId}
                onClick={() => setIsValidationOpen((open) => !open)}
              >
                <Group gap="xs">
                  {isValidationOpen ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                  <Text size="xs" fw={500}>
                    {t('field.validators')}
                  </Text>
                  {hasValidators && (
                    <Text size="xs" c="blue">
                      ({validators.length})
                    </Text>
                  )}
                </Group>
              </TextButton>
              {isValidationOpen && canEditStructure ? (
                <DropdownMenu>
                  <DropdownMenu.Target>
                    <Button size="xs" emphasis="medium" leftSection={<IconPlus size={12} />}>
                      {tCommonActions('add')}
                    </Button>
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
              ) : null}
            </Group>
            <Collapse id={validatorsPanelId} expanded={isValidationOpen}>
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
            </Collapse>
          </Box>

          {hasPlaceholder && (
            <TextInput
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
              label={t('field.checkboxLabel')}
              description={t('field.checkboxLabelDescription')}
              size="xs"
              value={'checkboxLabel' in field ? (field.checkboxLabel ?? '') : ''}
              onChange={(e) => onChange({ ...field, checkboxLabel: e.currentTarget.value || undefined })}
              readOnly={!canEditLocalizedText}
            />
          )}

          {fieldHasOptions && (
            <Box>
              <Text size="xs" fw={500} mb={4}>
                {t('field.options')}
              </Text>
              {getFieldOptions().map((option, optIndex) =>
                isMobile ? (
                  <Stack key={optIndex} gap="xs" mb="xs">
                    <Group gap="xs" wrap="nowrap">
                      <TextInput
                        size="xs"
                        placeholder={tCommonLabels('label')}
                        value={option.label}
                        onChange={(e) => {
                          const options = [...getFieldOptions()];
                          options[optIndex] = {
                            ...options[optIndex],
                            label: e.currentTarget.value,
                          };
                          handleUpdateOptions(options);
                        }}
                        style={{ flex: 1 }}
                        readOnly={!canEditLocalizedText}
                      />
                      {canEditStructure ? (
                        <IconButton
                          size="sm"
                          tone="danger"
                          emphasis="low"
                          aria-label={t('field.removeOption', { index: optIndex + 1 })}
                          onClick={() => {
                            const options = getFieldOptions().filter((_, i) => i !== optIndex);
                            handleUpdateOptions(options);
                          }}
                        >
                          <IconTrash size={12} />
                        </IconButton>
                      ) : null}
                    </Group>
                    <TextInput
                      size="xs"
                      placeholder={tCommonLabels('value')}
                      value={option.value}
                      onChange={(e) => {
                        const options = [...getFieldOptions()];
                        options[optIndex] = { ...options[optIndex], value: e.currentTarget.value };
                        handleUpdateOptions(options);
                      }}
                      readOnly={!canEditStructure}
                    />
                  </Stack>
                ) : (
                  <Group key={optIndex} gap="xs" mb={4}>
                    <TextInput
                      size="xs"
                      placeholder={tCommonLabels('label')}
                      value={option.label}
                      onChange={(e) => {
                        const options = [...getFieldOptions()];
                        options[optIndex] = { ...options[optIndex], label: e.currentTarget.value };
                        handleUpdateOptions(options);
                      }}
                      style={{ flex: 1 }}
                      readOnly={!canEditLocalizedText}
                    />
                    <TextInput
                      size="xs"
                      placeholder={tCommonLabels('value')}
                      value={option.value}
                      onChange={(e) => {
                        const options = [...getFieldOptions()];
                        options[optIndex] = { ...options[optIndex], value: e.currentTarget.value };
                        handleUpdateOptions(options);
                      }}
                      style={{ flex: 1 }}
                      readOnly={!canEditStructure}
                    />
                    {canEditStructure ? (
                      <IconButton
                        size="sm"
                        tone="danger"
                        emphasis="low"
                        aria-label={t('field.removeOption', { index: optIndex + 1 })}
                        onClick={() => {
                          const options = getFieldOptions().filter((_, i) => i !== optIndex);
                          handleUpdateOptions(options);
                        }}
                      >
                        <IconTrash size={12} />
                      </IconButton>
                    ) : null}
                  </Group>
                ),
              )}
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
            </Box>
          )}
        </Stack>
      </Collapse>
    </SectionCard>
  );
}

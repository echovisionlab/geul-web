/**
 * FormSchema를 런타임 Form으로 변환
 */

import { z } from 'zod';
import { defaultFormValidationMessages, type FormValidationMessages } from '@/lib/form/validation-messages';
import { buildFieldValidator } from '@/lib/form/validation-zod';
import type { FormValues } from '@/lib/types/form/guards';
import { isConditionGroup, type BuiltForm } from '@/lib/types/form/model';
import type {
  FormConditionGroup,
  FormConditionSchema,
  FormSchema,
  FormStepCondition,
  FormStepSchema,
} from '@/lib/types/form/schema';

type NormalizedFieldSchema = NonNullable<FormStepSchema['fields']>[number];

interface LegacyFormFieldOption {
  label: string;
  value: string;
}

interface LegacyFormFieldSchemaBase {
  id?: string;
  name: string;
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: unknown;
  condition?: FormStepCondition;
  required?: boolean;
}

type LegacyFormFieldSchema =
  | (LegacyFormFieldSchemaBase & { type: 'text' | 'email' | 'textarea' })
  | (LegacyFormFieldSchemaBase & {
      type: 'tel';
      defaultCountry?: string;
      showValidationIcon?: boolean;
    })
  | (LegacyFormFieldSchemaBase & {
      type: 'number';
      numberType?: 'integer' | 'float';
      decimalPlaces?: number;
    })
  | (LegacyFormFieldSchemaBase & {
      type: 'select' | 'multiselect';
      options?: LegacyFormFieldOption[];
    })
  | (LegacyFormFieldSchemaBase & {
      type: 'checkbox';
      checkboxLabel?: string;
    })
  | (LegacyFormFieldSchemaBase & { type: 'switch' })
  | (LegacyFormFieldSchemaBase & {
      type: 'date';
      minDate?: string;
      maxDate?: string;
      timezone?: string;
    });

interface LegacyFormSchema {
  id?: string;
  title?: string;
  fields?: LegacyFormFieldSchema[];
}

function isLegacyFormSchema(schema: unknown): schema is LegacyFormSchema {
  return !!schema && typeof schema === 'object' && Array.isArray((schema as { fields?: unknown }).fields);
}

function normalizeLegacyValidation(field: LegacyFormFieldSchema, index: number) {
  if (!field.required) {
    return undefined;
  }

  return {
    validators: [
      {
        id: `${field.id ?? `legacy-field-${index}`}-required`,
        name: 'Required',
        predicate: 'required',
      },
    ],
  };
}

function normalizeLegacyField(field: LegacyFormFieldSchema, index: number): NormalizedFieldSchema {
  const fieldId = field.id ?? `legacy-field-${index}`;
  const base = {
    id: fieldId,
    key: field.name,
    name: field.name,
    label: field.label ?? field.name,
    description: field.description,
    placeholder: field.placeholder,
    defaultValue: field.defaultValue,
    validation: normalizeLegacyValidation(field, index),
    condition: normalizeLegacyCondition(field.condition),
  };

  switch (field.type) {
    case 'text':
    case 'email':
    case 'textarea':
      return { ...base, type: field.type };
    case 'tel':
      return {
        ...base,
        type: field.type,
        defaultCountry: field.defaultCountry,
        showValidationIcon: field.showValidationIcon,
      };
    case 'number':
      return {
        ...base,
        type: field.type,
        numberType: field.numberType,
        decimalPlaces: field.decimalPlaces,
      };
    case 'select':
    case 'multiselect':
      return {
        ...base,
        type: field.type,
        options: (field.options ?? []).map((option, optionIndex) => ({
          id: `${fieldId}-option-${optionIndex}`,
          label: option.label,
          value: option.value,
        })),
      };
    case 'checkbox':
      return {
        ...base,
        type: field.type,
        checkboxLabel: field.checkboxLabel,
      };
    case 'switch':
      return { ...base, type: field.type };
    case 'date':
      return {
        ...base,
        type: field.type,
        minDate: field.minDate,
        maxDate: field.maxDate,
        timezone: field.timezone,
      };
    default:
      return { ...base, type: 'text' };
  }
}

function normalizeLegacyCondition(condition: FormStepCondition | undefined): FormStepCondition | undefined {
  if (!condition) {
    return undefined;
  }

  if (isConditionGroup(condition)) {
    return {
      logic: condition.logic,
      conditions: condition.conditions
        .map((item) => normalizeLegacyCondition(item))
        .filter((item): item is FormStepCondition => item !== undefined),
    };
  }

  return {
    fieldId: resolveConditionFieldID(condition),
    operator: condition.operator,
    value: condition.value,
  };
}

function resolveFieldKey(field: { id: string; key?: string; name?: string }): string {
  return field.key?.trim() || field.name?.trim() || field.id;
}

function resolveConditionFieldID(condition: FormConditionSchema): string {
  return condition.fieldId?.trim() || condition.field?.trim() || '';
}

function normalizeCurrentCondition(condition: FormStepCondition | undefined): FormStepCondition | undefined {
  if (!condition) {
    return undefined;
  }

  if (isConditionGroup(condition)) {
    return {
      logic: condition.logic,
      conditions: condition.conditions
        .map((item) => normalizeCurrentCondition(item))
        .filter((item): item is FormStepCondition => item !== undefined),
    };
  }

  return {
    fieldId: resolveConditionFieldID(condition),
    operator: condition.operator,
    value: condition.value,
  };
}

function normalizeCurrentField(
  field: NormalizedFieldSchema,
  stepIndex: number,
  fieldIndex: number,
): NormalizedFieldSchema {
  const fieldId = field.id || `step-${stepIndex}-field-${fieldIndex}`;
  const base = {
    id: fieldId,
    key: resolveFieldKey(field),
    name: field.name ?? field.key,
    label: field.label ?? field.name ?? field.key,
    description: field.description,
    placeholder: field.placeholder,
    defaultValue: field.defaultValue,
    validation: field.validation,
    condition: normalizeCurrentCondition(field.condition),
  };

  switch (field.type) {
    case 'select':
    case 'multiselect':
      return {
        ...base,
        type: field.type,
        options: field.options.map((option, optionIndex) => ({
          ...option,
          id: option.id ?? `${fieldId}-option-${optionIndex}`,
        })),
      };
    case 'tel':
      return {
        ...base,
        type: field.type,
        defaultCountry: field.defaultCountry,
        showValidationIcon: field.showValidationIcon,
      };
    case 'number':
      return {
        ...base,
        type: field.type,
        numberType: field.numberType,
        decimalPlaces: field.decimalPlaces,
      };
    case 'checkbox':
      return {
        ...base,
        type: field.type,
        checkboxLabel: field.checkboxLabel,
      };
    case 'date':
      return {
        ...base,
        type: field.type,
        minDate: field.minDate,
        maxDate: field.maxDate,
        timezone: field.timezone,
      };
    default:
      return {
        ...base,
        type: field.type,
      };
  }
}

function normalizeCurrentSchema(schema: FormSchema): FormSchema {
  return {
    ...schema,
    steps: schema.steps.map((step, stepIndex) => ({
      ...step,
      showTitle: step.showTitle !== false,
      title: step.title?.trim() ? step.title : undefined,
      fields: step.fields?.map((field, fieldIndex) => normalizeCurrentField(field, stepIndex, fieldIndex)),
      condition: normalizeCurrentCondition(step.condition),
    })),
  };
}

export function normalizeFormSchema(schema: FormSchema | LegacyFormSchema): FormSchema {
  if (!isLegacyFormSchema(schema)) {
    return normalizeCurrentSchema(schema);
  }

  return {
    id: schema.id ?? 'legacy-form',
    steps: [
      {
        id: 'legacy-step-1',
        title: schema.title ?? 'Form',
        showTitle: true,
        fields: (schema.fields ?? []).map(normalizeLegacyField),
      },
    ],
  };
}

// =============================================================================
// Form Validator Builder
// =============================================================================

function buildFormValidator(steps: FormStepSchema[], validationMessages: FormValidationMessages) {
  const allFields = steps.flatMap((step) => step.fields ?? []);
  const conditionalFields = allFields.filter((f) => f.condition);
  const fieldKeyByID = buildFieldKeyByID(steps);

  // Build base shape - conditional fields are optional in base schema
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of allFields) {
    const validator = buildFieldValidator(field, validationMessages);
    const fieldKey = resolveFieldKey(field);
    shape[fieldKey] = field.condition ? validator.optional() : validator;
  }

  const baseSchema = z.object(shape);

  // No conditional fields = no need for superRefine
  if (conditionalFields.length === 0) {
    return baseSchema;
  }

  // Validate conditional fields when their conditions are met
  return baseSchema.superRefine((data, ctx) => {
    for (const field of conditionalFields) {
      if (!field.condition) {
        continue;
      }

      const conditionMet = evaluateConditionLogic(field.condition, data, fieldKeyByID);
      if (conditionMet) {
        const validator = buildFieldValidator(field, validationMessages);
        const fieldKey = resolveFieldKey(field);
        const result = validator.safeParse(data[fieldKey]);
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({
              ...issue,
              path: [fieldKey, ...issue.path],
            });
          }
        }
      }
    }
  });
}

// =============================================================================
// Condition Evaluator
// =============================================================================

function arrayIncludes(arr: unknown[], value: unknown): boolean {
  return arr.some((item) => item === value);
}

function arrayIncludesAny(arr: unknown[], values: unknown[]): boolean {
  return values.some((v) => arr.some((item) => item === v));
}

function arrayIncludesAll(arr: unknown[], values: unknown[]): boolean {
  return values.every((v) => arr.some((item) => item === v));
}

/**
 * Compare two values (number or date string)
 * Returns -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareValues(a: unknown, b: unknown): number | null {
  // Number comparison
  if (typeof a === 'number' && typeof b === 'number') {
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }
    return 0;
  }

  // Date string comparison (ISO 8601: YYYY-MM-DD)
  if (typeof a === 'string' && typeof b === 'string') {
    // Simple string comparison works for ISO 8601 dates
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }
    return 0;
  }

  return null;
}

function evaluateCondition(
  condition: FormConditionSchema,
  values: Record<string, unknown>,
  fieldKeyByID = new Map<string, string>(Object.keys(values).map((key) => [key, key])),
): boolean {
  const fieldKey = fieldKeyByID.get(resolveConditionFieldID(condition));
  const fieldValue = fieldKey ? values[fieldKey] : undefined;
  const conditionValue = condition.value;

  switch (condition.operator) {
    case 'eq':
      return fieldValue === conditionValue;

    case 'neq':
      return fieldValue !== conditionValue;

    case 'gt': {
      const cmp = compareValues(fieldValue, conditionValue);
      return cmp !== null && cmp > 0;
    }

    case 'gte': {
      const cmp = compareValues(fieldValue, conditionValue);
      return cmp !== null && cmp >= 0;
    }

    case 'lt': {
      const cmp = compareValues(fieldValue, conditionValue);
      return cmp !== null && cmp < 0;
    }

    case 'lte': {
      const cmp = compareValues(fieldValue, conditionValue);
      return cmp !== null && cmp <= 0;
    }

    case 'in':
      if (!Array.isArray(conditionValue)) {
        return false;
      }
      return arrayIncludes(conditionValue, fieldValue);

    case 'notIn':
      if (!Array.isArray(conditionValue)) {
        return false;
      }
      return !arrayIncludes(conditionValue, fieldValue);

    case 'contains':
      if (!Array.isArray(fieldValue)) {
        return false;
      }
      return arrayIncludes(fieldValue, conditionValue);

    case 'containsAny':
      if (!Array.isArray(fieldValue) || !Array.isArray(conditionValue)) {
        return false;
      }
      return arrayIncludesAny(fieldValue, conditionValue);

    case 'containsAll':
      if (!Array.isArray(fieldValue) || !Array.isArray(conditionValue)) {
        return false;
      }
      return arrayIncludesAll(fieldValue, conditionValue);

    case 'exists':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';

    default:
      return true;
  }
}

/**
 * Evaluate a condition group (AND/OR logic)
 */
function evaluateConditionGroup(
  group: FormConditionGroup,
  values: Record<string, unknown>,
  fieldKeyByID = new Map<string, string>(Object.keys(values).map((key) => [key, key])),
): boolean {
  const results = group.conditions.map((c) =>
    isConditionGroup(c) ? evaluateConditionGroup(c, values, fieldKeyByID) : evaluateCondition(c, values, fieldKeyByID),
  );

  return group.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
}

/**
 * Evaluate a condition (single or group)
 * Works for both step conditions and field conditions
 */
export function evaluateConditionLogic(
  condition: FormStepCondition,
  values: Record<string, unknown>,
  fieldKeyByID = new Map<string, string>(Object.keys(values).map((key) => [key, key])),
): boolean {
  return isConditionGroup(condition)
    ? evaluateConditionGroup(condition, values, fieldKeyByID)
    : evaluateCondition(condition, values, fieldKeyByID);
}

function buildFieldKeyByID(steps: FormStepSchema[]): Map<string, string> {
  const fieldKeyByID = new Map<string, string>();
  for (const step of steps) {
    for (const field of step.fields ?? []) {
      const fieldKey = resolveFieldKey(field);
      fieldKeyByID.set(field.id, fieldKey);
      if (field.key) {
        fieldKeyByID.set(field.key, fieldKey);
      }
      if (field.name) {
        fieldKeyByID.set(field.name, fieldKey);
      }
    }
  }
  return fieldKeyByID;
}

// =============================================================================
// Build Form
// =============================================================================

export function buildForm<T extends FormValues = FormValues>(
  schema: FormSchema | LegacyFormSchema,
  options?: {
    validationMessages?: FormValidationMessages;
  },
): BuiltForm<T> {
  const normalizedSchema = normalizeFormSchema(schema);
  const fieldKeyByID = buildFieldKeyByID(normalizedSchema.steps);
  const validator = buildFormValidator(
    normalizedSchema.steps,
    options?.validationMessages ?? defaultFormValidationMessages,
  );

  const getVisibleSteps = (values: T): FormStepSchema[] => {
    return normalizedSchema.steps.filter(
      (step) => !step.condition || evaluateConditionLogic(step.condition, values, fieldKeyByID),
    );
  };

  const parse = (data: unknown): T => {
    return validator.parse(data) as T;
  };

  const safeParse = (data: unknown) => {
    const result = validator.safeParse(data);
    if (result.success) {
      return { success: true as const, data: result.data as T };
    }
    return { success: false as const, error: result.error };
  };

  return {
    schema: normalizedSchema,
    getVisibleSteps,
    parse,
    safeParse,
  };
}

/**
 * Zod schema builder for form fields
 */

import { z } from 'zod';
import type { FieldValidator, FormFieldSchema } from '@/lib/types/form/schema';
import { getRequiredMessage, hasRequired } from './validation-primitives';
import { defaultFormValidationMessages, type FormValidationMessages } from './validation-messages';

/**
 * Apply comparison validators to a string schema (for length)
 */
function applyStringComparison(
  schema: z.ZodString,
  validator: FieldValidator,
  messages: FormValidationMessages,
): z.ZodString {
  const threshold = typeof validator.value === 'number' ? validator.value : Number(validator.value);

  switch (validator.predicate) {
    case 'gt':
      return schema.min(threshold + 1, validator.message ?? messages.stringGt(threshold));
    case 'gte':
      return schema.min(threshold, validator.message ?? messages.stringGte(threshold));
    case 'lt':
      return schema.max(threshold - 1, validator.message ?? messages.stringLt(threshold));
    case 'lte':
      return schema.max(threshold, validator.message ?? messages.stringLte(threshold));
    case 'eq':
      return schema.length(threshold, validator.message ?? messages.stringEq(threshold));
    default:
      return schema;
  }
}

/**
 * Build schema for text-like fields (text, textarea, tel, select)
 */
function buildStringSchema(
  validators: FieldValidator[],
  isRequired: boolean,
  requiredMessage: string,
  messages: FormValidationMessages,
): z.ZodTypeAny {
  let schema = z.string();

  for (const validator of validators) {
    if (validator.predicate === 'required') {
      continue;
    }

    switch (validator.predicate) {
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
      case 'eq':
        schema = applyStringComparison(schema, validator, messages);
        break;
      case 'url':
        schema = schema.refine(
          (val) => val === '' || z.url().safeParse(val).success,
          validator.message ?? messages.invalidUrl,
        );
        break;
      case 'regex':
        if (typeof validator.value === 'string' && validator.value) {
          const pattern = new RegExp(validator.value);
          schema = schema.refine((val) => val === '' || pattern.test(val), validator.message ?? messages.invalidFormat);
        }
        break;
    }
  }

  if (isRequired) {
    return z.preprocess((val) => val ?? '', schema.min(1, requiredMessage));
  }
  return z.preprocess((val) => val ?? '', schema);
}

/**
 * Build schema for email field
 */
function buildEmailSchema(
  validators: FieldValidator[],
  isRequired: boolean,
  requiredMessage: string,
  messages: FormValidationMessages,
): z.ZodTypeAny {
  let schema = z.string().refine((value) => z.email().safeParse(value).success, messages.invalidEmail);

  for (const validator of validators) {
    if (validator.predicate === 'required' || validator.predicate === 'email') {
      continue;
    }

    if (['gt', 'gte', 'lt', 'lte', 'eq'].includes(validator.predicate)) {
      schema = applyStringComparison(schema, validator, messages);
    }
  }

  if (isRequired) {
    return z.preprocess((val) => val ?? '', schema.min(1, requiredMessage));
  }
  // Optional: empty string → undefined to skip email validation
  return z.preprocess((val) => (val === '' || val == null ? undefined : val), schema.optional());
}

/**
 * Build schema for number field
 */
function buildNumberSchema(
  validators: FieldValidator[],
  isRequired: boolean,
  messages: FormValidationMessages,
): z.ZodTypeAny {
  let schema = z.number();

  for (const validator of validators) {
    if (validator.predicate === 'required') {
      continue;
    }

    const threshold = typeof validator.value === 'number' ? validator.value : Number(validator.value);

    switch (validator.predicate) {
      case 'gt':
        schema = schema.gt(threshold, validator.message ?? messages.numberGt(threshold));
        break;
      case 'gte':
        schema = schema.min(threshold, validator.message ?? messages.numberGte(threshold));
        break;
      case 'lt':
        schema = schema.lt(threshold, validator.message ?? messages.numberLt(threshold));
        break;
      case 'lte':
        schema = schema.max(threshold, validator.message ?? messages.numberLte(threshold));
        break;
      case 'eq':
        schema = schema.refine((v) => v === threshold, validator.message ?? messages.numberEq(threshold));
        break;
    }
  }

  return isRequired ? schema : schema.optional();
}

/**
 * Build schema for array fields (multiselect, checkbox)
 */
function buildArraySchema(
  validators: FieldValidator[],
  isRequired: boolean,
  requiredMessage: string,
  messages: FormValidationMessages,
): z.ZodTypeAny {
  let schema = z.array(z.string());

  for (const validator of validators) {
    if (validator.predicate === 'required') {
      continue;
    }

    const threshold = typeof validator.value === 'number' ? validator.value : Number(validator.value);

    switch (validator.predicate) {
      case 'gt':
        schema = schema.min(threshold + 1, validator.message ?? messages.arrayGt(threshold));
        break;
      case 'gte':
        schema = schema.min(threshold, validator.message ?? messages.arrayGte(threshold));
        break;
      case 'lt':
        schema = schema.max(threshold - 1, validator.message ?? messages.arrayLt(threshold));
        break;
      case 'lte':
        schema = schema.max(threshold, validator.message ?? messages.arrayLte(threshold));
        break;
      case 'eq':
        schema = schema.length(threshold, validator.message ?? messages.arrayEq(threshold));
        break;
    }
  }

  if (isRequired) {
    schema = schema.min(1, requiredMessage);
  }
  return z.preprocess((val) => val ?? [], schema);
}

/**
 * Build schema for date field
 */
function buildDateSchema(
  validators: FieldValidator[],
  isRequired: boolean,
  requiredMessage: string,
  messages: FormValidationMessages,
): z.ZodTypeAny {
  let schema = z.string();

  for (const validator of validators) {
    if (validator.predicate === 'required') {
      continue;
    }

    switch (validator.predicate) {
      case 'minDate':
        if (typeof validator.value === 'string') {
          const minDate = validator.value;
          schema = schema.refine((val) => !val || val >= minDate, validator.message ?? messages.dateMin(minDate));
        }
        break;
      case 'maxDate':
        if (typeof validator.value === 'string') {
          const maxDate = validator.value;
          schema = schema.refine((val) => !val || val <= maxDate, validator.message ?? messages.dateMax(maxDate));
        }
        break;
      case 'futureDate':
        schema = schema.refine((val) => {
          if (!val) {
            return true;
          }
          const date = new Date(val);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return date > today;
        }, validator.message ?? messages.futureDate);
        break;
      case 'pastDate':
        schema = schema.refine((val) => {
          if (!val) {
            return true;
          }
          const date = new Date(val);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return date < today;
        }, validator.message ?? messages.pastDate);
        break;
      case 'weekdayOnly':
        schema = schema.refine((val) => {
          if (!val) {
            return true;
          }
          const day = new Date(val).getDay();
          return day !== 0 && day !== 6;
        }, validator.message ?? messages.weekdayOnly);
        break;
      case 'minAge':
      case 'maxAge': {
        const targetAge = typeof validator.value === 'number' ? validator.value : Number(validator.value);
        const isMinAge = validator.predicate === 'minAge';
        schema = schema.refine(
          (val) => {
            if (!val || isNaN(targetAge)) {
              return true;
            }
            const birth = new Date(val);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
              age--;
            }
            return isMinAge ? age >= targetAge : age <= targetAge;
          },
          validator.message ?? (isMinAge ? messages.minAge(targetAge) : messages.maxAge(targetAge)),
        );
        break;
      }
    }
  }

  if (isRequired) {
    return z.preprocess((val) => val ?? '', schema.min(1, requiredMessage));
  }
  return z.preprocess((val) => val ?? '', schema);
}

/**
 * Build a Zod schema for a form field
 * Used for form submission validation
 */
export function buildFieldValidator(
  field: FormFieldSchema,
  messages: FormValidationMessages = defaultFormValidationMessages,
): z.ZodTypeAny {
  const validators = field.validation?.validators ?? [];
  const isRequired = hasRequired(field);
  const requiredMessage = getRequiredMessage(field, messages);

  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'tel':
    case 'select':
      return buildStringSchema(validators, isRequired, requiredMessage, messages);
    case 'email':
      return buildEmailSchema(validators, isRequired, requiredMessage, messages);
    case 'number':
      return buildNumberSchema(validators, isRequired, messages);
    case 'multiselect':
      return buildArraySchema(validators, isRequired, requiredMessage, messages);
    case 'switch':
      return isRequired ? z.boolean() : z.boolean().optional();
    case 'checkbox':
      // Checkbox required means must be checked (true)
      return isRequired ? z.literal(true, { message: requiredMessage }) : z.boolean().optional();
    case 'date':
      return buildDateSchema(validators, isRequired, requiredMessage, messages);
  }
}

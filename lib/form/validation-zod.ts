/**
 * Zod schema builder for form fields
 */

import * as z from '@/lib/zod-mini';
import type { FieldValidator, FormFieldSchema } from '@/lib/types/form/schema';
import { getRequiredMessage, hasRequired } from './validation-primitives';
import { defaultFormValidationMessages, type FormValidationMessages } from './validation-messages';

/** Classic zod's `z.preprocess(fn, schema)`: the same pipe of a transform into the schema. */
function preprocess(fn: (value: unknown) => unknown, schema: z.ZodMiniType): z.ZodMiniType {
  return z.pipe(z.transform(fn), schema);
}

/**
 * Apply comparison validators to a string schema (for length)
 */
function applyStringComparison(
  schema: z.ZodMiniString<string>,
  validator: FieldValidator,
  messages: FormValidationMessages,
): z.ZodMiniString<string> {
  const threshold = typeof validator.value === 'number' ? validator.value : Number(validator.value);

  switch (validator.predicate) {
    case 'gt':
      return schema.check(z.minLength(threshold + 1, validator.message ?? messages.stringGt(threshold)));
    case 'gte':
      return schema.check(z.minLength(threshold, validator.message ?? messages.stringGte(threshold)));
    case 'lt':
      return schema.check(z.maxLength(threshold - 1, validator.message ?? messages.stringLt(threshold)));
    case 'lte':
      return schema.check(z.maxLength(threshold, validator.message ?? messages.stringLte(threshold)));
    case 'eq':
      return schema.check(z.length(threshold, validator.message ?? messages.stringEq(threshold)));
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
): z.ZodMiniType {
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
        schema = schema.check(
          z.refine(
            (val: string) => val === '' || z.url().safeParse(val).success,
            validator.message ?? messages.invalidUrl,
          ),
        );
        break;
      case 'regex':
        if (typeof validator.value === 'string' && validator.value) {
          const pattern = new RegExp(validator.value);
          schema = schema.check(
            z.refine((val: string) => val === '' || pattern.test(val), validator.message ?? messages.invalidFormat),
          );
        }
        break;
    }
  }

  if (isRequired) {
    return preprocess((val) => val ?? '', schema.check(z.minLength(1, requiredMessage)));
  }
  return preprocess((val) => val ?? '', schema);
}

/**
 * Build schema for email field
 */
function buildEmailSchema(
  validators: FieldValidator[],
  isRequired: boolean,
  requiredMessage: string,
  messages: FormValidationMessages,
): z.ZodMiniType {
  let schema = z.string().check(z.refine((value: string) => z.email().safeParse(value).success, messages.invalidEmail));

  for (const validator of validators) {
    if (validator.predicate === 'required' || validator.predicate === 'email') {
      continue;
    }

    if (['gt', 'gte', 'lt', 'lte', 'eq'].includes(validator.predicate)) {
      schema = applyStringComparison(schema, validator, messages);
    }
  }

  if (isRequired) {
    return preprocess((val) => val ?? '', schema.check(z.minLength(1, requiredMessage)));
  }
  // Optional: empty string → undefined to skip email validation
  return preprocess((val) => (val === '' || val == null ? undefined : val), z.optional(schema));
}

/**
 * Build schema for number field
 */
function buildNumberSchema(
  validators: FieldValidator[],
  isRequired: boolean,
  messages: FormValidationMessages,
): z.ZodMiniType {
  let schema = z.number();

  for (const validator of validators) {
    if (validator.predicate === 'required') {
      continue;
    }

    const threshold = typeof validator.value === 'number' ? validator.value : Number(validator.value);

    switch (validator.predicate) {
      case 'gt':
        schema = schema.check(z.gt(threshold, validator.message ?? messages.numberGt(threshold)));
        break;
      case 'gte':
        schema = schema.check(z.gte(threshold, validator.message ?? messages.numberGte(threshold)));
        break;
      case 'lt':
        schema = schema.check(z.lt(threshold, validator.message ?? messages.numberLt(threshold)));
        break;
      case 'lte':
        schema = schema.check(z.lte(threshold, validator.message ?? messages.numberLte(threshold)));
        break;
      case 'eq':
        schema = schema.check(
          z.refine((v: number) => v === threshold, validator.message ?? messages.numberEq(threshold)),
        );
        break;
    }
  }

  return isRequired ? schema : z.optional(schema);
}

/**
 * Build schema for array fields (multiselect, checkbox)
 */
function buildArraySchema(
  validators: FieldValidator[],
  isRequired: boolean,
  requiredMessage: string,
  messages: FormValidationMessages,
): z.ZodMiniType {
  let schema = z.array(z.string());

  for (const validator of validators) {
    if (validator.predicate === 'required') {
      continue;
    }

    const threshold = typeof validator.value === 'number' ? validator.value : Number(validator.value);

    switch (validator.predicate) {
      case 'gt':
        schema = schema.check(z.minLength(threshold + 1, validator.message ?? messages.arrayGt(threshold)));
        break;
      case 'gte':
        schema = schema.check(z.minLength(threshold, validator.message ?? messages.arrayGte(threshold)));
        break;
      case 'lt':
        schema = schema.check(z.maxLength(threshold - 1, validator.message ?? messages.arrayLt(threshold)));
        break;
      case 'lte':
        schema = schema.check(z.maxLength(threshold, validator.message ?? messages.arrayLte(threshold)));
        break;
      case 'eq':
        schema = schema.check(z.length(threshold, validator.message ?? messages.arrayEq(threshold)));
        break;
    }
  }

  if (isRequired) {
    schema = schema.check(z.minLength(1, requiredMessage));
  }
  return preprocess((val) => val ?? [], schema);
}

/**
 * Build schema for date field
 */
function buildDateSchema(
  validators: FieldValidator[],
  isRequired: boolean,
  requiredMessage: string,
  messages: FormValidationMessages,
): z.ZodMiniType {
  let schema = z.string();
  const refine = (check: (val: string) => boolean, message: string) => {
    schema = schema.check(z.refine(check, message));
  };

  for (const validator of validators) {
    if (validator.predicate === 'required') {
      continue;
    }

    switch (validator.predicate) {
      case 'minDate':
        if (typeof validator.value === 'string') {
          const minDate = validator.value;
          refine((val) => !val || val >= minDate, validator.message ?? messages.dateMin(minDate));
        }
        break;
      case 'maxDate':
        if (typeof validator.value === 'string') {
          const maxDate = validator.value;
          refine((val) => !val || val <= maxDate, validator.message ?? messages.dateMax(maxDate));
        }
        break;
      case 'futureDate':
        refine((val) => {
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
        refine((val) => {
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
        refine((val) => {
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
        refine(
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
    return preprocess((val) => val ?? '', schema.check(z.minLength(1, requiredMessage)));
  }
  return preprocess((val) => val ?? '', schema);
}

/**
 * Build a Zod schema for a form field
 * Used for form submission validation
 */
export function buildFieldValidator(
  field: FormFieldSchema,
  messages: FormValidationMessages = defaultFormValidationMessages,
): z.ZodMiniType {
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
      return isRequired ? z.boolean() : z.optional(z.boolean());
    case 'checkbox':
      // Checkbox required means must be checked (true)
      return isRequired ? z.literal(true, { message: requiredMessage }) : z.optional(z.boolean());
    case 'date':
      return buildDateSchema(validators, isRequired, requiredMessage, messages);
  }
}

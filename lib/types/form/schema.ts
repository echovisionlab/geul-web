/**
 * 직렬화 가능한 Form Schema 정의
 * WebUI에서 생성하고 DB/JSON으로 저장 가능
 */

import * as z from '@/lib/zod-mini';
import { createFilterSchema, createSimpleListInputSchema, createSortSchema } from '../trpc/schema';
import { formFilterFields, formSortFields } from './table-spec';

// =============================================================================
// Form Status Validation (Zod)
// =============================================================================

export const formStatusSchema = z.enum(['draft', 'published']);

// =============================================================================
// Field Validator (선언적, 직렬화 가능)
// =============================================================================

/**
 * FieldValidator 인터페이스
 *
 * - id: 고유 식별자
 * - name: 사용자 정의 표시명 (e.g., "이메일 형식 검사", "최소 8자")
 * - predicate: Predicate 참조명 ('gte', 'email', 'koreanPhone' 등)
 * - value: Predicate 인자 (필요시)
 * - message: 커스텀 에러 메시지
 *
 * Context-dependent interpretation (comparison predicates):
 * - string field → length
 * - number field → value
 * - array field (checkbox, multiselect) → count
 *
 * Note: 실행 순서는 배열 순서를 따름
 */
export interface FieldValidator {
  id: string;
  name: string;
  predicate: string;
  value?: unknown;
  message?: string;
}

// =============================================================================
// Field Schema (직렬화 가능)
// =============================================================================

export interface FormFieldOption {
  id?: string;
  value: string;
  label: string;
}

interface FormFieldSchemaBase {
  id: string;
  key?: string;
  name?: string;
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: unknown;
  validation?: { validators: FieldValidator[] };
  condition?: FormStepCondition;
}

export interface FormFieldSchemaText extends FormFieldSchemaBase {
  type: 'text' | 'email' | 'textarea';
}

export interface FormFieldSchemaPhone extends FormFieldSchemaBase {
  type: 'tel';
  defaultCountry?: string;
  showValidationIcon?: boolean;
}

export interface FormFieldSchemaNumber extends FormFieldSchemaBase {
  type: 'number';
  numberType?: 'integer' | 'float';
  decimalPlaces?: number; // Only for float, max decimal places (default: 2)
}

export interface FormFieldSchemaSelect extends FormFieldSchemaBase {
  type: 'select';
  options: FormFieldOption[];
}

export interface FormFieldSchemaMultiSelect extends FormFieldSchemaBase {
  type: 'multiselect';
  options: FormFieldOption[];
}

export interface FormFieldSchemaCheckbox extends FormFieldSchemaBase {
  type: 'checkbox';
  checkboxLabel?: string; // Label shown next to checkbox (e.g., "I agree to terms")
}

export interface FormFieldSchemaSwitch extends FormFieldSchemaBase {
  type: 'switch';
}

export interface FormFieldSchemaDate extends FormFieldSchemaBase {
  type: 'date';
  minDate?: string; // ISO 8601 format (YYYY-MM-DD)
  maxDate?: string; // ISO 8601 format (YYYY-MM-DD)
  timezone?: string; // IANA timezone (e.g., 'Asia/Seoul')
}

export type FormFieldSchema =
  | FormFieldSchemaText
  | FormFieldSchemaPhone
  | FormFieldSchemaNumber
  | FormFieldSchemaSelect
  | FormFieldSchemaMultiSelect
  | FormFieldSchemaCheckbox
  | FormFieldSchemaSwitch
  | FormFieldSchemaDate;

// =============================================================================
// Condition Schema (직렬화 가능)
// =============================================================================

export type FormConditionOperator =
  'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn' | 'contains' | 'containsAny' | 'containsAll' | 'exists';

export interface FormConditionSchema {
  fieldId?: string;
  field?: string;
  operator: FormConditionOperator;
  value?: string | number | boolean | string[] | number[];
}

// =============================================================================
// Condition Group (AND/OR logic)
// =============================================================================

export interface FormConditionGroup {
  logic: 'and' | 'or';
  conditions: (FormConditionSchema | FormConditionGroup)[];
}

/**
 * Step condition can be either a single condition or a group of conditions
 */
export type FormStepCondition = FormConditionSchema | FormConditionGroup;

// =============================================================================
// Step Schema (직렬화 가능)
// =============================================================================

export interface FormStepSchema {
  id: string;
  title?: string;
  showTitle?: boolean;
  description?: string;
  fields?: FormFieldSchema[];
  condition?: FormStepCondition;
}

// =============================================================================
// Form Schema (직렬화 가능)
// =============================================================================

export interface FormSchema {
  id: string;
  steps: FormStepSchema[];
}

// =============================================================================
// Zod Schemas for Collaboration
// =============================================================================

const fieldValidatorZod = z.object({
  id: z.string(),
  name: z.string(),
  predicate: z.string(),
  value: z.optional(z.unknown()),
  message: z.optional(z.string()),
});

const formFieldValidationZod = z.object({
  validators: z.array(fieldValidatorZod),
});

// Condition schemas (defined before field schemas to allow field.condition)
const formConditionSchemaZod: z.ZodMiniType<FormConditionSchema> = z.object({
  fieldId: z.optional(z.string()),
  field: z.optional(z.string()),
  operator: z.enum([
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'notIn',
    'contains',
    'containsAny',
    'containsAll',
    'exists',
  ]),
  value: z.optional(z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())])),
});

const formConditionGroupZod: z.ZodMiniType<FormConditionGroup> = z.lazy(() =>
  z.object({
    logic: z.enum(['and', 'or']),
    conditions: z.array(z.union([formConditionSchemaZod, formConditionGroupZod])),
  }),
);

const formStepConditionZod = z.union([formConditionSchemaZod, formConditionGroupZod]);

// Field schemas
const formFieldSchemaBaseZod = z.object({
  id: z.string(),
  key: z.optional(z.string()),
  name: z.optional(z.string()),
  label: z.optional(z.string()),
  description: z.optional(z.string()),
  placeholder: z.optional(z.string()),
  defaultValue: z.optional(z.unknown()),
  validation: z.optional(formFieldValidationZod),
  condition: z.optional(formStepConditionZod),
});

const optionZod: z.ZodMiniType<FormFieldOption> = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
});

const formFieldSchemaZod = z.union([
  z.extend(formFieldSchemaBaseZod, { type: z.enum(['text', 'email', 'textarea']) }),
  z.extend(formFieldSchemaBaseZod, {
    type: z.literal('tel'),
    defaultCountry: z.optional(z.string()),
    showValidationIcon: z.optional(z.boolean()),
  }),
  z.extend(formFieldSchemaBaseZod, {
    type: z.literal('number'),
    numberType: z.optional(z.enum(['integer', 'float'])),
    decimalPlaces: z.optional(z.number().check(z.int(), z.gte(0), z.lte(10))),
  }),
  z.extend(formFieldSchemaBaseZod, { type: z.literal('select'), options: z.array(optionZod) }),
  z.extend(formFieldSchemaBaseZod, { type: z.literal('multiselect'), options: z.array(optionZod) }),
  z.extend(formFieldSchemaBaseZod, {
    type: z.literal('checkbox'),
    checkboxLabel: z.optional(z.string()),
  }),
  z.extend(formFieldSchemaBaseZod, { type: z.literal('switch') }),
  z.extend(formFieldSchemaBaseZod, {
    type: z.literal('date'),
    minDate: z.optional(z.string()),
    maxDate: z.optional(z.string()),
    timezone: z.optional(z.string()),
  }),
]);

const formStepSchemaZod = z.object({
  id: z.string(),
  title: z.optional(z.string()),
  showTitle: z.optional(z.boolean()),
  description: z.optional(z.string()),
  fields: z.optional(z.array(formFieldSchemaZod)),
  condition: z.optional(formStepConditionZod),
});

export const formSchemaZod = z.object({
  id: z.string(),
  steps: z.array(formStepSchemaZod),
});

// =============================================================================
// List Input Schema for DataTable
// =============================================================================

const formFilterSchema = createFilterSchema(formFilterFields);
const formSortSchema = createSortSchema(formSortFields);

export const formListInputSchema = createSimpleListInputSchema({
  filterSchema: formFilterSchema,
  sortSchema: formSortSchema,
});

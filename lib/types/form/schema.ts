/**
 * 직렬화 가능한 Form Schema 정의
 * WebUI에서 생성하고 DB/JSON으로 저장 가능
 */

import { z } from 'zod';
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
  value: z.unknown().optional(),
  message: z.string().optional(),
});

const formFieldValidationZod = z.object({
  validators: z.array(fieldValidatorZod),
});

// Condition schemas (defined before field schemas to allow field.condition)
const formConditionSchemaZod: z.ZodType<FormConditionSchema> = z.object({
  fieldId: z.string().optional(),
  field: z.string().optional(),
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
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())]).optional(),
});

const formConditionGroupZod: z.ZodType<FormConditionGroup> = z.lazy(() =>
  z.object({
    logic: z.enum(['and', 'or']),
    conditions: z.array(z.union([formConditionSchemaZod, formConditionGroupZod])),
  }),
);

const formStepConditionZod = z.union([formConditionSchemaZod, formConditionGroupZod]);

// Field schemas
const formFieldSchemaBaseZod = z.object({
  id: z.string(),
  key: z.string().optional(),
  name: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.unknown().optional(),
  validation: formFieldValidationZod.optional(),
  condition: formStepConditionZod.optional(),
});

const optionZod: z.ZodType<FormFieldOption> = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
});

const formFieldSchemaZod = z.union([
  formFieldSchemaBaseZod.extend({ type: z.enum(['text', 'email', 'textarea']) }),
  formFieldSchemaBaseZod.extend({
    type: z.literal('tel'),
    defaultCountry: z.string().optional(),
    showValidationIcon: z.boolean().optional(),
  }),
  formFieldSchemaBaseZod.extend({
    type: z.literal('number'),
    numberType: z.enum(['integer', 'float']).optional(),
    decimalPlaces: z.number().int().min(0).max(10).optional(),
  }),
  formFieldSchemaBaseZod.extend({ type: z.literal('select'), options: z.array(optionZod) }),
  formFieldSchemaBaseZod.extend({ type: z.literal('multiselect'), options: z.array(optionZod) }),
  formFieldSchemaBaseZod.extend({
    type: z.literal('checkbox'),
    checkboxLabel: z.string().optional(),
  }),
  formFieldSchemaBaseZod.extend({ type: z.literal('switch') }),
  formFieldSchemaBaseZod.extend({
    type: z.literal('date'),
    minDate: z.string().optional(),
    maxDate: z.string().optional(),
    timezone: z.string().optional(),
  }),
]);

const formStepSchemaZod = z.object({
  id: z.string(),
  title: z.string().optional(),
  showTitle: z.boolean().optional(),
  description: z.string().optional(),
  fields: z.array(formFieldSchemaZod).optional(),
  condition: formStepConditionZod.optional(),
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

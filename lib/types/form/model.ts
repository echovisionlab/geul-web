/**
 * Form model types for runtime and UI components
 */

import type { FormStatus } from '@echovisionlab/geul-common/types';
import type { UserRole } from '@/lib/types/user/model';
import type { FormValues } from './guards';
import type {
  FormConditionGroup,
  FormConditionOperator,
  FormFieldOption,
  FormFieldSchema,
  FormFieldSchemaMultiSelect,
  FormFieldSchemaSelect,
  FormSchema,
  FormStepCondition,
  FormStepSchema,
} from './schema';

// =============================================================================
// Form Status
// =============================================================================

export type { FormStatus } from '@echovisionlab/geul-common/types';

export { formFilterFields, formSortFields } from './table-spec';

export interface FormListItem {
  id: string;
  title: string;
  slug: string | null;
  status: FormStatus;
  isPublic: boolean;
  accessPassword: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
  createdAt: Date;
}

// =============================================================================
// Access Reason
// =============================================================================

export type AccessReason =
  | 'form_not_found'
  | 'form_not_published'
  | 'not_public'
  | 'password_required'
  | 'already_submitted'
  | 'not_yet_open'
  | 'closed'
  | 'max_submissions_reached'
  | 'auth_required'
  | 'role_not_allowed';

const ACCESS_REASONS: readonly AccessReason[] = [
  'form_not_found',
  'form_not_published',
  'not_public',
  'password_required',
  'already_submitted',
  'not_yet_open',
  'closed',
  'max_submissions_reached',
  'auth_required',
  'role_not_allowed',
];

export function isAccessReason(value: unknown): value is AccessReason {
  return typeof value === 'string' && (ACCESS_REASONS as readonly string[]).includes(value);
}

// =============================================================================
// Form View (Public/Client-safe data)
// =============================================================================

export interface FormView {
  id: string;
  title: string;
  slug: string | null;
  schema: FormSchema;
  status: FormStatus;
}

// =============================================================================
// Form Entity (DB Model)
// =============================================================================

export interface FormEntity {
  id: string;
  title: string;
  slug: string | null;
  schema: FormSchema;
  status: FormStatus;
  accessPassword: string | null;
  opensAt: Date | null;
  closesAt: Date | null;
  maxSubmissions: number | null;
  // Access rules
  requireAuth: boolean;
  allowedRoles: UserRole[] | null;
  allowDuplicateSubmission: boolean;
  // Public URL access
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Form Submission
// =============================================================================

export interface FormSubmission {
  id: string;
  formId: string;
  data: FormValues;
  ipAddress: string | null;
  countryCode: string | null;
  userAgent: string | null;
  memberId: string | null;
  createdAt: Date;
}

export interface SubmissionMeta {
  ipAddress?: string | null;
  countryCode?: string | null;
  userAgent?: string | null;
  memberId?: string | null;
}

// =============================================================================
// Form Statistics
// =============================================================================

export interface FormStats {
  totalSubmissions: number;
  submissionsToday: number;
  submissionsThisWeek: number;
  submissionsThisMonth: number;
  fieldStats: Record<string, FieldStats>;
}

interface FieldStatsBase {
  fieldId: string;
  fieldName: string;
  fieldType: string;
}

export interface FieldStatsDistribution extends FieldStatsBase {
  distribution: { value: string; count: number }[];
}

export interface FieldStatsDate extends FieldStatsBase {
  dateDistribution: { date: string; count: number }[];
}

export interface FieldStatsNumber extends FieldStatsBase {
  min: number;
  max: number;
  avg: number;
  count: number;
  histogram: { bucket: number; count: number }[];
}

export type FieldStats = FieldStatsDistribution | FieldStatsDate | FieldStatsNumber;

// =============================================================================
// Input Types
// =============================================================================

export interface CreateFormInput {
  title: string;
  slug?: string | null;
  schema: FormSchema;
  status?: FormStatus;
  accessPassword?: string | null;
  opensAt?: Date | null;
  closesAt?: Date | null;
  maxSubmissions?: number | null;
  // Access rules
  requireAuth?: boolean;
  allowedRoles?: UserRole[] | null;
  allowDuplicateSubmission?: boolean;
  // Public URL access
  isPublic?: boolean;
}

export interface UpdateFormInput {
  title?: string;
  slug?: string | null;
  schema?: FormSchema;
  status?: FormStatus;
  accessPassword?: string | null;
  opensAt?: Date | null;
  closesAt?: Date | null;
  maxSubmissions?: number | null;
  // Access rules
  requireAuth?: boolean;
  allowedRoles?: UserRole[] | null;
  allowDuplicateSubmission?: boolean;
  // Public URL access
  isPublic?: boolean;
}

// =============================================================================
// Built Form (runtime)
// =============================================================================

export interface BuiltForm<T extends FormValues = FormValues> {
  schema: FormSchema;
  getVisibleSteps: (values: T) => FormStepSchema[];
  parse: (data: unknown) => T;
  safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: Error };
}

// =============================================================================
// Field Types
// =============================================================================

export type FieldType =
  'text' | 'email' | 'textarea' | 'tel' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'switch' | 'date';

export const FIELD_TYPES: { label: string; value: FieldType }[] = [
  { label: 'Text', value: 'text' },
  { label: 'Email', value: 'email' },
  { label: 'Textarea', value: 'textarea' },
  { label: 'Phone', value: 'tel' },
  { label: 'Number', value: 'number' },
  { label: 'Date', value: 'date' },
  { label: 'Select', value: 'select' },
  { label: 'Multi Select', value: 'multiselect' },
  { label: 'Checkbox', value: 'checkbox' },
  { label: 'Switch', value: 'switch' },
];

// =============================================================================
// Field Type Guards
// =============================================================================

type FieldWithOptions = FormFieldSchemaSelect | FormFieldSchemaMultiSelect;

function isFieldWithOptions(field: FormFieldSchema): field is FieldWithOptions {
  return field.type === 'select' || field.type === 'multiselect';
}

export function hasOptions(field: FormFieldSchema): field is FormFieldSchema & { options: FormFieldOption[] } {
  return isFieldWithOptions(field);
}

/**
 * Type guard to check if a string is a valid FieldType
 */
export function isFieldType(value: string): value is FieldType {
  return FIELD_TYPES.some((ft) => ft.value === value);
}

const CONDITION_OPERATORS: readonly FormConditionOperator[] = [
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
];

/**
 * Type guard to check if a string is a valid FormConditionOperator
 */
export function isConditionOperator(value: string): value is FormConditionOperator {
  return (CONDITION_OPERATORS as readonly string[]).includes(value);
}

// =============================================================================
// Condition Type Guards
// =============================================================================

/**
 * Type guard to check if a condition is a condition group (AND/OR)
 */
export function isConditionGroup(condition: FormStepCondition): condition is FormConditionGroup {
  return 'logic' in condition && 'conditions' in condition;
}

// =============================================================================
// Field Type Definition
// =============================================================================

/**
 * Condition value type hint for UI
 */
export type ConditionValueType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';

/**
 * Field Type Definition
 * Centralizes all metadata and behavior for a field type
 */
export interface FieldTypeDefinition {
  /** Unique type identifier */
  type: FieldType;
  /** Display label */
  label: string;
  /** Supported validator predicate names */
  validators: string[];
  /** Supported condition operators */
  conditionOperators: FormConditionOperator[];
  /** UI hint for condition value input */
  conditionValueType: ConditionValueType;
}

/**
 * Create a new field schema with updated type (type-safe)
 */
export function createFieldWithType(
  field: FormFieldSchema,
  newType: FieldType,
  defaultOptions: FormFieldOption[] = [
    {
      id: `${field.id}-option-1`,
      label: 'Option 1',
      value: 'option1',
    },
  ],
): FormFieldSchema {
  const baseProps = {
    id: field.id,
    key: field.key,
    label: field.label,
    description: field.description,
    placeholder: field.placeholder,
    defaultValue: field.defaultValue,
    validation: field.validation,
    condition: field.condition,
  };

  switch (newType) {
    case 'text':
    case 'email':
    case 'textarea':
      return { ...baseProps, type: newType };
    case 'tel':
      return { ...baseProps, type: newType };
    case 'number':
      return { ...baseProps, type: newType };
    case 'select':
      return {
        ...baseProps,
        type: newType,
        options: hasOptions(field) ? field.options : defaultOptions,
      };
    case 'multiselect':
      return {
        ...baseProps,
        type: newType,
        options: hasOptions(field) ? field.options : defaultOptions,
      };
    case 'checkbox':
      return { ...baseProps, type: newType };
    case 'switch':
      return { ...baseProps, type: newType };
    case 'date':
      return { ...baseProps, type: newType };
  }
}

/**
 * Update field options (type-safe)
 */
export function updateFieldOptions(field: FormFieldSchema, options: FormFieldOption[]): FormFieldSchema {
  if (field.type === 'select') {
    return { ...field, options };
  }
  if (field.type === 'multiselect') {
    return { ...field, options };
  }
  return field;
}

// =============================================================================
// FormBuilder Types
// =============================================================================

export interface FieldItem {
  id: string;
  field: FormFieldSchema;
  fieldIndex: number;
}

export interface StepGroup {
  id: string;
  items: FieldItem[];
  step: FormStepSchema;
  stepIndex: number;
}

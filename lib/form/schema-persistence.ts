import { isConditionGroup } from '@/lib/types/form/model';
import type { FormConditionSchema, FormSchema, FormStepCondition } from '@/lib/types/form/schema';

type ValidationIssueCode =
  | 'schema.id.required'
  | 'schema.steps.required'
  | 'step.id.required'
  | 'step.id.duplicate'
  | 'field.id.required'
  | 'field.id.duplicate'
  | 'field.key.required'
  | 'field.key.duplicate'
  | 'option.id.duplicate'
  | 'option.value.duplicate'
  | 'condition.fieldId.required'
  | 'condition.fieldId.missing';

export interface FormSchemaValidationIssue {
  code: ValidationIssueCode;
  path: string;
  fieldId?: string;
  key?: string;
}

export interface FormSchemaValidationResult {
  valid: boolean;
  issues: FormSchemaValidationIssue[];
  fieldKeyIssues: Record<string, ValidationIssueCode>;
}

function resolveFieldKey(step: FormSchema['steps'][number], fieldIndex: number): string {
  const field = step.fields?.[fieldIndex];
  if (!field) {
    return '';
  }
  return field.key?.trim() || field.name?.trim() || '';
}

function resolveConditionFieldID(condition: FormConditionSchema): string {
  return condition.fieldId?.trim() || condition.field?.trim() || '';
}

function validateCondition(
  condition: FormStepCondition | undefined,
  fieldIDs: Set<string>,
  path: string,
): FormSchemaValidationIssue[] {
  if (!condition) {
    return [];
  }

  if (isConditionGroup(condition)) {
    return condition.conditions.flatMap((child, index) =>
      validateCondition(child, fieldIDs, `${path}.conditions[${index}]`),
    );
  }

  const fieldID = resolveConditionFieldID(condition);
  if (!fieldID) {
    return [{ code: 'condition.fieldId.required', path: `${path}.fieldId` }];
  }
  if (!fieldIDs.has(fieldID)) {
    return [{ code: 'condition.fieldId.missing', path: `${path}.fieldId` }];
  }

  return [];
}

export function validateCanonicalFormSchemaForPersistence(schema: FormSchema): FormSchemaValidationResult {
  const issues: FormSchemaValidationIssue[] = [];

  if (!schema.id.trim()) {
    issues.push({ code: 'schema.id.required', path: 'schema.id' });
  }
  if (schema.steps.length === 0) {
    issues.push({ code: 'schema.steps.required', path: 'schema.steps' });
  }

  const stepIDs = new Set<string>();
  const fieldIDs = new Set<string>();
  const fieldKeys = new Set<string>();

  schema.steps.forEach((step, stepIndex) => {
    const stepID = step.id.trim();
    if (!stepID) {
      issues.push({ code: 'step.id.required', path: `schema.steps[${stepIndex}].id` });
    } else if (stepIDs.has(stepID)) {
      issues.push({ code: 'step.id.duplicate', path: `schema.steps[${stepIndex}].id` });
    } else {
      stepIDs.add(stepID);
    }

    for (const [fieldIndex, field] of (step.fields ?? []).entries()) {
      const fieldID = field.id.trim();
      const fieldPath = `schema.steps[${stepIndex}].fields[${fieldIndex}]`;
      if (!fieldID) {
        issues.push({ code: 'field.id.required', path: `${fieldPath}.id` });
      } else if (fieldIDs.has(fieldID)) {
        issues.push({ code: 'field.id.duplicate', path: `${fieldPath}.id`, fieldId: fieldID });
      } else {
        fieldIDs.add(fieldID);
      }

      const fieldKey = resolveFieldKey(step, fieldIndex);
      if (!fieldKey) {
        issues.push({
          code: 'field.key.required',
          path: `${fieldPath}.key`,
          fieldId: field.id,
        });
      } else if (fieldKeys.has(fieldKey)) {
        issues.push({
          code: 'field.key.duplicate',
          path: `${fieldPath}.key`,
          fieldId: field.id,
          key: fieldKey,
        });
      } else {
        fieldKeys.add(fieldKey);
      }

      const optionIDs = new Set<string>();
      const optionValues = new Set<string>();
      const fieldOptions = 'options' in field ? field.options : [];
      for (const [optionIndex, option] of fieldOptions.entries()) {
        const optionPath = `${fieldPath}.options[${optionIndex}]`;
        const optionID = option.id?.trim();
        if (optionID) {
          if (optionIDs.has(optionID)) {
            issues.push({
              code: 'option.id.duplicate',
              path: `${optionPath}.id`,
              fieldId: field.id,
            });
          } else {
            optionIDs.add(optionID);
          }
        }

        const optionValue = String(option.value);
        if (optionValues.has(optionValue)) {
          issues.push({
            code: 'option.value.duplicate',
            path: `${optionPath}.value`,
            fieldId: field.id,
          });
        } else {
          optionValues.add(optionValue);
        }
      }
    }
  });

  schema.steps.forEach((step, stepIndex) => {
    issues.push(...validateCondition(step.condition, fieldIDs, `schema.steps[${stepIndex}].condition`));
    for (const [fieldIndex, field] of (step.fields ?? []).entries()) {
      issues.push(
        ...validateCondition(field.condition, fieldIDs, `schema.steps[${stepIndex}].fields[${fieldIndex}].condition`),
      );
    }
  });

  const fieldKeyIssues = Object.fromEntries(
    issues
      .filter((issue) => issue.fieldId && (issue.code === 'field.key.required' || issue.code === 'field.key.duplicate'))
      .map((issue) => [issue.fieldId as string, issue.code]),
  );

  return {
    valid: issues.length === 0,
    issues,
    fieldKeyIssues,
  };
}

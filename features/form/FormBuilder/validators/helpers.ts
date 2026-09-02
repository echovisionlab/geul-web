/**
 * Validator helper functions
 */

import { fieldTypeRegistry } from '@/lib/form/fields/registry';
import { getPredicateMetadata, type PredicateMetadata } from '@/lib/form/predicates';
import type { FieldType } from '@/lib/types/form/model';
import type { FieldValidator } from '@/lib/types/form/schema';

/**
 * Get display label for a validator
 */
export function getValidatorLabel(validator: FieldValidator, getLabel?: (predicateName: string) => string): string {
  const definition = getPredicateMetadata(validator.predicate);
  const baseLabel = getLabel?.(validator.predicate) || validator.name || definition?.label || validator.predicate;

  // For comparison operators, show the value
  if (['gt', 'gte', 'lt', 'lte', 'eq'].includes(validator.predicate) && validator.value !== undefined) {
    return `${baseLabel} ${validator.value}`;
  }
  if (validator.predicate === 'regex' && validator.value) {
    return `${baseLabel}: ${validator.value}`;
  }
  return baseLabel;
}

/**
 * Get available predicates for a field type, excluding already-used ones
 */
export function getAvailablePredicates(
  fieldType: FieldType,
  existingValidators: FieldValidator[],
): PredicateMetadata[] {
  const existingPredicates = new Set(existingValidators.map((v) => v.predicate));
  // Comparison operators can coexist (e.g., gte + lte for range)
  const comparisonOps = new Set(['gt', 'gte', 'lt', 'lte', 'eq']);

  // Get validators from field type registry (single source of truth)
  const allowedValidators = fieldTypeRegistry.getValidators(fieldType);

  return allowedValidators
    .map((name) => getPredicateMetadata(name))
    .filter((def): def is PredicateMetadata => {
      if (!def) {
        return false;
      }
      // Comparison operators can coexist
      if (comparisonOps.has(def.name)) {
        return true;
      }
      // Other validators can't be duplicated
      return !existingPredicates.has(def.name);
    });
}

/**
 * Create a new validator with sensible defaults
 */
export function createValidator(predicateName: string): FieldValidator {
  const definition = getPredicateMetadata(predicateName);
  const validator: FieldValidator = {
    id: crypto.randomUUID(),
    name: definition?.label ?? predicateName,
    predicate: predicateName,
    value: undefined,
    message: undefined,
  };

  // Set default value for predicates that require it
  if (['gt', 'gte', 'lt', 'lte', 'eq'].includes(predicateName)) {
    validator.value = 1;
  } else if (predicateName === 'regex') {
    validator.value = '';
  } else if (['minDate', 'maxDate'].includes(predicateName)) {
    // Default to today's date
    validator.value = new Date().toISOString().split('T')[0];
  } else if (['minAge', 'maxAge'].includes(predicateName)) {
    validator.value = predicateName === 'minAge' ? 18 : 100;
  }

  return validator;
}

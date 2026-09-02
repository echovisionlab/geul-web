/**
 * Multiselect field type definition
 */

import type { FieldTypeDefinition } from '@/lib/types/form/model';
import { ARRAY_CONDITION_OPS } from './constants';
import { fieldTypeRegistry } from './core';

const definition: FieldTypeDefinition = {
  type: 'multiselect',
  label: 'Multi Select',
  validators: ['required', 'gt', 'gte', 'lt', 'lte', 'eq'],
  conditionOperators: ARRAY_CONDITION_OPS,
  conditionValueType: 'multiselect',
};

fieldTypeRegistry.register(definition);

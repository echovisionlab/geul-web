/**
 * Number field type definition
 */

import type { FieldTypeDefinition } from '@/lib/types/form/model';
import { COMPARISON_CONDITION_OPS } from './constants';
import { fieldTypeRegistry } from './core';

const definition: FieldTypeDefinition = {
  type: 'number',
  label: 'Number',
  validators: ['required', 'gt', 'gte', 'lt', 'lte', 'eq'],
  conditionOperators: COMPARISON_CONDITION_OPS,
  conditionValueType: 'number',
};

fieldTypeRegistry.register(definition);

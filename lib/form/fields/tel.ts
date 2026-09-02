/**
 * Phone (tel) field type definition
 */

import type { FieldTypeDefinition } from '@/lib/types/form/model';
import { TEXT_CONDITION_OPS } from './constants';
import { fieldTypeRegistry } from './core';

const definition: FieldTypeDefinition = {
  type: 'tel',
  label: 'Phone',
  validators: ['required', 'gt', 'gte', 'lt', 'lte', 'eq'],
  conditionOperators: TEXT_CONDITION_OPS,
  conditionValueType: 'text',
};

fieldTypeRegistry.register(definition);

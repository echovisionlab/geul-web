/**
 * Checkbox field type definition (single boolean for consent/agreement)
 */

import type { FieldTypeDefinition } from '@/lib/types/form/model';
import { BOOLEAN_CONDITION_OPS } from './constants';
import { fieldTypeRegistry } from './core';

const definition: FieldTypeDefinition = {
  type: 'checkbox',
  label: 'Checkbox',
  validators: ['required'],
  conditionOperators: BOOLEAN_CONDITION_OPS,
  conditionValueType: 'boolean',
};

fieldTypeRegistry.register(definition);

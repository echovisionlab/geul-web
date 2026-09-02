/**
 * Select field type definition
 */

import type { FieldTypeDefinition } from '@/lib/types/form/model';
import { TEXT_CONDITION_OPS } from './constants';
import { fieldTypeRegistry } from './core';

const definition: FieldTypeDefinition = {
  type: 'select',
  label: 'Select',
  validators: ['required'],
  conditionOperators: TEXT_CONDITION_OPS,
  conditionValueType: 'select',
};

fieldTypeRegistry.register(definition);

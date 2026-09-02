/**
 * Date field type definition
 */

import type { FieldTypeDefinition } from '@/lib/types/form/model';
import { COMPARISON_CONDITION_OPS } from './constants';
import { fieldTypeRegistry } from './core';

const definition: FieldTypeDefinition = {
  type: 'date',
  label: 'Date',
  validators: ['required', 'minDate', 'maxDate', 'futureDate', 'pastDate', 'weekdayOnly', 'minAge', 'maxAge'],
  conditionOperators: COMPARISON_CONDITION_OPS,
  conditionValueType: 'date',
};

fieldTypeRegistry.register(definition);

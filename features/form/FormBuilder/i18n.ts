import type { useTranslations } from 'next-intl';
import { getOperatorsForFieldType } from '@/lib/form/fields/registry';
import { FIELD_TYPES, type FieldType } from '@/lib/types/form/model';
import type { FormConditionOperator } from '@/lib/types/form/schema';

type BuilderTranslator = ReturnType<typeof useTranslations<'formAdmin.builder'>>;
type CommonLabelsTranslator = ReturnType<typeof useTranslations<'common.labels'>>;

export function getLocalizedFieldTypeOptions(t: BuilderTranslator, tCommonLabels: CommonLabelsTranslator) {
  return FIELD_TYPES.map(({ value }) => ({
    value,
    label: getLocalizedFieldTypeLabel(t, value, tCommonLabels),
  }));
}

export function getLocalizedFieldTypeLabel(
  t: BuilderTranslator,
  fieldType: FieldType,
  tCommonLabels: CommonLabelsTranslator,
) {
  if (fieldType === 'email') {
    return tCommonLabels('email');
  }
  if (fieldType === 'text') {
    return tCommonLabels('text');
  }
  switch (fieldType) {
    case 'textarea':
      return t('fieldTypes.textarea');
    case 'tel':
      return t('fieldTypes.tel');
    case 'number':
      return t('fieldTypes.number');
    case 'date':
      return t('fieldTypes.date');
    case 'select':
      return t('fieldTypes.select');
    case 'multiselect':
      return t('fieldTypes.multiselect');
    case 'checkbox':
      return t('fieldTypes.checkbox');
    case 'switch':
      return t('fieldTypes.switch');
  }
}

export function getLocalizedPredicateLabel(
  t: BuilderTranslator,
  predicateName: string,
  tCommonLabels?: CommonLabelsTranslator,
) {
  if (predicateName === 'required' && tCommonLabels) {
    return tCommonLabels('required');
  }
  if (predicateName === 'email' && tCommonLabels) {
    return tCommonLabels('email');
  }
  switch (predicateName) {
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
    case 'eq':
    case 'url':
    case 'regex':
    case 'minDate':
    case 'maxDate':
    case 'futureDate':
    case 'pastDate':
    case 'weekdayOnly':
    case 'minAge':
    case 'maxAge':
      return t(`predicates.${predicateName}`);
    default:
      return predicateName;
  }
}

function getLocalizedOperatorLabel(t: BuilderTranslator, operator: FormConditionOperator) {
  return t(`operators.${operator}`);
}

export function getLocalizedOperatorOptions(t: BuilderTranslator, fieldType: FieldType | undefined) {
  return getOperatorsForFieldType(fieldType).map((operator) => ({
    value: operator.value,
    label: getLocalizedOperatorLabel(t, operator.value),
  }));
}

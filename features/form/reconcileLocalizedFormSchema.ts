'use client';

import type {
  FieldValidator,
  FormFieldOption,
  FormFieldSchema,
  FormFieldSchemaCheckbox,
  FormFieldSchemaMultiSelect,
  FormFieldSchemaSelect,
  FormSchema,
  FormStepSchema,
} from '@/lib/types/form/schema';

function preferLocalizedText(sourceValue: string | undefined, localizedValue: string | undefined): string | undefined {
  if (typeof localizedValue === 'string' && localizedValue.trim() !== '') {
    return localizedValue;
  }
  return sourceValue;
}

function reconcileOptions(
  sourceOptions: FormFieldOption[] | undefined,
  localizedOptions: FormFieldOption[] | undefined,
): FormFieldOption[] | undefined {
  if (!sourceOptions) {
    return undefined;
  }
  if (!localizedOptions || localizedOptions.length === 0) {
    return sourceOptions;
  }

  const localizedById = new Map(
    localizedOptions
      .filter((option) => typeof option.id === 'string' && option.id.trim() !== '')
      .map((option) => [option.id as string, option]),
  );
  const localizedByValue = new Map(localizedOptions.map((option) => [option.value, option] as const));

  return sourceOptions.map((option) => {
    const localized = (option.id ? localizedById.get(option.id) : undefined) ?? localizedByValue.get(option.value);
    if (!localized) {
      return option;
    }

    return {
      ...option,
      label: preferLocalizedText(option.label, localized.label) ?? option.label,
    };
  });
}

function reconcileValidators(
  sourceValidators: FieldValidator[] | undefined,
  localizedValidators: FieldValidator[] | undefined,
): FieldValidator[] | undefined {
  if (!sourceValidators) {
    return undefined;
  }
  if (!localizedValidators || localizedValidators.length === 0) {
    return sourceValidators;
  }

  const localizedById = new Map(
    localizedValidators
      .filter((validator) => typeof validator.id === 'string' && validator.id.trim() !== '')
      .map((validator) => [validator.id, validator]),
  );

  return sourceValidators.map((validator) => {
    const localized = localizedById.get(validator.id);
    if (!localized) {
      return validator;
    }

    return {
      ...validator,
      message: preferLocalizedText(validator.message, localized.message),
    };
  });
}

function reconcileField(sourceField: FormFieldSchema, localizedField: FormFieldSchema | undefined): FormFieldSchema {
  if (!localizedField) {
    return sourceField;
  }

  const nextField: FormFieldSchema = {
    ...sourceField,
    label: preferLocalizedText(sourceField.label, localizedField.label),
    description: preferLocalizedText(sourceField.description, localizedField.description),
    placeholder: preferLocalizedText(sourceField.placeholder, localizedField.placeholder),
  };

  if (sourceField.type === 'checkbox') {
    const localizedCheckboxLabel = localizedField?.type === 'checkbox' ? localizedField.checkboxLabel : undefined;
    (nextField as FormFieldSchemaCheckbox).checkboxLabel = preferLocalizedText(
      sourceField.checkboxLabel,
      localizedCheckboxLabel,
    );
  }

  if (sourceField.type === 'select' || sourceField.type === 'multiselect') {
    const localizedOptions = localizedField?.type === sourceField.type ? localizedField.options : undefined;
    if (sourceField.type === 'select') {
      (nextField as FormFieldSchemaSelect).options =
        reconcileOptions(sourceField.options, localizedOptions) ?? sourceField.options;
    } else {
      (nextField as FormFieldSchemaMultiSelect).options =
        reconcileOptions(sourceField.options, localizedOptions) ?? sourceField.options;
    }
  }

  if (sourceField.validation) {
    const localizedValidators = localizedField.validation?.validators;
    nextField.validation = {
      ...sourceField.validation,
      validators:
        reconcileValidators(sourceField.validation.validators, localizedValidators) ??
        sourceField.validation.validators,
    };
  }

  return nextField;
}

function reconcileStep(sourceStep: FormStepSchema, localizedStep: FormStepSchema | undefined): FormStepSchema {
  if (!localizedStep) {
    return sourceStep;
  }

  const localizedFieldsById = new Map((localizedStep.fields ?? []).map((field) => [field.id, field] as const));

  return {
    ...sourceStep,
    title: preferLocalizedText(sourceStep.title, localizedStep.title),
    description: preferLocalizedText(sourceStep.description, localizedStep.description),
    fields: (sourceStep.fields ?? []).map((field) => reconcileField(field, localizedFieldsById.get(field.id))),
  };
}

export function reconcileLocalizedFormSchema(
  sourceSchema: FormSchema | undefined,
  localizedSchema: FormSchema | undefined,
): FormSchema | undefined {
  if (!sourceSchema) {
    return localizedSchema;
  }
  if (!localizedSchema) {
    return sourceSchema;
  }

  const localizedStepsById = new Map((localizedSchema.steps ?? []).map((step) => [step.id, step] as const));

  return {
    ...sourceSchema,
    steps: (sourceSchema.steps ?? []).map((step) => reconcileStep(step, localizedStepsById.get(step.id))),
  };
}

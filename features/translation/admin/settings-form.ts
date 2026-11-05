export interface FormState {
  defaultLocale: string;
}

type SettingsUpdatePath = 'default_locale';

export interface SettingsUpdateMutation {
  form: FormState;
  paths: SettingsUpdatePath[];
}

export function settingsFormsEqual(left: FormState, right: FormState): boolean {
  return left.defaultLocale === right.defaultLocale;
}

export function mergeRefreshedSettingsForm(
  local: FormState,
  baseline: FormState | null,
  incoming: FormState,
): FormState {
  if (!baseline) {
    return incoming;
  }
  return {
    defaultLocale: incoming.defaultLocale !== baseline.defaultLocale ? incoming.defaultLocale : local.defaultLocale,
  };
}

export function preserveSettingsEditsMadeDuringSave(
  current: FormState,
  submitted: FormState,
  saved: FormState,
): FormState {
  return {
    defaultLocale: current.defaultLocale === submitted.defaultLocale ? saved.defaultLocale : current.defaultLocale,
  };
}

export function buildSettingsUpdateMutation(baseline: FormState, form: FormState): SettingsUpdateMutation | null {
  return baseline.defaultLocale !== form.defaultLocale ? { form, paths: ['default_locale'] } : null;
}

export function toUpdateSettingsRequest(mutation: SettingsUpdateMutation) {
  return {
    settings: { defaultLocale: mutation.form.defaultLocale },
    updateMask: { paths: mutation.paths },
  };
}

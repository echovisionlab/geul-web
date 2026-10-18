import { normalizeProtectedTerms } from '@/lib/translation/protected-terms';

export interface FormState {
  defaultLocale: string;
  protectedTerms: string[];
}

type SettingsUpdatePath = 'default_locale' | 'protected_terms';

export interface SettingsUpdateMutation {
  form: FormState;
  baseline: FormState;
  paths: SettingsUpdatePath[];
}

export function canonicalizeSettingsForm(form: FormState): FormState {
  return {
    defaultLocale: form.defaultLocale,
    protectedTerms: normalizeProtectedTerms(form.protectedTerms),
  };
}

export function settingsFormsEqual(left: FormState, right: FormState): boolean {
  return left.defaultLocale === right.defaultLocale && protectedTermsEqual(left.protectedTerms, right.protectedTerms);
}

function protectedTermsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((term, index) => term === right[index]);
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
    protectedTerms: protectedTermsEqual(incoming.protectedTerms, baseline.protectedTerms)
      ? local.protectedTerms
      : incoming.protectedTerms,
  };
}

export function preserveSettingsEditsMadeDuringSave(
  current: FormState,
  submitted: FormState,
  saved: FormState,
): FormState {
  return {
    defaultLocale: current.defaultLocale === submitted.defaultLocale ? saved.defaultLocale : current.defaultLocale,
    protectedTerms: protectedTermsEqual(current.protectedTerms, submitted.protectedTerms)
      ? saved.protectedTerms
      : current.protectedTerms,
  };
}

export function buildSettingsUpdateMutation(baseline: FormState, form: FormState): SettingsUpdateMutation | null {
  const paths: SettingsUpdatePath[] = [];
  if (baseline.defaultLocale !== form.defaultLocale) {
    paths.push('default_locale');
  }
  if (!protectedTermsEqual(baseline.protectedTerms, form.protectedTerms)) {
    paths.push('protected_terms');
  }
  return paths.length > 0 ? { form, baseline, paths } : null;
}

export function toUpdateSettingsRequest(mutation: SettingsUpdateMutation) {
  return {
    settings: {
      defaultLocale: mutation.paths.includes('default_locale') ? mutation.form.defaultLocale : '',
      protectedTerms: mutation.paths.includes('protected_terms') ? mutation.form.protectedTerms : [],
    },
    updateMask: { paths: mutation.paths },
    baseSettings: {
      defaultLocale: mutation.baseline.defaultLocale,
      protectedTerms: mutation.baseline.protectedTerms,
    },
  };
}

'use server';

import { checkFormAccessAction, type PublicFormData } from '@/lib/actions/form';

export interface FormShareAccessState {
  form?: PublicFormData;
  granted?: boolean;
  error?: 'incorrect_password';
}

export async function accessFormShareAction(
  _previousState: FormShareAccessState,
  formData: FormData,
): Promise<FormShareAccessState> {
  const token = String(formData.get('token') ?? '').trim();
  const idOrSlug = String(formData.get('idOrSlug') ?? '').trim();
  const requestedLocale = String(formData.get('requestedLocale') ?? '').trim() || 'en';
  const password = String(formData.get('password') ?? '');
  const target = String(formData.get('target') ?? '') === 'dashboard' ? 'dashboard' : 'form';
  if (!token || !idOrSlug || !password) {
    return { error: 'incorrect_password' };
  }

  const access = await checkFormAccessAction({
    slug: idOrSlug,
    context: 'url',
    target,
    shareToken: token,
    sharePassword: password,
    requestedLocale,
  });
  if (!access.accessible) {
    return { error: 'incorrect_password' };
  }
  if (target === 'dashboard') {
    return { granted: true };
  }
  return access.form ? { form: access.form } : { error: 'incorrect_password' };
}

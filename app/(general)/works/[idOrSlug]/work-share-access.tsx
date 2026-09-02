'use server';

import type { ReactNode } from 'react';
import { WorkContentWithToken } from './WorkContentWithToken';

export interface WorkShareAccessState {
  content?: ReactNode;
  error?: 'incorrect_password';
}

export async function accessWorkShareAction(
  _previousState: WorkShareAccessState,
  formData: FormData,
): Promise<WorkShareAccessState> {
  const token = String(formData.get('token') ?? '').trim();
  const idOrSlug = String(formData.get('idOrSlug') ?? '').trim();
  const locale = String(formData.get('locale') ?? '').trim() || 'en';
  const requestedLocale = String(formData.get('requestedLocale') ?? '').trim() || locale;
  const password = String(formData.get('password') ?? '');
  if (!token || !idOrSlug || !password) {
    return { error: 'incorrect_password' };
  }

  try {
    return {
      content: await WorkContentWithToken({
        idOrSlug,
        token,
        password,
        requestedLocale,
        query: { share: token },
      }),
    };
  } catch {
    return { error: 'incorrect_password' };
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createMemberClient } from '@/lib/api/server-client';
import { LOCALE_COOKIE_NAME, normalizeLocale } from '@/lib/i18n/locale';
import { actionFailure, type ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';

export async function updatePreferredLocaleAction(
  preferredLocale: string,
): Promise<ActionResult<{ success: true; preferred_locale: string }>> {
  const normalizedLocale = normalizeLocale(preferredLocale);
  if (!normalizedLocale) {
    return actionFailure('Unsupported language', 'ACTION_INVALID_LOCALE');
  }

  return runAction(
    'user-preference-actions',
    'updatePreferredLocaleAction',
    async () => {
      const memberClient = await createMemberClient();
      const response = await memberClient.updateMyPreferences({
        preferredLocale: normalizedLocale,
      });
      const savedLocale = response.settings?.preferredLocale ?? normalizedLocale;

      const cookieStore = await cookies();
      cookieStore.set(LOCALE_COOKIE_NAME, savedLocale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      });

      revalidatePath('/my/settings');
      revalidatePath('/', 'layout');

      return {
        success: true as const,
        preferred_locale: savedLocale,
      };
    },
    { fallback: 'Failed to update language preference' },
  );
}

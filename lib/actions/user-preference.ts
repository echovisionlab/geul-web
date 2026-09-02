'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createMemberClient } from '@/lib/api/server-client';
import { LOCALE_COOKIE_NAME, normalizeLocale } from '@/lib/i18n/locale';

export async function updatePreferredLocaleAction(
  preferredLocale: string,
): Promise<{ success?: boolean; preferred_locale?: string; error?: string }> {
  const normalizedLocale = normalizeLocale(preferredLocale);
  if (!normalizedLocale) {
    return { error: 'Unsupported language' };
  }

  try {
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
      success: true,
      preferred_locale: savedLocale,
    };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update language preference' };
  }
}

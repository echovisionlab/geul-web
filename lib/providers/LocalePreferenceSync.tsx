'use client';

import { startTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth/client';
import { normalizeLocale } from '@/lib/i18n/locale';
import { readLocaleCookie, writeLocaleCookie } from '@/lib/i18n/locale-cookie';
import { useLocale } from '@/lib/providers/LocaleProvider';

export function LocalePreferenceSync() {
  const router = useRouter();
  const locale = useLocale();
  const { data: session, isPending } = useSession();
  const hasReloaded = useRef(false);

  useEffect(() => {
    if (isPending) {
      return;
    }

    const preferredLocale = normalizeLocale(session?.user?.preferred_locale);
    if (!preferredLocale) {
      return;
    }

    const cookieLocale = readLocaleCookie(document.cookie);
    if (cookieLocale !== preferredLocale) {
      writeLocaleCookie(preferredLocale);
    }

    if (locale !== preferredLocale && !hasReloaded.current) {
      hasReloaded.current = true;
      startTransition(() => {
        router.refresh();
      });
    }
  }, [isPending, locale, router, session?.user?.preferred_locale]);

  return null;
}

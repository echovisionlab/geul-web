import messages from '@/lib/i18n/error-page-messages.json';
import { DEFAULT_LOCALE, type SupportedLocale } from '@/lib/i18n/locale';
import type { ErrorPageMessages } from './error-status';

/**
 * Every locale's error copy for app/global-error.tsx, which replaces the root layout and therefore
 * renders without its message provider. Import it only from that root fallback (one shared chunk);
 * other error surfaces read the active locale through `useErrorPageMessages`.
 */
export function getFallbackErrorPageMessages(locale: SupportedLocale = DEFAULT_LOCALE): ErrorPageMessages {
  return messages[locale];
}

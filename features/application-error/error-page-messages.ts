'use client';

import { useMessages } from 'next-intl';
import type { ErrorPageMessages } from './error-status';

/**
 * The active locale's error copy from the root layout's client catalogue (`errorPage` namespace).
 * It arrives as RSC data with the layout, so in-layout error boundaries render it even when a
 * JavaScript chunk fails to load, without shipping every locale in each boundary chunk.
 */
export function useErrorPageMessages(): ErrorPageMessages {
  const messages = useMessages();
  if (!messages.errorPage) {
    // Escalates to app/global-error.tsx, which carries the provider-free all-locale fallback.
    throw new Error('The client message catalogue is missing the errorPage namespace.');
  }
  return messages.errorPage;
}

'use client';

import type { SupportedLocale } from '@/lib/i18n/locale';
import type { ErrorPageAction } from '@/components/core/ErrorPage/ErrorPageView';
import { ErrorPageView } from './ErrorPageView';
import { canRetryErrorStatus, getErrorPageContent } from './error-status';

export interface ApplicationErrorPageProps {
  status: number;
  locale?: SupportedLocale;
  homeHref?: string;
  onRetry?: () => void;
  fullScreen?: boolean;
}

export function ApplicationErrorPage({
  status,
  locale,
  homeHref = '/',
  onRetry,
  fullScreen,
}: ApplicationErrorPageProps) {
  const content = getErrorPageContent(status, locale);
  const actions: ErrorPageAction[] = [];
  if (status === 401) {
    actions.push({ label: content.login, href: '/login' });
  } else if (onRetry && canRetryErrorStatus(status)) {
    actions.push({ label: content.tryAgain, onClick: onRetry });
  }
  actions.push({ label: content.goHome, href: homeHref });
  return <ErrorPageView code={content.code} title={content.title} actions={actions} fullScreen={fullScreen} />;
}

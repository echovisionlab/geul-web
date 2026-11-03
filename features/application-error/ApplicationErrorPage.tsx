'use client';

import type { ErrorPageAction } from '@/components/core/ErrorPage/ErrorPageView';
import { ErrorPageView } from './ErrorPageView';
import { useErrorPageMessages } from './error-page-messages';
import { canRetryErrorStatus, getErrorPageContent, type ErrorPageMessages } from './error-status';

export interface ApplicationErrorPageProps {
  status: number;
  homeHref?: string;
  onRetry?: () => void | Promise<unknown>;
  fullScreen?: boolean;
}

export interface ApplicationErrorPageViewProps extends ApplicationErrorPageProps {
  messages: ErrorPageMessages;
}

/** Error surface with explicit copy, for the provider-free root fallback. */
export function ApplicationErrorPageView({
  status,
  messages,
  homeHref = '/',
  onRetry,
  fullScreen,
}: ApplicationErrorPageViewProps) {
  const content = getErrorPageContent(status, messages);
  const actions: ErrorPageAction[] = [];
  if (status === 401) {
    actions.push({ label: content.login, href: '/login' });
  } else if (onRetry && canRetryErrorStatus(status)) {
    actions.push({ label: content.tryAgain, onClick: onRetry });
  }
  actions.push({ label: content.goHome, href: homeHref });
  return <ErrorPageView code={content.code} title={content.title} actions={actions} fullScreen={fullScreen} />;
}

/** Error surface inside the root layout, in the active locale of its message catalogue. */
export function ApplicationErrorPage(props: ApplicationErrorPageProps) {
  return <ApplicationErrorPageView {...props} messages={useErrorPageMessages()} />;
}

'use client';

import { useLocale } from 'next-intl';
import { Group } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import Link from '@/components/core/Navigation';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { canRetryErrorStatus, getErrorPageContent, resolveErrorStatus } from './error-status';

interface QueryFailure {
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}

/** Keep query failures visible without unmounting an editor or clearing its fields. */
export function QueryErrorAlert({ queries }: { queries: readonly QueryFailure[] }) {
  const failed = queries.filter((query) => query.isError);
  if (failed.length === 0) {
    return null;
  }
  return <QueryErrorAlertContent failed={failed} />;
}

function QueryErrorAlertContent({ failed }: { failed: readonly QueryFailure[] }) {
  const locale = normalizeLocale(useLocale()) ?? DEFAULT_LOCALE;
  const status = resolveErrorStatus(failed[0].error);
  const content = getErrorPageContent(status, locale);
  return (
    <Alert tone="danger" role="alert" title={`${status} · ${content.title}`}>
      <Group gap="sm">
        {status === 401 ? <Link href="/login">{content.login}</Link> : null}
        {failed.some((query) => canRetryErrorStatus(resolveErrorStatus(query.error))) ? (
          <Button
            emphasis="medium"
            size="sm"
            loading={failed.some((query) => query.isFetching)}
            onClick={() => void Promise.allSettled(failed.map((query) => query.refetch()))}
          >
            {content.tryAgain}
          </Button>
        ) : null}
      </Group>
    </Alert>
  );
}

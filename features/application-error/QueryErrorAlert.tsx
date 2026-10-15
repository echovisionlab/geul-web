'use client';

import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import Link from '@/components/core/Navigation';
import { useErrorPageMessages } from './error-page-messages';
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
  const messages = useErrorPageMessages();
  const status = resolveErrorStatus(failed[0].error);
  const content = getErrorPageContent(status, messages);
  return (
    <Alert tone="danger" role="alert" title={`${status} · ${content.title}`}>
      <DsLayoutInline gap="sm">
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
      </DsLayoutInline>
    </Alert>
  );
}

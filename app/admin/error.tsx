'use client';

import { useEffect } from 'react';
import { ApplicationErrorPage } from '@/features/application-error/ApplicationErrorPage';
import { resolveErrorStatus } from '@/features/application-error/error-status';
import { reportClientRenderFailure } from '@/lib/observability/client-render-failure';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: Props) {
  useEffect(() => {
    reportClientRenderFailure('admin', error);
  }, [error]);
  return <ApplicationErrorPage status={resolveErrorStatus(error)} homeHref="/admin" onRetry={reset} />;
}

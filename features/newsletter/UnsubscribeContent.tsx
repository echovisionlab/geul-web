'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageLoader } from '@/features/site/PageLoader';
import { unsubscribeNewsletterAction } from '@/lib/actions/newsletter';
import { UnsubscribeView, type UnsubscribeViewStatus } from './UnsubscribeView';

export function UnsubscribeContent({
  token: tokenOverride,
  unsubscribeAction = unsubscribeNewsletterAction,
}: { token?: string | null; unsubscribeAction?: typeof unsubscribeNewsletterAction } = {}) {
  const searchParams = useSearchParams();
  const token = tokenOverride === undefined ? searchParams.get('token') : tokenOverride;
  const [result, setResult] = useState<{ token: string; status: UnsubscribeViewStatus } | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let active = true;
    void unsubscribeAction(token).then(
      (data) => {
        if (active) {
          setResult({ token, status: data.success ? 'success' : 'error' });
        }
      },
      () => {
        if (active) {
          setResult({ token, status: 'error' });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [unsubscribeAction, token]);

  if (!token) {
    return <UnsubscribeView status="missing-token" />;
  }
  return result?.token === token ? <UnsubscribeView status={result.status} /> : <PageLoader />;
}

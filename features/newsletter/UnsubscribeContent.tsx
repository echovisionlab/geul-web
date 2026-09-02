'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { PageLoader } from '@/features/site/PageLoader';
import { unsubscribeNewsletterAction } from '@/lib/actions/newsletter';
import { UnsubscribeView, type UnsubscribeViewStatus } from './UnsubscribeView';

export function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | UnsubscribeViewStatus>('loading');

  const { mutate: requestUnsubscribe } = useMutation({
    mutationFn: (data: { token: string }) => unsubscribeNewsletterAction(data.token),
    onSuccess: (data) => setStatus(data.success ? 'success' : 'error'),
    onError: () => setStatus('error'),
  });

  useEffect(() => {
    if (!token) {
      setStatus('missing-token');
      return;
    }
    requestUnsubscribe({ token });
  }, [requestUnsubscribe, token]);

  return status === 'loading' ? <PageLoader /> : <UnsubscribeView status={status} />;
}

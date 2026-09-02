'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/auth/client';
import { LoginController } from './LoginController';
import { resolveDirectNewsletterEntry } from './login-redirect';
import { createUnifiedLoginTransport, type UnifiedLoginTransport } from './unified-login-transport';
import type { LoginNavigation } from './use-login-continuation';

export function LoginContent({ transport }: { transport?: UnifiedLoginTransport } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();
  const flowId = searchParams.get('flow');
  const resolvedTransport = useMemo(() => transport ?? createUnifiedLoginTransport(), [transport]);
  const navigation = useMemo<LoginNavigation>(
    () => ({
      assign: (url) => {
        window.location.href = url;
      },
      origin: typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
      replace: (url) => router.replace(url),
    }),
    [router],
  );
  const directNewsletterEntry = flowId
    ? null
    : resolveDirectNewsletterEntry(searchParams.toString(), navigation.origin);

  return (
    <LoginController
      errorParam={searchParams.get('error')}
      flowId={flowId}
      hasSession={Boolean(session)}
      initialEmail={searchParams.get('email') ?? ''}
      isSessionPending={isPending}
      newsletterIntent={directNewsletterEntry !== null}
      navigation={navigation}
      redirectUrl={directNewsletterEntry?.redirectUrl ?? searchParams.get('redirect') ?? '/'}
      transport={resolvedTransport}
    />
  );
}

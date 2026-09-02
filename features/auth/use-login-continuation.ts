import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KratosBrowserFlow } from './kratos-flow';
import {
  buildNewsletterAuthContinuation,
  clearNewsletterAuthContinuation,
  consumeAuthRedirect,
  rememberAuthRedirect,
  rememberNewsletterAuthContinuation,
  resolveAuthFlowContinuation,
  resolveLoginSuccessRedirect,
  resolveNewsletterAuthContinuation,
  resolveSameOriginLoginReturnTo,
} from './login-redirect';
import type { UnifiedLoginTransport } from './unified-login-transport';

export interface LoginNavigation {
  assign: (url: string) => void;
  origin: string;
  replace: (url: string) => void;
}

export type NewsletterIntentStatus = 'idle' | 'ready' | 'applying' | 'failed' | 'complete';

interface UseLoginContinuationOptions {
  applyNewsletterSubscription: () => Promise<{ success: boolean }>;
  flowId: string | null;
  flowReturnTo?: string;
  hasSession: boolean;
  isSessionPending: boolean;
  navigation: LoginNavigation;
  newsletterIntent: boolean;
  redirectUrl: string;
  transport: UnifiedLoginTransport;
}

export function useLoginContinuation({
  applyNewsletterSubscription,
  flowId,
  flowReturnTo,
  hasSession,
  isSessionPending,
  navigation,
  newsletterIntent,
  redirectUrl,
  transport,
}: UseLoginContinuationOptions) {
  const [newsletterIntentStatus, setNewsletterIntentStatus] = useState<NewsletterIntentStatus>('idle');
  const consumedRedirectRef = useRef<string | null | undefined>(undefined);
  const newsletterContinuation = useMemo(
    () => resolveNewsletterAuthContinuation(flowReturnTo, navigation.origin),
    [flowReturnTo, navigation.origin],
  );
  const directNewsletterIntent = !flowId && newsletterIntent;
  const handlesNewsletterIntent = directNewsletterIntent || newsletterContinuation !== null;

  useEffect(() => {
    if (handlesNewsletterIntent && hasSession && !isSessionPending && newsletterIntentStatus === 'idle') {
      setNewsletterIntentStatus('ready');
    }
  }, [handlesNewsletterIntent, hasSession, isSessionPending, newsletterIntentStatus]);

  const consumeStoredRedirect = useCallback(() => {
    if (consumedRedirectRef.current === undefined) {
      consumedRedirectRef.current = consumeAuthRedirect();
    }
    return consumedRedirectRef.current;
  }, []);

  const continuation = useCallback(
    (returnTo?: string | null) =>
      resolveAuthFlowContinuation({
        flowReturnTo: returnTo,
        redirectUrl,
        origin: navigation.origin,
      }),
    [navigation.origin, redirectUrl],
  );

  const browserUrl = useCallback(
    (returnTo?: string | null, rememberRedirect = false) => {
      const finalReturnTo = continuation(returnTo);
      const verifiedNewsletterContinuation = resolveNewsletterAuthContinuation(returnTo, navigation.origin);
      const resolvedReturnTo =
        directNewsletterIntent || verifiedNewsletterContinuation
          ? buildNewsletterAuthContinuation(
              verifiedNewsletterContinuation?.redirectUrl ?? finalReturnTo,
              navigation.origin,
            )
          : finalReturnTo;
      if (rememberRedirect) {
        rememberAuthRedirect(finalReturnTo);
        if (directNewsletterIntent || verifiedNewsletterContinuation) {
          rememberNewsletterAuthContinuation(resolvedReturnTo, navigation.origin);
        } else {
          clearNewsletterAuthContinuation();
        }
      }
      return transport.browserUrl(
        resolvedReturnTo.startsWith('/')
          ? resolveSameOriginLoginReturnTo(resolvedReturnTo, navigation.origin)
          : resolvedReturnTo,
      );
    },
    [continuation, directNewsletterIntent, navigation.origin, transport],
  );

  const applyNewsletterIntent = useCallback(async (): Promise<void> => {
    if (!handlesNewsletterIntent) {
      return;
    }
    setNewsletterIntentStatus('applying');
    let result: { success: boolean };
    try {
      result = await applyNewsletterSubscription();
    } catch {
      setNewsletterIntentStatus('failed');
      return;
    }
    if (!result.success) {
      setNewsletterIntentStatus('failed');
      return;
    }
    setNewsletterIntentStatus('complete');
    consumeStoredRedirect();
    clearNewsletterAuthContinuation();
    const finalRedirect = resolveLoginSuccessRedirect({
      storedRedirect: null,
      flowReturnTo: null,
      redirectUrl: newsletterContinuation?.redirectUrl ?? redirectUrl,
      origin: navigation.origin,
    });
    if (/^https?:\/\//i.test(finalRedirect)) {
      navigation.assign(finalRedirect);
    } else {
      navigation.replace(finalRedirect);
    }
  }, [
    applyNewsletterSubscription,
    consumeStoredRedirect,
    handlesNewsletterIntent,
    navigation,
    newsletterContinuation?.redirectUrl,
    redirectUrl,
  ]);

  const redirectAfterSuccess = useCallback(
    async (successfulFlow: KratosBrowserFlow) => {
      const successfulNewsletterContinuation = resolveNewsletterAuthContinuation(
        successfulFlow.return_to,
        navigation.origin,
      );
      if (directNewsletterIntent || successfulNewsletterContinuation) {
        if (successfulNewsletterContinuation) {
          rememberNewsletterAuthContinuation(
            buildNewsletterAuthContinuation(successfulNewsletterContinuation.redirectUrl, navigation.origin),
            navigation.origin,
            successfulFlow.id,
          );
        }
        setNewsletterIntentStatus('ready');
        return;
      }
      clearNewsletterAuthContinuation();
      navigation.assign(
        resolveLoginSuccessRedirect({
          storedRedirect: consumeStoredRedirect(),
          flowReturnTo: successfulFlow.return_to,
          redirectUrl,
          origin: navigation.origin,
        }),
      );
    },
    [consumeStoredRedirect, directNewsletterIntent, navigation, redirectUrl],
  );

  return {
    applyNewsletterIntent,
    browserUrl,
    consumeStoredRedirect,
    handlesNewsletterIntent,
    newsletterContinuation,
    newsletterIntentStatus,
    redirectAfterSuccess,
  };
}

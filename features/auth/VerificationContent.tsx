'use client';
import { LayoutInset as DsLayoutInset, LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { PageLoader } from '@/features/site/PageLoader';
import { requestEmailChangeAction } from '@/lib/actions/email';
import { useSession } from '@/lib/auth/client';
import {
  beginCanonicalEmailVerification,
  getReplacementVerificationFlowId,
  observeCanonicalEmailChange,
  restartCanonicalEmailVerification,
} from './canonical-email-verification';
import { startPrivilegedReauthentication } from './login-redirect';
import {
  EMAIL_VERIFICATION_CONTINUATION_PARAM,
  consumeEmailVerificationContinuation,
  emailVerificationReauthenticationReturnTo,
  rememberEmailVerificationContinuation,
} from './security-reauthentication';
import { VerificationFlowView, type VerificationViewState } from './ui/VerificationFlowView';
import { useAuthCodeTiming } from './use-auth-code-timing';
import { getVerificationNodeValue, hasVerificationFlowError, type VerificationFlow } from './verification-flow';
import { loadVerificationFlow, resendVerificationCode, submitVerificationCodeRequest } from './verification-transport';
function localizeEmailActionMessage(
  message: string,
  t: ReturnType<typeof useTranslations<'auth.verification'>>,
): string {
  const normalized = message.toLowerCase();
  const waitMatch = normalized.match(/wait\s+(\d+)\s+seconds?/);
  if (waitMatch?.[1]) {
    return t('errors.cooldown', { seconds: waitMatch[1] });
  }
  if (
    normalized.includes('same email') ||
    normalized.includes('already exists') ||
    normalized.includes('exists already')
  ) {
    return t('errors.alreadyExists');
  }
  if (
    normalized.includes('already the verified') ||
    normalized.includes('already verified') ||
    normalized.includes('already the current')
  ) {
    return t('errors.currentVerified');
  }
  if (normalized.includes('valid email')) {
    return t('errors.invalidEmail');
  }
  return t('errors.sendVerificationEmail');
}
export function VerificationContent() {
  const locale = useLocale();
  const t = useTranslations('auth.verification');
  const tAuthCommon = useTranslations('auth.common');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, refetchWithOutcome: refetchSession } = useSession();
  const subjectId = session?.user.id ?? '';
  const flowId = searchParams.get('flow');
  const mode = 'change' as const;
  const beginVerification = beginCanonicalEmailVerification;
  const restartVerification = restartCanonicalEmailVerification;
  const preflightVerification = requestEmailChangeAction;
  const verificationPath = '/verify';
  const verificationFlowPath = useCallback((id: string) => `/verify?flow=${encodeURIComponent(id)}`, []);
  const codeParam = searchParams.get('code');
  const submittedCodeParamRef = useRef<string | null>(null);
  const [flow, setFlow] = useState<VerificationFlow | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(codeParam ?? '');
  const [loading, setLoading] = useState(false);
  const [submittingCode, setSubmittingCode] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [checkingApplication, setCheckingApplication] = useState(false);
  const [application, setApplication] = useState<{
    targetEmail: string;
    state: 'applying' | 'unavailable';
  } | null>(null);
  const [emailApplied, setEmailApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const operationRef = useRef(0);
  const replacementNavigationRef = useRef<{ flowId: string | null } | null>(null);
  const isCurrentOperation = useCallback(
    (operation: number) => mountedRef.current && operationRef.current === operation,
    [],
  );
  const beginOperation = useCallback(() => {
    operationRef.current += 1;
    replacementNavigationRef.current = null;
    setLoading(false);
    setSubmittingCode(false);
    setRequestingCode(false);
    setCheckingApplication(false);
    return operationRef.current;
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
    };
  }, []);
  const {
    clearAcceptedDelivery,
    recordAcceptedDelivery,
    timing: codeTiming,
  } = useAuthCodeTiming({
    active: flow?.state === 'sent_email',
    flowExpiresAt: flow?.expires_at,
    flowId: flow?.id ?? flowId ?? 'pending',
    purpose: 'verification',
  });
  const reconcileEmailMutation = useCallback(
    async (targetEmail: string, operation: number) => {
      if (!isCurrentOperation(operation)) {
        return null;
      }
      setCheckingApplication(true);
      setError(null);
      try {
        const observation = await observeCanonicalEmailChange({ targetEmail });
        if (!isCurrentOperation(operation)) {
          return null;
        }
        switch (observation.kind) {
          case 'applied': {
            const refresh = await refetchSession();
            if (!isCurrentOperation(operation)) {
              return null;
            }
            if (
              refresh.kind !== 'refreshed' ||
              !refresh.data?.user.id ||
              refresh.data.user.email?.trim().toLowerCase() !== targetEmail.trim().toLowerCase()
            ) {
              setApplication({ targetEmail, state: 'unavailable' });
              setEmailApplied(false);
              return { kind: 'unavailable' } as const;
            }
            setApplication(null);
            setEmailApplied(true);
            setError(null);
            return observation;
          }
          case 'applying':
            setApplication({ targetEmail, state: 'applying' });
            setEmailApplied(false);
            setError(null);
            return observation;
          case 'proof_pending':
            setApplication(null);
            setEmailApplied(false);
            setFlow((current) => (current?.state === 'passed_challenge' ? null : current));
            setError(t('errors.submit'));
            return observation;
          case 'conflict':
            clearAcceptedDelivery();
            setApplication(null);
            setEmailApplied(false);
            setFlow(null);
            setCode('');
            setError(t('errors.alreadyExists'));
            replacementNavigationRef.current = { flowId: null };
            router.replace(verificationPath);
            return observation;
          case 'unavailable':
            setApplication({ targetEmail, state: 'unavailable' });
            setEmailApplied(false);
            return observation;
        }
      } catch {
        if (!isCurrentOperation(operation)) {
          return null;
        }
        setApplication({ targetEmail, state: 'unavailable' });
        setEmailApplied(false);
        return { kind: 'unavailable' } as const;
      } finally {
        if (isCurrentOperation(operation)) {
          setCheckingApplication(false);
        }
      }
    },
    [clearAcceptedDelivery, isCurrentOperation, refetchSession, router, t, verificationPath],
  );
  const reconcileEmailMutationRef = useRef(reconcileEmailMutation);
  useEffect(() => {
    reconcileEmailMutationRef.current = reconcileEmailMutation;
  }, [reconcileEmailMutation]);
  useEffect(() => {
    if (replacementNavigationRef.current?.flowId === flowId) {
      replacementNavigationRef.current = null;
      return;
    }
    replacementNavigationRef.current = null;
    const operation = beginOperation();
    submittedCodeParamRef.current = null;
    setApplication(null);
    setEmailApplied(false);
    setError(null);
    setFlow(null);
    if (!flowId) {
      return;
    }
    setLoading(true);
    loadVerificationFlow(flowId)
      .then((outcome) => {
        if (!isCurrentOperation(operation)) {
          return;
        }
        if (outcome.kind === 'rate-limited') {
          throw new Error(t('errors.cooldown', { seconds: outcome.retryAfterSeconds }));
        }
        if (outcome.kind !== 'continued') {
          throw new Error(t('errors.flowNotFound'));
        }
        const validatedFlow = outcome.flow;
        setError(null);
        setFlow(validatedFlow);
        const flowEmail = getVerificationNodeValue(validatedFlow, 'email');
        if (flowEmail) {
          setEmail(flowEmail);
          if (validatedFlow.state === 'passed_challenge') {
            void reconcileEmailMutationRef.current(flowEmail, operation);
          }
        }
      })
      .catch((err) => {
        if (isCurrentOperation(operation)) {
          setError(err instanceof Error ? err.message : t('errors.flowNotFound'));
        }
      })
      .finally(() => {
        if (isCurrentOperation(operation)) {
          setLoading(false);
        }
      });
  }, [beginOperation, flowId, isCurrentOperation, t]);
  const submitVerificationCode = async (verificationCode: string) => {
    const trimmedCode = verificationCode.trim();
    if (!flow || flow.id !== flowId || !trimmedCode || submittingCode) {
      return;
    }
    const operation = beginOperation();
    setSubmittingCode(true);
    setError(null);
    const targetEmail = getVerificationNodeValue(flow, 'email') || email;
    try {
      const result = await submitVerificationCodeRequest(flow, trimmedCode, locale);
      if (!isCurrentOperation(operation)) {
        return;
      }
      const nextFlow = result.flow;
      if (!result.ok || hasVerificationFlowError(nextFlow)) {
        setCheckingApplication(true);
        const replacementFlowId = getReplacementVerificationFlowId(result.payload);
        let replacementFlow: VerificationFlow | null = null;
        if (replacementFlowId) {
          const replacementOutcome = await loadVerificationFlow(replacementFlowId);
          if (!isCurrentOperation(operation)) {
            return;
          }
          replacementFlow = replacementOutcome.kind === 'continued' ? replacementOutcome.flow : null;
          if (replacementFlow) {
            clearAcceptedDelivery();
            setFlow(replacementFlow);
            const replacementEmail = getVerificationNodeValue(replacementFlow, 'email');
            if (replacementEmail) {
              setEmail(replacementEmail);
            }
            replacementNavigationRef.current = { flowId: replacementFlowId };
            router.replace(verificationFlowPath(replacementFlowId));
          }
        }
        if (!replacementFlow && nextFlow) {
          setFlow(nextFlow);
        }
        setCode('');
        const observation = await reconcileEmailMutation(targetEmail, operation);
        if (!isCurrentOperation(operation)) {
          return;
        }
        if (observation?.kind === 'proof_pending' && !replacementFlow && nextFlow?.state === 'passed_challenge') {
          setFlow(flow);
        }
      } else if (!nextFlow) {
        setCode('');
        setError(t('errors.submit'));
      } else {
        setFlow(nextFlow);
        if (nextFlow.state === 'passed_challenge') {
          clearAcceptedDelivery();
          const observation = await reconcileEmailMutation(targetEmail, operation);
          if (!isCurrentOperation(operation)) {
            return;
          }
          if (observation?.kind === 'proof_pending') {
            setFlow(flow);
            setCode('');
            setError(t('errors.submit'));
          }
        }
      }
    } catch {
      if (isCurrentOperation(operation)) {
        setCode('');
        setError(t('errors.submitRetry'));
      }
    } finally {
      if (isCurrentOperation(operation)) {
        setCheckingApplication(false);
        setSubmittingCode(false);
      }
    }
  };
  useEffect(() => {
    if (!flow || flow.id !== flowId || !codeParam || submittedCodeParamRef.current === codeParam) {
      return;
    }
    if (flow.state !== 'sent_email' && flow.state !== 'choose_method') {
      return;
    }
    submittedCodeParamRef.current = codeParam;
    setCode(codeParam);
    void submitVerificationCode(codeParam);
  }, [codeParam, flow, flowId]);
  const handleRequestVerificationCode = useCallback(
    async (targetEmail: string) => {
      const trimmedEmail = targetEmail.trim();
      if (!trimmedEmail) {
        setError(t('errors.emailRequired'));
        return;
      }
      const operation = beginOperation();
      setRequestingCode(true);
      setError(null);
      setApplication(null);
      setEmailApplied(false);
      try {
        const result = await beginVerification({
          newEmail: trimmedEmail,
          preflight: preflightVerification,
          locale,
        });
        if (!isCurrentOperation(operation)) {
          return;
        }
        switch (result.kind) {
          case 'verification_started':
            setFlow(null);
            setEmail(result.verifiableAddress);
            recordAcceptedDelivery(result.flowId);
            setLoading(true);
            router.replace(verificationFlowPath(result.flowId));
            return;
          case 'preflight_rejected':
            setError(localizeEmailActionMessage(result.message, t));
            return;
          case 'reauth_required':
            rememberEmailVerificationContinuation({ mode, email: trimmedEmail, operation: 'start' }, subjectId);
            startPrivilegedReauthentication(emailVerificationReauthenticationReturnTo());
            return;
          case 'cooldown':
            setError(t('errors.cooldown', { seconds: result.retryAfterSeconds }));
            return;
          case 'failed':
            setError(t('errors.sendVerificationEmail'));
        }
      } catch {
        if (isCurrentOperation(operation)) {
          setError(t('errors.sendVerificationEmail'));
        }
      } finally {
        if (isCurrentOperation(operation)) {
          setRequestingCode(false);
        }
      }
    },
    [
      beginVerification,
      beginOperation,
      isCurrentOperation,
      locale,
      preflightVerification,
      recordAcceptedDelivery,
      router,
      subjectId,
      t,
      verificationFlowPath,
    ],
  );
  const handleRequestCode = async () => {
    await handleRequestVerificationCode(email);
  };
  const handleRestartVerification = useCallback(
    async (targetEmail: string) => {
      const trimmedEmail = targetEmail.trim();
      if (!trimmedEmail || requestingCode) {
        return;
      }
      const operation = beginOperation();
      setRequestingCode(true);
      setError(null);
      try {
        const result = await restartVerification({
          newEmail: trimmedEmail,
          preflight: preflightVerification,
          locale,
        });
        if (!isCurrentOperation(operation)) {
          return;
        }
        switch (result.kind) {
          case 'verification_started':
            setApplication(null);
            setEmailApplied(false);
            setFlow(null);
            setEmail(result.verifiableAddress);
            setCode('');
            recordAcceptedDelivery(result.flowId);
            setLoading(true);
            router.replace(verificationFlowPath(result.flowId));
            return;
          case 'preflight_rejected':
            setError(localizeEmailActionMessage(result.message, t));
            return;
          case 'reauth_required':
            rememberEmailVerificationContinuation({ mode, email: trimmedEmail, operation: 'restart' }, subjectId);
            startPrivilegedReauthentication(emailVerificationReauthenticationReturnTo());
            return;
          case 'cooldown':
            setError(t('errors.cooldown', { seconds: result.retryAfterSeconds }));
            return;
          case 'failed':
            setError(t('errors.sendVerificationEmail'));
        }
      } catch {
        if (isCurrentOperation(operation)) {
          setError(t('errors.sendVerificationEmail'));
        }
      } finally {
        if (isCurrentOperation(operation)) {
          setRequestingCode(false);
        }
      }
    },
    [
      beginOperation,
      isCurrentOperation,
      locale,
      preflightVerification,
      recordAcceptedDelivery,
      requestingCode,
      restartVerification,
      router,
      subjectId,
      t,
      verificationFlowPath,
    ],
  );
  useEffect(() => {
    if (searchParams.get(EMAIL_VERIFICATION_CONTINUATION_PARAM) !== '1') {
      return;
    }
    if (!subjectId) {
      return;
    }
    const continuation = consumeEmailVerificationContinuation(subjectId);
    window.history.replaceState(window.history.state, '', verificationPath);
    if (!continuation) {
      return;
    }
    setEmail(continuation.email);
    if (continuation.operation === 'restart') {
      void handleRestartVerification(continuation.email);
    } else {
      void handleRequestVerificationCode(continuation.email);
    }
  }, [handleRequestVerificationCode, handleRestartVerification, mode, searchParams, subjectId, verificationPath]);
  const handleResendCode = async () => {
    if (!flow || requestingCode) {
      return;
    }
    const targetEmail = (getVerificationNodeValue(flow, 'email') || email).trim();
    const operation = beginOperation();
    setRequestingCode(true);
    setError(null);
    try {
      const { outcome, status } = await resendVerificationCode(flow, targetEmail, locale);
      if (!isCurrentOperation(operation)) {
        return;
      }
      if (outcome.kind === 'rate-limited') {
        setError(t('errors.cooldown', { seconds: outcome.retryAfterSeconds }));
        return;
      }
      if (outcome.kind !== 'continued' || (!outcome.ok && status !== 422) || hasVerificationFlowError(outcome.flow)) {
        setError(t('errors.sendVerificationEmail'));
        return;
      }
      const nextFlow = outcome.flow;
      setFlow(nextFlow);
      recordAcceptedDelivery(nextFlow.id);
      setCode('');
    } catch {
      if (isCurrentOperation(operation)) {
        setError(t('errors.sendVerificationEmail'));
      }
    } finally {
      if (isCurrentOperation(operation)) {
        setRequestingCode(false);
      }
    }
  };
  const handleCheckApplied = async () => {
    if (!application || checkingApplication) {
      return;
    }
    await reconcileEmailMutation(application.targetEmail, beginOperation());
  };
  if (checkingApplication && !application) {
    return <PageLoader placement="flow" message={t('checking')} />;
  }
  if (loading) {
    return <PageLoader placement="flow" message={t('loading')} />;
  }
  if (error && flowId && !flow && !application && !emailApplied) {
    return (
      <DsLayoutInset space="md">
        <DsLayoutStack align="center" justify="center" flexible>
          <DsLayoutStack align="center" gap="md">
            <DsText tone="danger" size="lg" weight="medium">
              {error}
            </DsText>
            <Button
              tone="neutral"
              emphasis="low"
              onClick={() => {
                clearAcceptedDelivery();
                setError(null);
                router.replace(verificationPath);
              }}
            >
              {t('startOver')}
            </Button>
          </DsLayoutStack>
        </DsLayoutStack>
      </DsLayoutInset>
    );
  }
  if (flowId && !flow && !application && !emailApplied) {
    return null;
  }
  const flowError =
    application || emailApplied ? null : error || (hasVerificationFlowError(flow) ? t('errors.submit') : null);
  const viewState: VerificationViewState | null = application
    ? application.state
    : emailApplied
      ? 'passed'
      : !flowId || flow?.state === 'choose_method'
        ? 'choose_email'
        : flow?.state === 'sent_email'
          ? 'sent_email'
          : null;
  if (!viewState) {
    return null;
  }
  return (
    <DsLayoutInset space="md">
      <DsLayoutStack align="center" justify="center" flexible>
        <VerificationFlowView
          code={code}
          email={email}
          error={flowError}
          loadingSurface={
            <PageLoader placement="flow" message={t(checkingApplication ? 'checking' : 'sentEmail.submitting')} />
          }
          labels={{
            back: tCommonActions('back'),
            chooseDescription: t('chooseMethod.description'),
            chooseSubmit: t('chooseMethod.submit'),
            chooseTitle: t('chooseMethod.title'),
            code: {
              codeAriaLabel: t('sentEmail.codeLabel'),
              codeExpired: tAuthCommon('codeTiming.expired'),
              codeExpiresIn: (time) => tAuthCommon('codeTiming.expiresIn', { time }),
              flowExpired: t('errors.flowNotFound'),
              resend: t('sentEmail.resend'),
              resendIn: (time) => tAuthCommon('codeTiming.resendIn', { time }),
              startOver: t('startOver'),
              submit: t('sentEmail.submitting'),
            },
            emailLabel: tCommonLabels('email'),
            emailPlaceholder: tCommonPlaceholders('emailExample'),
            passedAction: t('passedChallenge.action'),
            passedDescription: t('passedChallenge.description'),
            passedTitle: t('passedChallenge.title'),
            applyingDescription: t('applying.description'),
            applyingRetry: t('applying.checkAgain'),
            applyingTitle: t('applying.title'),
            unavailableTitle: t('unavailable'),
            sentDescription: t('sentEmail.description'),
            sentTitle: tAuthCommon('checkYourEmailTitle'),
          }}
          onBack={() => router.push('/my/security')}
          onCodeChange={setCode}
          onCodeSubmit={(value) => void submitVerificationCode(value)}
          onEmailChange={setEmail}
          onPassed={() => {
            router.push('/my/security');
          }}
          onCheckApplied={() => void handleCheckApplied()}
          onRequestCode={() => void handleRequestCode()}
          onResendCode={() => void handleResendCode()}
          onStartOver={() => void handleRestartVerification(email)}
          requestingCode={requestingCode}
          checkingApplication={checkingApplication || requestingCode}
          state={viewState}
          submittingCode={submittingCode}
          timing={codeTiming}
        />
      </DsLayoutStack>
    </DsLayoutInset>
  );
}

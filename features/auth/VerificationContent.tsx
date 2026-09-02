'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Center, Stack, Text } from '@mantine/core';
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
  if (normalized.includes('already the verified') || normalized.includes('already verified')) {
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
  const { data: session, refetch: refetchSession } = useSession();
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
  const [applicationTarget, setApplicationTarget] = useState<string | null>(null);
  const [emailApplied, setEmailApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    async (targetEmail: string) => {
      const observation = await observeCanonicalEmailChange({ targetEmail });
      switch (observation.kind) {
        case 'applied':
          await refetchSession();
          setApplicationTarget(null);
          setEmailApplied(true);
          setError(null);
          return observation;
        case 'applying':
          setApplicationTarget(targetEmail);
          setEmailApplied(false);
          setError(null);
          return observation;
        case 'proof_pending':
          setApplicationTarget(null);
          setEmailApplied(false);
          return observation;
        case 'conflict':
          clearAcceptedDelivery();
          setApplicationTarget(null);
          setEmailApplied(false);
          setFlow(null);
          setCode('');
          setError(t('errors.alreadyExists'));
          router.replace(verificationPath);
          return observation;
        case 'unavailable':
          setApplicationTarget(targetEmail);
          setEmailApplied(false);
          setError(t('errors.submitRetry'));
          return observation;
      }
    },
    [clearAcceptedDelivery, mode, refetchSession, router, t, verificationPath],
  );
  const reconcileEmailMutationRef = useRef(reconcileEmailMutation);

  useEffect(() => {
    reconcileEmailMutationRef.current = reconcileEmailMutation;
  }, [reconcileEmailMutation]);

  useEffect(() => {
    if (!flowId) {
      return;
    }

    setLoading(true);
    setFlow(null);
    loadVerificationFlow(flowId)
      .then((outcome) => {
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
            setApplicationTarget(flowEmail);
            void reconcileEmailMutationRef.current(flowEmail);
          }
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('errors.flowNotFound'));
      })
      .finally(() => setLoading(false));
  }, [flowId, t]);

  const submitVerificationCode = async (verificationCode: string) => {
    const trimmedCode = verificationCode.trim();
    if (!flow || !trimmedCode || submittingCode) {
      return;
    }

    setSubmittingCode(true);
    setError(null);
    const targetEmail = getVerificationNodeValue(flow, 'email') || email;
    try {
      const result = await submitVerificationCodeRequest(flow, trimmedCode, locale);
      const nextFlow = result.flow;

      if (!result.ok) {
        const replacementFlowId = getReplacementVerificationFlowId(result.payload);
        let replacementFlow: VerificationFlow | null = null;
        if (replacementFlowId) {
          const replacementOutcome = await loadVerificationFlow(replacementFlowId);
          replacementFlow = replacementOutcome.kind === 'continued' ? replacementOutcome.flow : null;
          if (replacementFlow) {
            clearAcceptedDelivery();
            setFlow(replacementFlow);
            const replacementEmail = getVerificationNodeValue(replacementFlow, 'email');
            if (replacementEmail) {
              setEmail(replacementEmail);
            }
            router.replace(verificationFlowPath(replacementFlowId));
          }
        }

        if (!replacementFlow && nextFlow) {
          setFlow(nextFlow);
        }
        setCode('');
        if (!replacementFlow && nextFlow && hasVerificationFlowError(nextFlow)) {
          setError(t('errors.submit'));
          return;
        }
        const observation = await reconcileEmailMutation(targetEmail);
        if (observation.kind === 'applied' || observation.kind === 'applying' || observation.kind === 'conflict') {
          return;
        }
        setError(observation.kind === 'unavailable' ? t('errors.submitRetry') : t('errors.submit'));
        return;
      }

      if (!nextFlow) {
        setCode('');
        setError(t('errors.submit'));
        return;
      }

      setFlow(nextFlow);
      if (nextFlow.state === 'passed_challenge') {
        clearAcceptedDelivery();
        setApplicationTarget(targetEmail);
        await reconcileEmailMutation(targetEmail);
        return;
      }

      if (hasVerificationFlowError(nextFlow)) {
        setCode('');
        setError(t('errors.submit'));
      }
    } catch {
      setCode('');
      setError(t('errors.submitRetry'));
    } finally {
      setSubmittingCode(false);
    }
  };

  useEffect(() => {
    if (!flow || !codeParam || submittedCodeParamRef.current === codeParam) {
      return;
    }
    if (flow.state !== 'sent_email' && flow.state !== 'choose_method') {
      return;
    }

    submittedCodeParamRef.current = codeParam;
    setCode(codeParam);
    void submitVerificationCode(codeParam);
  }, [codeParam, flow]);

  const handleRequestVerificationCode = useCallback(
    async (targetEmail: string) => {
      const trimmedEmail = targetEmail.trim();
      if (!trimmedEmail) {
        setError(t('errors.emailRequired'));
        return;
      }

      setRequestingCode(true);
      setError(null);
      setApplicationTarget(null);
      setEmailApplied(false);
      try {
        const result = await beginVerification({
          newEmail: trimmedEmail,
          preflight: preflightVerification,
          locale,
        });
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
          case 'failed':
            setError(t('errors.sendVerificationEmail'));
        }
      } catch {
        setError(t('errors.sendVerificationEmail'));
      } finally {
        setRequestingCode(false);
      }
    },
    [
      beginVerification,
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

      setRequestingCode(true);
      setError(null);
      try {
        const result = await restartVerification({
          newEmail: trimmedEmail,
          preflight: preflightVerification,
          locale,
        });
        switch (result.kind) {
          case 'verification_started':
            setApplicationTarget(null);
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
          case 'failed':
            setError(t('errors.sendVerificationEmail'));
        }
      } catch {
        setError(t('errors.sendVerificationEmail'));
      } finally {
        setRequestingCode(false);
      }
    },
    [
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
    setRequestingCode(true);
    setError(null);
    try {
      const { outcome, status } = await resendVerificationCode(flow, targetEmail, locale);
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
      setError(t('errors.sendVerificationEmail'));
    } finally {
      setRequestingCode(false);
    }
  };

  const handleCheckApplied = async () => {
    if (!applicationTarget) {
      return;
    }

    setCheckingApplication(true);
    try {
      await reconcileEmailMutation(applicationTarget);
    } finally {
      setCheckingApplication(false);
    }
  };

  if (loading) {
    return <PageLoader message={t('loading')} />;
  }

  if (error && flowId && !flow) {
    return (
      <Center style={{ flex: 1 }} p="md">
        <Stack align="center" gap="md">
          <Text c="red" size="lg" fw={500}>
            {error}
          </Text>
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
        </Stack>
      </Center>
    );
  }

  if (flowId && !flow) {
    return null;
  }

  const flowError = error || (hasVerificationFlowError(flow) ? t('errors.submit') : null);
  const viewState: VerificationViewState | null = applicationTarget
    ? 'applying'
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
    <Center style={{ flex: 1 }} p="md">
      <VerificationFlowView
        code={code}
        email={email}
        error={flowError}
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
          sentDescription: t('sentEmail.description'),
          sentTitle: tAuthCommon('checkYourEmailTitle'),
          submittingCode: t('sentEmail.submitting'),
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
    </Center>
  );
}

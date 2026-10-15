'use client';

import { useEffect, useId, useRef } from 'react';

import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import {
  LayoutContainer as DsLayoutContainer,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { IconMail } from '@tabler/icons-react';

import { Button } from '@/components/core/Button';
import { TextInput } from '@/components/core/Input';
import {
  AuthCodeChallengeView,
  type AuthCodeChallengeLabels,
  type AuthCodeTimingViewModel,
} from './AuthCodeChallengeView';

export type VerificationViewState = 'choose_email' | 'sent_email' | 'applying' | 'passed';

export interface VerificationFlowLabels {
  back: string;
  chooseDescription: string;
  chooseSubmit: string;
  chooseTitle: string;
  code: AuthCodeChallengeLabels;
  emailLabel: string;
  emailPlaceholder: string;
  passedAction: string;
  passedDescription: string;
  passedTitle: string;
  applyingDescription: string;
  applyingRetry: string;
  applyingTitle: string;
  sentDescription: string;
  sentTitle: string;
  submittingCode: string;
}

interface VerificationFlowViewProps {
  code: string;
  email: string;
  error: string | null;
  labels: VerificationFlowLabels;
  onBack: () => void;
  onCodeChange: (value: string) => void;
  onCodeSubmit: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPassed: () => void;
  onCheckApplied: () => void;
  onRequestCode: () => void;
  onResendCode: () => void;
  onStartOver: () => void;
  requestingCode: boolean;
  checkingApplication: boolean;
  state: VerificationViewState;
  submittingCode: boolean;
  timing: AuthCodeTimingViewModel | null;
}

export function VerificationFlowView({
  code,
  email,
  error,
  labels,
  onBack,
  onCodeChange,
  onCodeSubmit,
  onEmailChange,
  onPassed,
  onCheckApplied,
  onRequestCode,
  onResendCode,
  onStartOver,
  requestingCode,
  checkingApplication,
  state,
  submittingCode,
  timing,
}: VerificationFlowViewProps) {
  const viewRef = useRef<HTMLElement>(null);
  const previousState = useRef(state);
  const previousError = useRef(error);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  useEffect(() => {
    if (previousState.current === state) {
      return;
    }
    previousState.current = state;
    const target = viewRef.current?.querySelector<HTMLElement>(
      state === 'choose_email' || state === 'sent_email' ? 'input:not(:disabled), h1' : 'h1',
    );
    // Headings precede fields in DOM order; focus the usable field for an input step.
    const input =
      state === 'choose_email' || state === 'sent_email'
        ? viewRef.current?.querySelector<HTMLElement>('input:not(:disabled)')
        : null;
    (input ?? target)?.focus();
  }, [state]);
  useEffect(() => {
    if (requestingCode || submittingCode || checkingApplication) {
      return;
    }
    const newError = error && previousError.current !== error;
    previousError.current = error;
    if (newError && !viewRef.current?.contains(document.activeElement)) {
      viewRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
    }
  }, [checkingApplication, error, requestingCode, submittingCode]);
  return (
    <DsLayoutContainer ref={viewRef} size="form" inset="none" role="group" aria-labelledby={titleId}>
      {state === 'choose_email' ? (
        <>
          <DsLayoutInset blockEnd="md">
            <DsHeading id={titleId} tabIndex={-1} level={1} scale={2} align="center">
              {labels.chooseTitle}
            </DsHeading>
          </DsLayoutInset>
          <DsLayoutInset blockEnd="lg">
            <DsText id={descriptionId} size="sm" tone="secondary" align="center">
              {labels.chooseDescription}
            </DsText>
          </DsLayoutInset>

          <form
            aria-labelledby={titleId}
            aria-busy={requestingCode}
            onSubmit={(event) => {
              event.preventDefault();
              onRequestCode();
            }}
          >
            <DsLayoutStack gap="sm">
              <TextInput
                label={labels.emailLabel}
                type="email"
                placeholder={labels.emailPlaceholder}
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                leftSection={<IconMail size="1em" aria-hidden />}
                required
                autoComplete="email"
                aria-describedby={[descriptionId, error ? errorId : null].filter(Boolean).join(' ')}
                aria-invalid={Boolean(error)}
              />
              {error ? (
                <DsText id={errorId} size="sm" tone="danger" role="alert">
                  {error}
                </DsText>
              ) : null}
              <Button type="submit" emphasis="strong" fullWidth loading={requestingCode} disabled={!email.trim()}>
                {labels.chooseSubmit}
              </Button>
              <Button type="button" tone="neutral" emphasis="low" data-testid="verification-back" onClick={onBack}>
                {labels.back}
              </Button>
            </DsLayoutStack>
          </form>
        </>
      ) : null}

      {state === 'sent_email' ? (
        <>
          <DsLayoutInset blockEnd="md">
            <DsHeading id={titleId} tabIndex={-1} level={1} scale={2} align="center">
              {labels.sentTitle}
            </DsHeading>
          </DsLayoutInset>
          <DsLayoutInset blockEnd="lg">
            <DsText id={descriptionId} size="sm" tone="secondary" align="center">
              {labels.sentDescription}
            </DsText>
          </DsLayoutInset>

          <DsLayoutStack gap="sm" align="center">
            <AuthCodeChallengeView
              autoFocus
              code={code}
              error={Boolean(error)}
              aria-describedby={[descriptionId, error ? errorId : null].filter(Boolean).join(' ')}
              labels={labels.code}
              onCodeChange={onCodeChange}
              onResend={onResendCode}
              onStartOver={onStartOver}
              onSubmit={onCodeSubmit}
              pinTestId="verification-code-pin"
              showSubmitButton={false}
              submitting={submittingCode || requestingCode}
              timing={timing}
            />
            {submittingCode ? (
              <DsText size="sm" tone="secondary" role="status" aria-live="polite">
                {labels.submittingCode}
              </DsText>
            ) : null}
            {error ? (
              <DsText id={errorId} size="sm" tone="danger" role="alert">
                {error}
              </DsText>
            ) : null}
          </DsLayoutStack>
        </>
      ) : null}

      {state === 'passed' ? (
        <DsLayoutStack gap="md" align="center">
          <DsHeading id={titleId} tabIndex={-1} level={1} scale={2} align="center">
            {labels.passedTitle}
          </DsHeading>
          <DsText size="sm" tone="secondary" align="center">
            {labels.passedDescription}
          </DsText>
          <Button onClick={onPassed} emphasis="strong" fullWidth>
            {labels.passedAction}
          </Button>
        </DsLayoutStack>
      ) : null}

      {state === 'applying' ? (
        <DsLayoutStack gap="md" align="center">
          <DsHeading id={titleId} tabIndex={-1} level={1} scale={2} align="center">
            {labels.applyingTitle}
          </DsHeading>
          <DsText size="sm" tone="secondary" align="center">
            {labels.applyingDescription}
          </DsText>
          {error ? (
            <DsText size="sm" tone="danger" role="alert" align="center">
              {error}
            </DsText>
          ) : null}
          <Button onClick={onCheckApplied} emphasis="medium" loading={checkingApplication} fullWidth>
            {labels.applyingRetry}
          </Button>
        </DsLayoutStack>
      ) : null}
    </DsLayoutContainer>
  );
}

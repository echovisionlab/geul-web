'use client';

import { useId } from 'react';
import { Text as DsText, VisuallyHidden } from '@/components/core/Typography';
import { LayoutInline as DsLayoutInline, LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { Button } from '@/components/core/Button';
import { PinInput } from '@/components/core/Input';

export interface AuthCodeTimingViewModel {
  expiresInSeconds: number | null;
  flowExpiresInSeconds: number | null;
  resendInSeconds: number;
}

export interface AuthCodeChallengeLabels {
  codeAriaLabel: string;
  codeExpired: string;
  codeExpiresIn: (time: string) => string;
  flowExpired: string;
  resend: string;
  resendIn: (time: string) => string;
  startOver: string;
  submit: string;
}

export interface AuthCodeChallengeViewProps {
  autoFocus?: boolean;
  code: string;
  error?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  labels: AuthCodeChallengeLabels;
  onCodeChange: (code: string) => void;
  onResend: () => void;
  onStartOver?: () => void;
  onSubmit: (completedCode: string) => void;
  pinTestId?: string;
  showStartOver?: boolean;
  showSubmitButton?: boolean;
  submitting: boolean;
  resending?: boolean;
  timing: AuthCodeTimingViewModel | null;
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function AuthCodeChallengeView({
  autoFocus = false,
  code,
  error = false,
  'aria-describedby': describedBy,
  'aria-invalid': invalid = error,
  labels,
  onCodeChange,
  onResend,
  onStartOver,
  onSubmit,
  pinTestId,
  showStartOver = true,
  showSubmitButton = true,
  submitting,
  resending = false,
  timing,
}: AuthCodeChallengeViewProps) {
  const codeExpired = timing?.expiresInSeconds === 0;
  const flowExpired = timing?.flowExpiresInSeconds === 0;
  const challengeDisabled = submitting || resending || codeExpired || flowExpired;
  const resendInSeconds = timing?.resendInSeconds ?? 0;
  const expiryId = useId();
  const hasExpiry = flowExpired || codeExpired || timing?.expiresInSeconds != null;

  return (
    <DsLayoutStack gap="md" role="group" aria-label={labels.codeAriaLabel} aria-busy={submitting || resending}>
      <PinInput
        align="center"
        ariaLabel={labels.codeAriaLabel}
        aria-describedby={[describedBy, hasExpiry ? expiryId : null].filter(Boolean).join(' ') || undefined}
        autoFocus={autoFocus}
        data-testid={pinTestId}
        error={error}
        aria-invalid={invalid}
        length={6}
        inputMode="numeric"
        oneTimeCode
        type="number"
        value={code}
        onChange={onCodeChange}
        onComplete={onSubmit}
        disabled={challengeDisabled}
      />
      {showSubmitButton ? (
        <DsLayoutInline justify="center">
          <Button
            emphasis="medium"
            onClick={() => onSubmit(code)}
            loading={submitting}
            disabled={challengeDisabled || code.length !== 6}
          >
            {labels.submit}
          </Button>
        </DsLayoutInline>
      ) : null}
      <DsLayoutStack gap="xxs" align="center">
        {hasExpiry ? (
          <DsText
            id={expiryId}
            role="timer"
            aria-live="off"
            size="sm"
            tone={codeExpired || flowExpired ? 'danger' : 'secondary'}
            data-testid="auth-code-expiry"
          >
            {flowExpired
              ? labels.flowExpired
              : codeExpired
                ? labels.codeExpired
                : labels.codeExpiresIn(formatDuration(timing?.expiresInSeconds ?? 0))}
          </DsText>
        ) : null}
        <DsLayoutInline justify="center" gap="xs" wrap="wrap">
          <Button
            type="button"
            size="sm"
            emphasis="medium"
            onClick={onResend}
            disabled={submitting || resending || flowExpired || resendInSeconds > 0}
            loading={resending}
            data-testid="auth-code-resend"
          >
            {resendInSeconds > 0 ? labels.resendIn(formatDuration(resendInSeconds)) : labels.resend}
          </Button>
          {showStartOver && onStartOver ? (
            <Button type="button" size="sm" emphasis="low" onClick={onStartOver} disabled={submitting || resending}>
              {labels.startOver}
            </Button>
          ) : null}
        </DsLayoutInline>
      </DsLayoutStack>
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {flowExpired ? labels.flowExpired : codeExpired ? labels.codeExpired : ''}
      </VisuallyHidden>
    </DsLayoutStack>
  );
}

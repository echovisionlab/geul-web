'use client';

import { Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { PinInput } from '@/components/core/Input';
import { TextButton } from '@/components/core/TextButton';

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
  labels: AuthCodeChallengeLabels;
  onCodeChange: (code: string) => void;
  onResend: () => void;
  onStartOver?: () => void;
  onSubmit: (completedCode: string) => void;
  pinTestId?: string;
  showStartOver?: boolean;
  showSubmitButton?: boolean;
  submitting: boolean;
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
  labels,
  onCodeChange,
  onResend,
  onStartOver,
  onSubmit,
  pinTestId,
  showStartOver = true,
  showSubmitButton = true,
  submitting,
  timing,
}: AuthCodeChallengeViewProps) {
  const codeExpired = timing?.expiresInSeconds === 0;
  const flowExpired = timing?.flowExpiresInSeconds === 0;
  const challengeDisabled = submitting || codeExpired || flowExpired;
  const resendInSeconds = timing?.resendInSeconds ?? 0;

  return (
    <Stack gap="md">
      <PinInput
        ariaLabel={labels.codeAriaLabel}
        autoFocus={autoFocus}
        data-testid={pinTestId}
        error={error}
        length={6}
        inputMode="numeric"
        oneTimeCode
        type="number"
        value={code}
        onChange={onCodeChange}
        onComplete={onSubmit}
        disabled={challengeDisabled}
        style={{ alignSelf: 'center' }}
      />
      {showSubmitButton ? (
        <Button
          fullWidth
          onClick={() => onSubmit(code)}
          loading={submitting}
          disabled={challengeDisabled || code.length !== 6}
        >
          {labels.submit}
        </Button>
      ) : null}
      <Stack gap={4} align="center">
        <Text
          role="timer"
          aria-live="polite"
          size="sm"
          c={codeExpired || flowExpired ? 'red' : 'dimmed'}
          mih="1.5em"
          data-testid="auth-code-expiry"
        >
          {flowExpired
            ? labels.flowExpired
            : timing?.expiresInSeconds == null
              ? '\u00a0'
              : codeExpired
                ? labels.codeExpired
                : labels.codeExpiresIn(formatDuration(timing.expiresInSeconds))}
        </Text>
        <TextButton
          type="button"
          size="sm"
          appearance="muted"
          onClick={onResend}
          disabled={submitting || flowExpired || resendInSeconds > 0}
          data-testid="auth-code-resend"
        >
          {resendInSeconds > 0 ? labels.resendIn(formatDuration(resendInSeconds)) : labels.resend}
        </TextButton>
        {showStartOver && onStartOver ? (
          <TextButton type="button" size="sm" appearance="muted" onClick={onStartOver} disabled={submitting}>
            {labels.startOver}
          </TextButton>
        ) : null}
      </Stack>
    </Stack>
  );
}

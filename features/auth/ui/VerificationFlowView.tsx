'use client';

import { IconArrowLeft, IconMail } from '@tabler/icons-react';
import { Stack, Text, Title } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { TextInput } from '@/components/core/Input';
import { SectionCard } from '@/components/core/Section';
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
  return (
    <SectionCard p="xl" maw={400} w="100%">
      {state === 'choose_email' ? (
        <>
          <Title order={2} ta="center" mb="md">
            {labels.chooseTitle}
          </Title>
          <Text size="sm" c="dimmed" ta="center" mb="lg">
            {labels.chooseDescription}
          </Text>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              onRequestCode();
            }}
          >
            <Stack gap="sm">
              <TextInput
                label={labels.emailLabel}
                type="email"
                placeholder={labels.emailPlaceholder}
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                leftSection={<IconMail size={16} />}
                required
              />
              {error ? (
                <Text size="sm" c="red" role="alert">
                  {error}
                </Text>
              ) : null}
              <Button type="submit" fullWidth loading={requestingCode} disabled={!email.trim()}>
                {labels.chooseSubmit}
              </Button>
              <Button
                type="button"
                tone="neutral"
                emphasis="low"
                leftSection={<IconArrowLeft size={16} />}
                onClick={onBack}
              >
                {labels.back}
              </Button>
            </Stack>
          </form>
        </>
      ) : null}

      {state === 'sent_email' ? (
        <>
          <Title order={2} ta="center" mb="md">
            {labels.sentTitle}
          </Title>
          <Text size="sm" c="dimmed" ta="center" mb="lg">
            {labels.sentDescription}
          </Text>

          <Stack gap="sm" align="center">
            <AuthCodeChallengeView
              autoFocus
              code={code}
              error={Boolean(error)}
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
              <Text size="sm" c="dimmed">
                {labels.submittingCode}
              </Text>
            ) : null}
            {error ? (
              <Text size="sm" c="red" role="alert">
                {error}
              </Text>
            ) : null}
          </Stack>
        </>
      ) : null}

      {state === 'passed' ? (
        <Stack gap="md" align="center">
          <Title order={2} ta="center">
            {labels.passedTitle}
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            {labels.passedDescription}
          </Text>
          <Button onClick={onPassed} fullWidth>
            {labels.passedAction}
          </Button>
        </Stack>
      ) : null}

      {state === 'applying' ? (
        <Stack gap="md" align="center">
          <Title order={2} ta="center">
            {labels.applyingTitle}
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            {labels.applyingDescription}
          </Text>
          {error ? (
            <Text size="sm" c="red" role="alert" ta="center">
              {error}
            </Text>
          ) : null}
          <Button onClick={onCheckApplied} loading={checkingApplication} fullWidth>
            {labels.applyingRetry}
          </Button>
        </Stack>
      ) : null}
    </SectionCard>
  );
}

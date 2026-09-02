'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Box, Stack } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { ValidatingTextInput, type TextValidationStatus } from '@/components/core/Input';
import { PageHeader } from '@/components/core/PageHeader';
import { TextButton } from '@/components/core/TextButton';
import { completeMyOnboardingAction, type MemberSummaryResult, type NicknameErrorCode } from '@/lib/actions/user';
import { useNicknameValidation, type NicknameAvailabilityCheck } from '@/features/member/useNicknameValidation';

type CompleteOnboarding = (nickname: string) => Promise<{
  member?: MemberSummaryResult;
  onboarded?: boolean;
  error?: string;
  errorCode?: NicknameErrorCode;
}>;

interface NicknameOnboardingProps {
  initialNickname: string;
  onCompleted: (member: MemberSummaryResult) => void;
  onLogout: () => void;
  checkAvailability?: NicknameAvailabilityCheck;
  completeOnboarding?: CompleteOnboarding;
}

function visualStatus(status: ReturnType<typeof useNicknameValidation>['status']): TextValidationStatus {
  switch (status) {
    case 'checking':
      return 'checking';
    case 'available':
      return 'valid';
    case 'unavailable':
    case 'invalid':
      return 'invalid';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

export function NicknameOnboarding({
  initialNickname,
  onCompleted,
  onLogout,
  checkAvailability,
  completeOnboarding = completeMyOnboardingAction,
}: NicknameOnboardingProps) {
  const t = useTranslations('memberOnboarding');
  const tNickname = useTranslations('nicknameField');
  const tCommonActions = useTranslations('common.actions');
  const [nickname, setNickname] = useState(initialNickname);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<{ message: string; status: 'invalid' | 'error' } | null>(null);
  const validation = useNicknameValidation(nickname, checkAvailability ? { check: checkAvailability } : undefined);
  const validationStatus = submitError?.status ?? visualStatus(validation.status);
  const validationMessage =
    submitError?.message ||
    (validation.status === 'checking'
      ? tNickname('checking')
      : validation.status === 'available'
        ? tNickname('available')
        : validation.status === 'unavailable'
          ? tNickname('unavailable')
          : validation.status === 'invalid'
            ? tNickname('invalid')
            : validation.status === 'error'
              ? tNickname('checkFailed')
              : null);
  const submitDisabled =
    pending ||
    !validation.valid ||
    validation.status === 'checking' ||
    validation.status === 'unavailable' ||
    validation.status === 'error' ||
    submitError?.status === 'invalid';

  const submit = async () => {
    if (submitDisabled) {
      return;
    }
    setPending(true);
    setSubmitError(null);
    try {
      const result = await completeOnboarding(validation.normalized);
      if (result.member && result.onboarded) {
        onCompleted(result.member);
        return;
      }
      setSubmitError({
        message:
          result.errorCode === 'nickname_unavailable'
            ? tNickname('unavailable')
            : result.errorCode === 'nickname_invalid'
              ? tNickname('invalid')
              : t('submitFailed'),
        status: result.errorCode ? 'invalid' : 'error',
      });
    } catch {
      setSubmitError({ message: t('submitFailed'), status: 'error' });
    } finally {
      setPending(false);
    }
  };

  return (
    <Box w={400} maw="calc(100vw - 2rem)">
      <Stack gap="md">
        <PageHeader title={t('title')} description={t('description')} />

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Stack gap="md">
            <ValidatingTextInput
              id="member-nickname"
              label={tNickname('label')}
              placeholder={tNickname('placeholder')}
              autoComplete="nickname"
              value={nickname}
              onChange={(event) => {
                setNickname(event.currentTarget.value);
                setSubmitError(null);
              }}
              required
              disabled={pending}
              status={validationStatus}
              description={
                validationStatus === 'checking' || validationStatus === 'valid'
                  ? validationMessage || undefined
                  : undefined
              }
              error={
                validationStatus === 'invalid' || validationStatus === 'error'
                  ? validationMessage || undefined
                  : undefined
              }
            />
            <Button type="submit" loading={pending} disabled={submitDisabled} fullWidth>
              {tCommonActions('continue')}
            </Button>
            <TextButton
              type="button"
              appearance="accent"
              size="sm"
              controlSize="sm"
              weight="medium"
              onClick={onLogout}
              disabled={pending}
              style={{ alignSelf: 'center' }}
            >
              {tCommonActions('logOut')}
            </TextButton>
          </Stack>
        </form>
      </Stack>
    </Box>
  );
}

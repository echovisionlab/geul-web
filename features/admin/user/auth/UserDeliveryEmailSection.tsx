'use client';

import { useTranslations } from 'next-intl';
import { Group, Stack, Text } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { DateTime } from '@/features/date-time/DateTime';
import { Select } from '@/components/core/Input';
import {
  AccountEmailOptionContent,
  AccountEmailSelectRightSection,
  getAccountEmailSelectRightSectionWidth,
  type AccountEmailOptionSource,
} from '@/features/account-email/AccountEmailOption';
import type { UserFull } from '@/lib/types/user/model';
import { InfoRow, InfoSection, providerLabel, StatusValue, type EmailCandidate } from './shared';

export interface UserEmailSuppressionStatus {
  email: string;
  reason: string;
  lastError?: string;
  suppressedAt: Date;
}

interface UserDeliveryEmailSectionProps {
  user: UserFull;
  suppression: UserEmailSuppressionStatus | null | undefined;
  isSuppressionLoading?: boolean;
  isReleasePending?: boolean;
  onReleaseSuppression?: (email: string) => void;
  onSetCanonicalEmail?: (email: string) => boolean | Promise<boolean>;
  isSetCanonicalEmailPending?: boolean;
}

interface DeliveryCandidateOption {
  value: string;
  label: string;
  sources: AccountEmailOptionSource[];
}

export function UserDeliveryEmailSection({
  user,
  suppression,
  isSuppressionLoading,
  isReleasePending,
  onReleaseSuppression,
  onSetCanonicalEmail,
  isSetCanonicalEmailPending,
}: UserDeliveryEmailSectionProps) {
  const tPage = useTranslations('adminUserDetail');
  const tSecurityEmail = useTranslations('security.email');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');
  const currentCandidate = user.auth_details?.email_candidates.find((candidate) => candidate.current);
  const deliveryCandidates =
    user.auth_details?.email_candidates.filter((candidate) => candidate.usable_for_delivery) ?? [];
  const candidateOptions = deliveryCandidates.map((candidate) => ({
    value: candidate.normalized_email,
    label: candidate.email,
    sources: deliveryCandidateSources(candidate, tSecurityEmail('canonical'), tPage('auth.sources.emailCode')),
  }));
  const selectedCandidateValue =
    currentCandidate?.normalized_email ??
    deliveryCandidates.find((candidate) => candidate.email === user.email)?.normalized_email ??
    null;
  const selectedCandidateOption = candidateOptions.find((candidate) => candidate.value === selectedCandidateValue);
  const currentDeliveryTrusted = Boolean(user.email_verified || currentCandidate?.usable_for_delivery);
  const deliveryStatus = user.email
    ? {
        tone: suppression ? ('danger' as const) : currentDeliveryTrusted ? ('positive' as const) : ('warning' as const),
        label: suppression
          ? tPage('emailSuppression.status')
          : currentDeliveryTrusted || user.email_verified
            ? tPage('emailVerification.verified')
            : tPage('emailVerification.unverified'),
      }
    : null;

  return (
    <InfoSection title={tSecurityEmail('title')} description={tSecurityEmail('description')}>
      {candidateOptions.length > 1 ? (
        <InfoRow label={tCommonLabels('email')}>
          <Stack gap={4}>
            <Select
              data={candidateOptions}
              value={selectedCandidateValue}
              disabled={isSetCanonicalEmailPending}
              allowDeselect={false}
              onChange={(value) => {
                if (!value || value === selectedCandidateValue) {
                  return;
                }
                void onSetCanonicalEmail?.(value);
              }}
              placeholder={tSecurityEmail('setCanonical')}
              size="sm"
              {...(selectedCandidateOption
                ? {
                    rightSection: <AccountEmailSelectRightSection sources={selectedCandidateOption.sources} />,
                    rightSectionPointerEvents: 'none' as const,
                    rightSectionWidth: getAccountEmailSelectRightSectionWidth(selectedCandidateOption.sources),
                  }
                : {})}
              renderOption={({ option }) => {
                const emailOption = option as DeliveryCandidateOption;
                return <AccountEmailOptionContent email={emailOption.label} sources={emailOption.sources} />;
              }}
            />
          </Stack>
        </InfoRow>
      ) : (
        <InfoRow label={tCommonLabels('email')}>
          <Group gap="sm" align="baseline">
            <Text fw={600}>{user.email || tPage('auth.emptyEmail')}</Text>
            {deliveryStatus ? <StatusValue tone={deliveryStatus.tone}>{deliveryStatus.label}</StatusValue> : null}
          </Group>
        </InfoRow>
      )}
      {isSuppressionLoading ? (
        <InfoRow label={tPage('emailSuppression.title')}>
          <Text size="sm" c="dimmed">
            {tCommonStates('loading')}
          </Text>
        </InfoRow>
      ) : null}
      {suppression ? (
        <Alert tone="danger" title={tPage('emailSuppression.title')}>
          <Stack gap={6}>
            <Text size="sm">{tPage('emailSuppression.description')}</Text>
            <InfoRow label={tPage('emailSuppression.reason')} compact>
              <Text size="sm">{suppression.reason}</Text>
            </InfoRow>
            {suppression.lastError ? (
              <InfoRow label={tPage('emailSuppression.lastError')} compact>
                <Text size="sm">{suppression.lastError}</Text>
              </InfoRow>
            ) : null}
            <InfoRow label={tPage('emailSuppression.suppressedAt')} compact>
              <Text size="sm">
                <DateTime value={suppression.suppressedAt} display="dateTime" />
              </Text>
            </InfoRow>
            <Button
              size="xs"
              tone="positive"
              onClick={() => onReleaseSuppression?.(suppression.email)}
              loading={isReleasePending || isSuppressionLoading}
              w="fit-content"
            >
              {tPage('emailSuppression.release')}
            </Button>
          </Stack>
        </Alert>
      ) : null}
    </InfoSection>
  );
}

function deliveryCandidateSources(
  candidate: EmailCandidate,
  currentSourceLabel: string,
  emailCodeLabel: string,
): AccountEmailOptionSource[] {
  const sources = new Map<string, AccountEmailOptionSource>();
  for (const source of candidate.sources) {
    if (source.source_type === 'oidc_provider' && source.provider) {
      sources.set(`provider:${source.provider}`, {
        key: `provider:${source.provider}`,
        kind: 'provider',
        provider: source.provider,
        label: providerLabel(source.provider),
      });
    }
    if (source.source_type === 'kratos_current') {
      sources.set('current', {
        key: 'current',
        kind: 'current',
        label: currentSourceLabel,
      });
    }
    if (source.source_type === 'email_code') {
      sources.set('email-code', {
        key: 'email-code',
        kind: 'external',
        label: emailCodeLabel,
      });
    }
  }
  const nonCurrentSources = Array.from(sources.values()).filter((source) => source.kind !== 'current');
  if (nonCurrentSources.length > 0) {
    return nonCurrentSources;
  }
  return [];
}

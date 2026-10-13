'use client';
import { Text as DsText } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { useTranslations } from 'next-intl';

import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { DateTime } from '@/features/date-time/DateTime';
import { Select } from '@/components/core/Input';
import {
  AccountEmailOptionContent,
  AccountEmailSelectRightSection,
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
          <DsLayoutStack gap="xxs">
            <Select
              aria-label={tCommonLabels('email')}
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
              rightSection={
                selectedCandidateOption ? (
                  <AccountEmailSelectRightSection sources={selectedCandidateOption.sources} />
                ) : undefined
              }
              renderOption={({ option }) => {
                const emailOption = option as DeliveryCandidateOption;
                return <AccountEmailOptionContent email={emailOption.label} sources={emailOption.sources} />;
              }}
            />
          </DsLayoutStack>
        </InfoRow>
      ) : (
        <InfoRow label={tCommonLabels('email')}>
          <DsLayoutInline gap="sm" align="baseline">
            <DsText weight="strong">{user.email || tPage('auth.emptyEmail')}</DsText>
            {deliveryStatus ? <StatusValue tone={deliveryStatus.tone}>{deliveryStatus.label}</StatusValue> : null}
          </DsLayoutInline>
        </InfoRow>
      )}
      {isSuppressionLoading ? (
        <InfoRow label={tPage('emailSuppression.title')}>
          <DsText tone="secondary">{tCommonStates('loading')}</DsText>
        </InfoRow>
      ) : null}
      {suppression ? (
        <Alert tone="danger" title={tPage('emailSuppression.title')}>
          <DsLayoutStack gap="xxs">
            <DsText size="sm" tone="secondary">
              {tPage('emailSuppression.description')}
            </DsText>
            <InfoRow label={tPage('emailSuppression.reason')} compact>
              <DsText>{suppression.reason}</DsText>
            </InfoRow>
            {suppression.lastError ? (
              <InfoRow label={tPage('emailSuppression.lastError')} compact>
                <DsText>{suppression.lastError}</DsText>
              </InfoRow>
            ) : null}
            <InfoRow label={tPage('emailSuppression.suppressedAt')} compact>
              <DsText>
                <DateTime value={suppression.suppressedAt} display="dateTime" />
              </DsText>
            </InfoRow>
            <Button
              size="xs"
              tone="positive"
              onClick={() => onReleaseSuppression?.(suppression.email)}
              loading={isReleasePending || isSuppressionLoading}
            >
              {tPage('emailSuppression.release')}
            </Button>
          </DsLayoutStack>
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

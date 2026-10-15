'use client';
import { useId } from 'react';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { IconCheck, IconMail } from '@tabler/icons-react';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { SectionCard, SectionHeader } from '@/components/core/Section';
export interface AccountEmailSettingsLabels {
  canonical: string;
  change: string;
  description: string;
  emailCode: string;
  title: string;
}

interface AccountEmailSettingsViewProps {
  email: string;
  emailCodeAvailable: boolean;
  labels: AccountEmailSettingsLabels;
  onChangeEmail: () => void;
}

export function AccountEmailSettingsView({
  email,
  emailCodeAvailable,
  labels,
  onChangeEmail,
}: AccountEmailSettingsViewProps) {
  const emailId = useId();
  return (
    <DsLayoutStack gap="md">
      <SectionHeader
        title={
          <span role="heading" aria-level={2}>
            {labels.title}
          </span>
        }
        description={labels.description}
      />

      <SectionCard appearance="plain" padding="none" data-testid="security-account-email">
        <DsLayoutInline justify="between" align="start" direction={{ base: 'column', xs: 'row' }} wrap="nowrap">
          <DsLayoutInline gap="sm" wrap="nowrap" flexible>
            <IconMail size={18} aria-hidden />
            <DsLayoutStack gap="xxs">
              <DsText id={emailId} size="sm" weight="strong" wrap="anywhere">
                {email || '—'}
              </DsText>
              <DsLayoutInline gap="xxs">
                <LabelBadge
                  size="sm"
                  tone="accent"
                  appearance="soft"
                  leftSection={<IconCheck size={11} aria-hidden />}
                  data-testid="security-primary-email"
                >
                  {labels.canonical}
                </LabelBadge>
                {emailCodeAvailable ? (
                  <LabelBadge size="sm" tone="neutral" appearance="soft">
                    {labels.emailCode}
                  </LabelBadge>
                ) : null}
              </DsLayoutInline>
            </DsLayoutStack>
          </DsLayoutInline>
          <Button
            size="xs"
            tone="neutral"
            emphasis="medium"
            labelWrap="wrap"
            onClick={onChangeEmail}
            data-testid="security-change-email"
            aria-describedby={emailId}
          >
            {labels.change}
          </Button>
        </DsLayoutInline>
      </SectionCard>
    </DsLayoutStack>
  );
}

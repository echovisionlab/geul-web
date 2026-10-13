'use client';

import { PublicMetadataRows, PublicMetadataRow } from '@/components/core/PublicMetadata';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { type ReactNode } from 'react';
import { SectionHeader } from '@/components/core/Section';
import { StatusBadge } from '@/components/core/Badge';
import type { UserFull } from '@/lib/types/user/model';

export type AuthDetails = NonNullable<UserFull['auth_details']>;
export type EmailCandidate = AuthDetails['email_candidates'][number];
export type Tone = 'positive' | 'warning' | 'danger' | 'neutral';

export function InfoSection({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DsLayoutStack gap="md">
      <SectionHeader title={title} description={description} actions={actions} />
      <DsLayoutStack gap="xs">{children}</DsLayoutStack>
    </DsLayoutStack>
  );
}

export function InfoRow({
  label,
  children,
  compact = false,
}: {
  label: ReactNode;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <PublicMetadataRows>
      <PublicMetadataRow label={label} size={compact ? 'xs' : 'sm'}>
        {children}
      </PublicMetadataRow>
    </PublicMetadataRows>
  );
}

export function StatusValue({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <StatusBadge tone={tone} size="sm">
      {children}
    </StatusBadge>
  );
}

export function providerLabel(provider: string) {
  const normalized = provider.trim().toLowerCase();
  if (normalized === 'github') {
    return 'GitHub';
  }
  if (normalized === 'google') {
    return 'Google';
  }
  return provider || 'OIDC';
}

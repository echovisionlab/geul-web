'use client';

import { type ReactNode } from 'react';
import { Box, Stack, Text } from '@mantine/core';
import { SectionHeader } from '@/components/core/Section';
import { StatusBadge } from '@/components/core/Badge';
import type { UserFull } from '@/lib/types/user/model';

export type AuthDetails = NonNullable<UserFull['auth_details']>;
export type EmailCandidate = AuthDetails['email_candidates'][number];
export type Tone = 'positive' | 'warning' | 'danger' | 'neutral';

export function InfoSection({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <Stack gap="sm">
      <SectionHeader title={title} description={description} />
      <Stack gap="xs">{children}</Stack>
    </Stack>
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
    <Box
      style={{
        display: 'grid',
        gridTemplateColumns: compact ? '120px minmax(0, 1fr)' : '160px minmax(0, 1fr)',
        columnGap: 'var(--mantine-spacing-md)',
        alignItems: 'baseline',
      }}
    >
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Box style={{ minWidth: 0 }}>{children}</Box>
    </Box>
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

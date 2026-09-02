'use client';

import { IconChevronDown } from '@tabler/icons-react';
import { siGithub } from 'simple-icons';
import { Box, Group, Text } from '@mantine/core';

export interface AccountEmailOptionSource {
  key: string;
  kind: 'current' | 'external' | 'provider';
  label: string;
  provider?: string | null;
}

function ProviderLogo({ provider, size = 16 }: { provider: string; size?: number }) {
  const normalized = provider.trim().toLowerCase();

  if (normalized === 'google') {
    return <img src="/providers/google-g-logo.svg" alt="" width={size} height={size} aria-hidden="true" />;
  }

  if (normalized === 'github') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
        style={{ display: 'block' }}
      >
        <path d={siGithub.path} fill="currentColor" />
      </svg>
    );
  }

  return null;
}

export function AccountEmailOptionContent({
  email,
  sources,
  status,
}: {
  email: string;
  sources: AccountEmailOptionSource[];
  status?: string;
}) {
  return (
    <Group justify="space-between" gap="md" wrap="nowrap" style={{ width: '100%' }}>
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
        <Text span truncate size="sm">
          {email}
        </Text>
        {status ? (
          <Text span size="xs" c="dimmed" style={{ flexShrink: 0 }}>
            {status}
          </Text>
        ) : null}
      </Group>
      <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
        {sources.map((source) => (
          <Group key={source.key} gap={4} wrap="nowrap">
            {source.kind === 'provider' && source.provider ? (
              <Box
                c="dimmed"
                role="img"
                aria-label={source.label}
                title={source.label}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <ProviderLogo provider={source.provider} size={14} />
              </Box>
            ) : (
              <Text span size="xs" c="dimmed">
                {source.label}
              </Text>
            )}
          </Group>
        ))}
      </Group>
    </Group>
  );
}

export function AccountEmailSelectRightSection({ sources }: { sources: AccountEmailOptionSource[] }) {
  const source = sources[0];
  return (
    <Group gap="xs" wrap="nowrap" justify="flex-end" style={{ width: '100%' }}>
      {source?.kind === 'provider' && source.provider ? (
        <Box
          c="dimmed"
          role="img"
          aria-label={source.label}
          title={source.label}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <ProviderLogo provider={source.provider} size={14} />
        </Box>
      ) : source ? (
        <Text span size="xs" c="dimmed" truncate>
          {source.label}
        </Text>
      ) : null}
      <IconChevronDown size={14} color="var(--mantine-color-dimmed)" />
    </Group>
  );
}

export function getAccountEmailSelectRightSectionWidth(sources: AccountEmailOptionSource[]) {
  return sources.some((source) => source.kind !== 'provider') ? 132 : 48;
}

export { ProviderLogo as AccountEmailProviderLogo };

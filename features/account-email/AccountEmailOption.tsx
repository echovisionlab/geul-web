'use client';

import { Text as DsText } from '@/components/core/Typography';
import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { IconChevronDown } from '@tabler/icons-react';
// Catalog-free identity marks keep the social-link platform catalog out of account routes.
import { SocialIdentityIcon } from '@/components/core/Social/SocialIdentityIcon';
import type { SocialIconSize } from '@/components/core/Social';

export interface AccountEmailOptionSource {
  key: string;
  kind: 'current' | 'external' | 'provider';
  label: string;
  provider?: string | null;
}

/** Maps a stored provider id onto the Core identity icon; unknown providers have no mark. */
function ProviderLogo({ provider, size = 'md' }: { provider: string; size?: SocialIconSize }) {
  const normalized = provider.trim().toLowerCase();
  if (normalized !== 'google' && normalized !== 'github') {
    return null;
  }
  return <SocialIdentityIcon platform={normalized} colorMode="brand" size={size} />;
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
    <DsLayoutInline justify="between" gap="md" wrap="nowrap" fill="inline">
      <DsLayoutInline gap="xs" wrap="nowrap">
        <DsText as="span" truncate size="sm">
          {email}
        </DsText>
        {status ? (
          <DsText as="span" size="xs" tone="secondary" shrink={false}>
            {status}
          </DsText>
        ) : null}
      </DsLayoutInline>
      <DsLayoutInline gap="xs" wrap="nowrap" shrink={false}>
        {sources.map((source) => (
          <DsLayoutInline key={source.key} gap="xxs" wrap="nowrap">
            {source.kind === 'provider' && source.provider ? (
              <DsText align="center" tone="secondary" role="img" aria-label={source.label} title={source.label}>
                <ProviderLogo provider={source.provider} size="sm" />
              </DsText>
            ) : (
              <DsText as="span" size="xs" tone="secondary">
                {source.label}
              </DsText>
            )}
          </DsLayoutInline>
        ))}
      </DsLayoutInline>
    </DsLayoutInline>
  );
}

export function AccountEmailSelectRightSection({ sources }: { sources: AccountEmailOptionSource[] }) {
  const source = sources[0];
  return (
    <div
      style={{
        width: getAccountEmailSelectRightSectionWidth(sources),
        maxWidth: '100%',
        minWidth: 0,
        pointerEvents: 'none',
      }}
    >
      <DsLayoutInline gap="xs" wrap="nowrap" justify="end" fill="inline">
        {source?.kind === 'provider' && source.provider ? (
          <DsText align="center" tone="secondary" role="img" aria-label={source.label} title={source.label}>
            <ProviderLogo provider={source.provider} size="sm" />
          </DsText>
        ) : source ? (
          <DsText as="span" size="xs" tone="secondary" truncate>
            {source.label}
          </DsText>
        ) : null}
        <DsText as="span" tone="secondary">
          <IconChevronDown aria-hidden />
        </DsText>
      </DsLayoutInline>
    </div>
  );
}

export function getAccountEmailSelectRightSectionWidth(sources: AccountEmailOptionSource[]) {
  return sources.some((source) => source.kind !== 'provider') ? 132 : 48;
}

export { ProviderLogo as AccountEmailProviderLogo };

'use client';
import { SupportingText } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { IconUnlink } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import type { UserFull } from '@/lib/types/user/model';
import { InfoRow, InfoSection, providerLabel } from './shared';

export function UserSsoProvidersSection({
  auth,
  onRemoveProvider,
  isRemoveProviderPending,
}: {
  auth: UserFull['auth_details'];
  onRemoveProvider?: (provider: string, identifier: string) => boolean | Promise<boolean>;
  isRemoveProviderPending?: boolean;
}) {
  const tPage = useTranslations('adminUserDetail');
  const tCommonStates = useTranslations('common.states');
  const canRemoveProvider = Boolean(onRemoveProvider);

  return (
    <InfoSection title={tPage('auth.providers.title')} description={tPage('auth.providers.description')}>
      {auth?.providers.length ? (
        <DsLayoutStack gap="xs">
          {auth.providers.map((provider) => (
            <InfoRow key={`${provider.provider}:${provider.identifier}`} label={providerLabel(provider.provider)}>
              <DsLayoutInline justify="between" align="center" wrap="nowrap">
                <SupportingText tone="secondary">{tCommonStates('connected')}</SupportingText>
                {canRemoveProvider ? (
                  <Tooltip label={tPage('auth.providers.remove')}>
                    <IconButton
                      size="sm"
                      tone="danger"
                      loading={isRemoveProviderPending}
                      onClick={() => onRemoveProvider?.(provider.provider, provider.identifier)}
                      aria-label={tPage('auth.providers.remove')}
                    >
                      <IconUnlink size={15} />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </DsLayoutInline>
            </InfoRow>
          ))}
        </DsLayoutStack>
      ) : (
        <SupportingText tone="secondary">{tPage('auth.providers.empty')}</SupportingText>
      )}
    </InfoSection>
  );
}

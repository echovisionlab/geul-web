import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getSettings } from '@/lib/queries/manifest';
import { buildStaticOgMetadata } from '@/lib/utils/og';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { getBaseUrl } from '@/lib/utils/url.server';

export type AuthMetadataKey =
  | 'login'
  | 'loginFailed'
  | 'error'
  | 'verification'
  | 'recoverAccount'
  | 'cancelDeletion'
  | 'confirmDeletion'
  | 'confirmRecovery';

export async function buildAuthPageMetadata(key: AuthMetadataKey, path: string): Promise<Metadata> {
  const [t, tCommonActions, tCommonAuth, tLoginFailed] = await Promise.all([
    getTranslations(`auth.metadata.routes.${key}`),
    getTranslations('common.actions'),
    getTranslations('auth.common'),
    key === 'loginFailed' ? getTranslations('auth.loginFailed') : Promise.resolve(null),
  ]);
  const [settings, baseUrl] = await Promise.all([getSettings(), getBaseUrl()]);
  const siteName = settings.site_title || 'Site';
  const title =
    key === 'confirmDeletion'
      ? tCommonAuth('confirmDeletionTitle')
      : key === 'cancelDeletion'
        ? tCommonAuth('cancelDeletionTitle')
        : key === 'recoverAccount'
          ? tCommonActions('recoverAccount')
          : key === 'loginFailed'
            ? (tLoginFailed?.('states.loginFailed.title') ?? t('title'))
            : t('title');

  return withNoIndex(
    buildStaticOgMetadata({
      baseUrl,
      title,
      description: t('description', { siteName }),
      path,
      siteName,
    }),
  );
}

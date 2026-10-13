import { LayoutStack as DsLayoutStack, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/core/Button';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import type { PageDeniedReason } from '@/lib/queries/page';

export async function PageRestrictedAccess({ reason, returnTo }: { reason: PageDeniedReason; returnTo: string }) {
  const t = await getTranslations('pageEditor.access');
  const loginRequired = reason === 'authentication-required';
  return (
    <div style={{ minHeight: '60vh' }}>
      <DsLayoutInset space="md">
        <DsLayoutStack align="center" justify="center">
          <div style={{ maxWidth: 480 }}>
            <DsLayoutStack align="center" gap="sm">
              <DsHeading level={1} align="center">
                {t(loginRequired ? 'loginRequiredTitle' : 'restrictedTitle')}
              </DsHeading>
              <DsText size="sm" tone="secondary" align="center">
                {t(loginRequired ? 'loginRequiredDescription' : 'restrictedDescription')}
              </DsText>
              {loginRequired ? <Button href={buildLoginRedirectHref(returnTo)}>{t('signIn')}</Button> : null}
            </DsLayoutStack>
          </div>
        </DsLayoutStack>
      </DsLayoutInset>
    </div>
  );
}

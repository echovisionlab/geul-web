'use client';
import {
  LayoutContainer as DsLayoutContainer,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import { useActionState, useEffect, useId, useRef } from 'react';
import { IconCheck, IconRefresh } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { TextInput } from '@/components/core/Input';
import { RecoveryFormState, requestAccountRecoveryFormAction } from '@/lib/actions/account';
const initialState: RecoveryFormState = {
  success: false,
  message: '',
  submitted: false,
};
export function RecoverAccountContent({
  requestAction = requestAccountRecoveryFormAction,
}: { requestAction?: typeof requestAccountRecoveryFormAction } = {}) {
  const t = useTranslations('auth.recoverAccount');
  const tAuthCommon = useTranslations('auth.common');
  const tCommonActions = useTranslations('common.actions');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const [state, formAction, isPending] = useActionState(requestAction, initialState);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (state.submitted && state.success) {
      resultHeading.current?.focus();
    }
  }, [state.submitted, state.success]);
  if (state.submitted && state.success) {
    return (
      <DsLayoutInset space="md">
        <DsLayoutContainer size="form" inset="none">
          <DsLayoutStack align="center" gap="md">
            <DsHeading ref={resultHeading} tabIndex={-1} level={1} scale={2} align="center">
              {tAuthCommon('checkYourEmailTitle')}
            </DsHeading>
            <Alert icon={<IconCheck size="1em" aria-hidden />} tone="positive" role="status" aria-live="polite">
              {t('submitted.alert')}
            </Alert>
            <DsText size="sm" tone="secondary" align="center">
              {t('submitted.description')}
            </DsText>
            <DsLayoutStack gap="sm">
              <Button emphasis="medium" leftSection={<IconRefresh size="1em" aria-hidden />} href="/account/recover">
                {t('submitted.tryAnotherEmail')}
              </Button>
              <Button href="/" tone="neutral" emphasis="low">
                {tCommonActions('returnHome')}
              </Button>
            </DsLayoutStack>
          </DsLayoutStack>
        </DsLayoutContainer>
      </DsLayoutInset>
    );
  }
  return (
    <DsLayoutInset space="md">
      <DsLayoutContainer size="form" inset="none">
        <form action={formAction} aria-labelledby={titleId} aria-busy={isPending}>
          <DsLayoutStack gap="md">
            <DsHeading id={titleId} level={1} scale={2} align="center">
              {t('form.title')}
            </DsHeading>
            <DsText id={descriptionId} size="sm" tone="secondary" align="center">
              {t('form.description')}
            </DsText>

            <TextInput
              name="email"
              label={t('form.emailLabel')}
              placeholder={tCommonPlaceholders('emailExample')}
              type="email"
              autoComplete="email"
              aria-describedby={descriptionId}
              required
              disabled={isPending}
              error={!state.success && state.message ? state.message : undefined}
            />

            <Button type="submit" emphasis="strong" loading={isPending} fullWidth>
              {t('form.submit')}
            </Button>

            <Button href="/login" tone="neutral" emphasis="low" fullWidth>
              {tCommonActions('backToLogin')}
            </Button>
          </DsLayoutStack>
        </form>
      </DsLayoutContainer>
    </DsLayoutInset>
  );
}

'use client';
import { IconArrowLeft, IconRefresh, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { CopyButton } from '@/components/core/CopyButton';
import { Checkbox, MultiSelect, Select, TagsInput, TextInput } from '@/components/core/Input';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { SettingsGroup, SettingsSection } from '@/components/core/Section';
import { SupportingText, Text } from '@/components/core/Typography';
import { ConfirmationDialog } from '@/features/confirmation/ui/ConfirmationDialog';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import type {
  OAuthAppSecret,
  OAuthMemberCriteriaOption,
  OAuthSignInAppDraft,
  OAuthSignInScope,
  OAuthTokenLifespan,
} from './model';
import { SIGN_IN_ACCESS_VALUES, signInAccessValues, signInAccessChange } from './sign-in-access';
import { OAuthAppSecretDialog } from './OAuthAppSecretDialog';

export interface OAuthAppEditorViewProps {
  mode: 'create' | 'edit';
  draft: OAuthSignInAppDraft;
  /** Member criteria that can admit Members, with the ones the app links; the list restricted downloads use. */
  memberCriteria: OAuthMemberCriteriaOption[];
  createdAt?: string;
  saving?: boolean;
  saveError?: string | null;
  /** The pending secret command, so its button shows progress. */
  pendingCommand?: 'rotate' | 'delete' | null;
  secret?: OAuthAppSecret | null;
  backHref: string;
  onChange: (draft: OAuthSignInAppDraft) => void;
  onSave: () => void;
  onRotateSecret: () => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onCopySecret: (value: string) => void;
  onCloseSecret: () => void;
}

const LIFESPANS: OAuthTokenLifespan[] = ['5m', '15m', '1h'];
const SCOPES: OAuthSignInScope[] = ['email', 'profile'];

/** Create or edit an app that signs people in with their site account. */
export function OAuthAppEditorView({
  mode,
  draft,
  memberCriteria,
  createdAt,
  saving = false,
  saveError = null,
  pendingCommand = null,
  secret = null,
  backHref,
  onChange,
  onSave,
  onRotateSecret,
  onDelete,
  onCopySecret,
  onCloseSecret,
}: OAuthAppEditorViewProps) {
  const t = useTranslations('adminList.oauthApps');
  const tCommon = useTranslations('common');
  const formatter = useDateTimeFormatter();
  const [confirmation, setConfirmation] = useState<'rotate' | 'delete' | null>(null);
  const set = <K extends keyof OAuthSignInAppDraft>(key: K, value: OAuthSignInAppDraft[K]) =>
    onChange({ ...draft, [key]: value });
  const lifespanOptions = LIFESPANS.map((value) => ({ value, label: t(`lifespans.${value}`) }));
  const publicApp = draft.authMethod === 'none';
  const selectedAccess = signInAccessValues(draft.signInAccess, draft.memberCriteriaIds);

  return (
    <LayoutStack gap="xl">
      <AdminPageHeader
        title={mode === 'create' ? t('createTitle') : draft.name || t('untitled')}
        description={mode === 'edit' && createdAt ? t('createdAt', { date: formatter.date(createdAt) }) : undefined}
        items={[
          {
            key: 'back',
            type: 'action',
            label: tCommon('actions.back'),
            href: backHref,
            icon: <IconArrowLeft aria-hidden />,
          },
          {
            key: 'save',
            type: 'action',
            label: mode === 'create' ? t('createSubmit') : tCommon('actions.save'),
            onClick: onSave,
            loading: saving,
            disabled: draft.name.trim() === '' || draft.redirectUris.length === 0,
          },
        ]}
      />
      {saveError && (
        <Alert role="alert" tone="danger">
          {saveError}
        </Alert>
      )}

      <SettingsSection title={t('sections.basics')}>
        <TextInput
          label={tCommon('labels.name')}
          description={t('help.name')}
          value={draft.name}
          onChange={(event) => set('name', event.currentTarget.value)}
          required
        />
        {mode === 'create' ? (
          <TextInput
            label={t('fields.clientId')}
            description={t('help.clientIdCreate')}
            placeholder={t('placeholders.clientId')}
            value={draft.clientId}
            onChange={(event) => set('clientId', event.currentTarget.value)}
          />
        ) : (
          <LayoutStack gap="xxs">
            <Text weight="medium">{t('fields.clientId')}</Text>
            <LayoutInline gap="xs" align="center">
              <Text font="mono">{draft.clientId}</Text>
              <CopyButton value={draft.clientId} label={t('copyClientId')} copiedLabel={tCommon('actions.copied')} />
            </LayoutInline>
            <SupportingText>{t('help.clientIdFixed')}</SupportingText>
          </LayoutStack>
        )}
      </SettingsSection>

      <SettingsSection title={t('sections.signIn')} description={t('help.signIn')}>
        <MultiSelect
          label={t('fields.signInAccess')}
          description={t(`accessHelp.${draft.signInAccess}`)}
          value={selectedAccess}
          data={[
            { value: SIGN_IN_ACCESS_VALUES.none, label: t('access.none') },
            { value: SIGN_IN_ACCESS_VALUES.admins, label: t('access.admins') },
            { value: SIGN_IN_ACCESS_VALUES.members, label: t('access.members') },
            ...memberCriteria.map((criteria) => ({ value: criteria.id, label: criteria.name })),
          ]}
          searchable
          onChange={(values) => onChange({ ...draft, ...signInAccessChange(selectedAccess, values) })}
        />
        <TagsInput
          label={t('fields.redirectUris')}
          description={t('help.redirectUris')}
          placeholder={t('placeholders.redirectUri')}
          value={draft.redirectUris}
          onChange={(value) => set('redirectUris', value)}
          required
        />
        <TagsInput
          label={t('fields.postLogoutRedirectUris')}
          description={t('help.postLogoutRedirectUris')}
          placeholder={t('placeholders.redirectUri')}
          value={draft.postLogoutRedirectUris}
          onChange={(value) => set('postLogoutRedirectUris', value)}
        />
        <SettingsGroup title={t('fields.scopes')} description={t('help.scopes')}>
          <LayoutStack gap="xs">
            <Checkbox label={t('scopes.openid')} checked disabled />
            {SCOPES.map((scope) => (
              <Checkbox
                key={scope}
                label={t(`scopes.${scope}`)}
                checked={draft.scopes.includes(scope)}
                onChange={(event) =>
                  set(
                    'scopes',
                    event.currentTarget.checked
                      ? [...draft.scopes, scope]
                      : draft.scopes.filter((item) => item !== scope),
                  )
                }
              />
            ))}
          </LayoutStack>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection title={t('sections.tokens')} description={t('help.tokens')}>
        <Select
          label={t('fields.authMethod')}
          description={publicApp ? t('help.authMethodPublic') : t('help.authMethodSecret')}
          value={draft.authMethod}
          onChange={(value) => value && set('authMethod', value as OAuthSignInAppDraft['authMethod'])}
          data={[
            { value: 'client_secret_basic', label: t('authMethods.client_secret_basic') },
            { value: 'client_secret_post', label: t('authMethods.client_secret_post') },
            { value: 'none', label: t('authMethods.none') },
          ]}
          allowDeselect={false}
        />
        <LayoutInline gap="md" wrap="wrap">
          <Select
            label={t('fields.accessTokenLifespan')}
            value={draft.accessTokenLifespan}
            onChange={(value) => value && set('accessTokenLifespan', value as OAuthTokenLifespan)}
            data={lifespanOptions}
            allowDeselect={false}
          />
          <Select
            label={t('fields.idTokenLifespan')}
            value={draft.idTokenLifespan}
            onChange={(value) => value && set('idTokenLifespan', value as OAuthTokenLifespan)}
            data={lifespanOptions}
            allowDeselect={false}
          />
        </LayoutInline>
      </SettingsSection>

      {mode === 'edit' && (
        <SettingsSection title={t('sections.manage')}>
          <LayoutInline gap="sm" wrap="wrap">
            {!publicApp && (
              <Button
                leftSection={<IconRefresh aria-hidden />}
                loading={pendingCommand === 'rotate'}
                onClick={() => setConfirmation('rotate')}
              >
                {t('rotateSecret')}
              </Button>
            )}
            <Button
              tone="danger"
              leftSection={<IconTrash aria-hidden />}
              loading={pendingCommand === 'delete'}
              onClick={() => setConfirmation('delete')}
            >
              {t('delete')}
            </Button>
          </LayoutInline>
          <SupportingText>{t('help.manage')}</SupportingText>
        </SettingsSection>
      )}

      <ConfirmationDialog
        intent={confirmation === 'rotate' ? 'regenerate' : 'delete'}
        opened={confirmation !== null}
        onClose={() => setConfirmation(null)}
        onConfirm={async () => {
          const done = confirmation === 'rotate' ? await onRotateSecret() : await onDelete();
          if (done) {
            setConfirmation(null);
          }
        }}
        title={confirmation === 'rotate' ? t('rotateTitle') : t('deleteTitle')}
        message={
          <Text>{confirmation === 'rotate' ? t('rotateConfirm') : t('deleteConfirm', { name: draft.name })}</Text>
        }
        confirmLabel={confirmation === 'rotate' ? t('rotateSecret') : t('delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={pendingCommand !== null}
      />
      <OAuthAppSecretDialog secret={secret} onCopy={onCopySecret} onClose={onCloseSecret} />
    </LayoutStack>
  );
}

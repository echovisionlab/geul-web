import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { localizeFixtureTree, useStorybookText } from '../../.storybook/fixture-i18n';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { TextInput } from '@/components/core/Input';
import { ConfirmModal } from '@/components/core/Modal/ConfirmModal';
import { FormModal } from '@/components/core/Modal/FormModal';
import { PageHeader } from '@/components/core/PageHeader';
import { Tabs } from '@/components/core/Tabs';
import { AccountEmailSettingsView } from '@/features/my/ui/AccountEmailSettings';
import {
  ProfileFormView,
  type ProfileFormInitialValues,
  type ProfileFormViewLabels,
} from '@/features/my/ui/ProfileForm';
import { SessionManagementView, type SessionManagementItem } from '@/features/my/ui/SessionManagement';
import { SettingsFormView } from '@/features/my/ui/SettingsForm';
import { PreviewFrame, type PreviewState } from './PreviewFrame';

const initialProfile: ProfileFormInitialValues = {
  uid: 'preview-member-01',
  nickname: 'June Han',
  bio: 'Sound artist and independent curator.',
  website: 'https://june.example.com',
  socialLinks: [{ key: 'github', platform: 'github', value: 'https://github.com/june' }],
};
const profileLabels: ProfileFormViewLabels = {
  uid: 'UID',
  copyUid: 'Copy UID',
  copiedUid: 'UID copied',
  nickname: 'Nickname',
  nicknamePlaceholder: 'Choose a nickname',
  bio: 'Bio',
  bioPlaceholder: 'Tell us about yourself',
  website: 'Website',
  websitePlaceholder: 'https://example.com',
  socialLinks: 'Social links',
  addSocialLink: 'Add link',
  socialPlatform: 'Platform',
  socialValue: 'URL or username',
  removeSocialLink: (index) => `Remove social link ${index}`,
  reorderSocialLink: (index) => `Reorder social link ${index}`,
  reorderInstructions: 'Use the Up and Down arrow keys to change this link’s position.',
  positionChanged: (position, count) => `Link moved to position ${position} of ${count}.`,
  submit: 'Update profile',
};
const initialSessions: SessionManagementItem[] = [
  {
    id: 'current',
    active: true,
    authenticatedAt: '2026-10-10T00:00:00Z',
    device: { ipAddress: '192.0.2.10', userAgent: 'Mozilla/5.0 (Mac OS) Chrome/140.0' },
  },
  {
    id: 'phone',
    active: true,
    authenticatedAt: '2026-10-09T00:00:00Z',
    device: { ipAddress: '192.0.2.20', userAgent: 'Mozilla/5.0 (iPhone) Mobile Safari/605.1' },
  },
];

export function AccountPreview({
  state = 'ready',
  initialTab = 'profile',
}: {
  state?: PreviewState;
  initialTab?: 'profile' | 'security' | 'newsletter';
}) {
  const fixtureText = useStorybookText();
  const locale = useLocale();
  const tSocialLinks = useTranslations('socialLinks');
  const [tab, setTab] = useState<string | null>(initialTab);
  const [profile, setProfile] = useState(initialProfile);
  const [savedRevision, setSavedRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const [subscribed, setSubscribed] = useState(true);
  const [email, setEmail] = useState('june@example.com');
  const [draftEmail, setDraftEmail] = useState(email);
  const [emailDialog, setEmailDialog] = useState(false);
  const [sessions, setSessions] = useState(initialSessions);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const ready = state === 'ready';
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draftEmail);
  return localizeFixtureTree(
    <PreviewFrame
      title="Pages · account settings"
      description="The production account views share this local fixture. Edit and save a profile, change the email, toggle subscriptions, or confirm a session revocation. Reset by remounting the story."
    >
      <PageHeader title="Account" description="Profile, security, and email preferences" />
      {notice ? (
        <Alert tone="positive" role="status" aria-live="polite">
          {notice}
        </Alert>
      ) : null}
      <Tabs
        value={tab}
        onChange={(value) => {
          setTab(value);
          setNotice('');
        }}
      >
        <Tabs.List aria-label="Account settings">
          <Tabs.Tab value="profile">Profile</Tabs.Tab>
          <Tabs.Tab value="security">Security</Tabs.Tab>
          <Tabs.Tab value="newsletter">Email preferences</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="profile" paddingTop="lg">
          <ProfileFormView
            initialValues={profile}
            savedRevision={savedRevision}
            labels={{
              ...profileLabels,
              removeSocialLink: (index) => `${fixtureText('Remove')} ${fixtureText('Social links')} ${index}`,
              reorderSocialLink: (index) => `${fixtureText('Order')} ${fixtureText('Social links')} ${index}`,
              reorderInstructions: tSocialLinks('reorderInstructions'),
              positionChanged: (position, count) => tSocialLinks('positionChanged', { position, count }),
            }}
            platformOptions={[
              { value: 'github', label: 'GitHub', placeholder: 'https://github.com/username' },
              { value: 'bandcamp', label: 'Bandcamp', placeholder: 'https://artist.bandcamp.com' },
            ]}
            showExtendedFields
            pending={state === 'pending'}
            disabled={state === 'disabled'}
            errors={state === 'error' ? { form: 'The profile could not be saved. Your edits are preserved.' } : {}}
            events={{
              onNicknameChange: () => setNotice(''),
              onNormalizeSocialLink: (_platform, value) => value.trim(),
              onSubmit: (values) => {
                if (ready) {
                  setProfile({ ...values, uid: profile.uid });
                  setSavedRevision((revision) => revision + 1);
                  setNotice(`${fixtureText('Profile saved')}: ${values.nickname}`);
                }
              },
            }}
          />
        </Tabs.Panel>
        <Tabs.Panel value="security" paddingTop="lg">
          <fieldset disabled={state === 'disabled'} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <DsLayoutStack gap="xl">
              <DsLayoutStack gap="sm">
                <AccountEmailSettingsView
                  email={email}
                  emailCodeAvailable
                  labels={{
                    canonical: 'Primary email',
                    change: 'Change email',
                    emailCode: 'Email verification',
                    title: 'Account email',
                  }}
                  onChangeEmail={() => {
                    setDraftEmail(email);
                    setEmailDialog(true);
                  }}
                />
              </DsLayoutStack>
              {state === 'error' ? (
                <Alert tone="danger" role="alert">
                  The security change could not be saved.
                </Alert>
              ) : null}
              <DsLayoutStack gap="sm">
                <SessionManagementView
                  currentSessionId="current"
                  locale={locale}
                  sessions={sessions}
                  revokingSessionId={state === 'pending' ? 'phone' : null}
                  revokeOthersLoading={state === 'pending'}
                  labels={{
                    activeNow: 'Active now',
                    browser: (value) => value,
                    device: (value) => fixtureText(value ? value[0].toUpperCase() + value.slice(1) : value),
                    os: (value) => value,
                    logOutOthers: 'Log out other devices',
                    revoke: 'Revoke session',
                    thisDevice: 'This device',
                    title: 'Active sessions',
                  }}
                  onRevokeSession={(id) => setRevokeTarget(id)}
                  onRevokeOtherSessions={() => setRevokeTarget('others')}
                />
              </DsLayoutStack>
            </DsLayoutStack>
          </fieldset>
        </Tabs.Panel>
        <Tabs.Panel value="newsletter" paddingTop="lg">
          <SettingsFormView
            subscribed={subscribed}
            pending={state === 'pending'}
            disabled={state === 'disabled'}
            error={state === 'error' ? 'Preferences could not be saved. Try again.' : null}
            labels={{
              subscribedAlert: 'You are subscribed to the newsletter.',
              unsubscribedAlert: 'You are not subscribed to the newsletter.',
              subscribe: 'Subscribe to newsletter',
              unsubscribe: 'Unsubscribe from emails',
              footer: 'Security and legal notices are always sent.',
              errorTitle: 'Could not save preference',
            }}
            events={{
              onSubscriptionChange: (value) => {
                if (ready) {
                  setSubscribed(value);
                  setNotice('Email preference saved.');
                }
              },
            }}
          />
        </Tabs.Panel>
      </Tabs>
      <FormModal
        opened={emailDialog}
        onClose={() => setEmailDialog(false)}
        title="Change account email"
        closeLabel="Close email dialog"
        submitLabel="Save email"
        cancelLabel="Cancel"
        loading={state === 'pending'}
        submitDisabled={!emailValid || !ready}
        onSubmit={() => {
          setEmail(draftEmail.trim());
          setEmailDialog(false);
          setNotice('Account email saved.');
        }}
      >
        <TextInput
          label="New email"
          type="email"
          value={draftEmail}
          onChange={(event) => setDraftEmail(event.currentTarget.value)}
          disabled={state === 'disabled' || state === 'pending'}
          error={draftEmail && !emailValid ? 'Enter a valid email address.' : undefined}
        />
        <DsText size="sm" tone="secondary">
          This preview stores the new address locally.
        </DsText>
      </FormModal>
      <ConfirmModal
        opened={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        title="Revoke sessions"
        message="The selected preview sessions will be removed from this list."
        confirmLabel="Revoke"
        cancelLabel="Cancel"
        closeLabel="Close session dialog"
        confirmDisabled={!ready}
        loading={state === 'pending'}
        onConfirm={() => {
          setSessions((items) =>
            items.filter((session) =>
              revokeTarget === 'others' ? session.id === 'current' : session.id !== revokeTarget,
            ),
          );
          setRevokeTarget(null);
          setNotice('Sessions revoked.');
        }}
      />
    </PreviewFrame>,
    fixtureText,
  );
}

import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { LayoutContainer, LayoutInset } from '@/components/core/Layout';
import type {
  OAuthAppSecret,
  OAuthConnectionDetail,
  OAuthConnectionSummary,
  OAuthSignInAppDraft,
  OAuthSignInAppSummary,
} from '@/features/admin/oauth-app/model';
import { OAuthAppEditorView } from '@/features/admin/oauth-app/OAuthAppEditorView';
import { OAuthAppListView } from '@/features/admin/oauth-app/OAuthAppListView';
import { OAuthConnectionDetailView } from '@/features/admin/oauth-app/OAuthConnectionDetailView';
import { navigatePreview } from '../shared/preview-navigation';

const apps: OAuthSignInAppSummary[] = [
  {
    clientId: 'rawsector-monitor',
    name: 'rawsector monitor',
    signInAccess: 'admins',
    memberCriteria: [],
    redirectHosts: ['monitor.rawsector.com'],
    createdAt: '2026-10-22T09:00:00Z',
  },
  {
    clientId: 'dsub-nextcloud',
    name: 'DSUB Storage',
    signInAccess: 'none',
    memberCriteria: [],
    redirectHosts: ['storage.dsub.io'],
    createdAt: '2026-04-29T09:00:00Z',
  },
  {
    clientId: '6f1c2a0e-3b8d-4c55-9a1e-2d7f0b9c4e11',
    name: 'Partner portal',
    signInAccess: 'memberCriteria',
    memberCriteria: [
      { id: 'a3f6c1d2-0b4e-4f7a-9c8d-1e2f3a4b5c6d', name: 'Beta testers' },
      { id: 'b7e8f9a0-1c2d-4e3f-8a9b-0c1d2e3f4a5b', name: 'Label partners' },
    ],
    redirectHosts: ['partners.example.com'],
    createdAt: '2026-11-03T09:00:00Z',
  },
];

const memberCriteria = [
  { id: 'a3f6c1d2-0b4e-4f7a-9c8d-1e2f3a4b5c6d', name: 'Beta testers' },
  { id: 'b7e8f9a0-1c2d-4e3f-8a9b-0c1d2e3f4a5b', name: 'Label partners' },
  { id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f', name: 'Authors' },
];

const connections: OAuthConnectionSummary[] = [
  {
    clientId: 'https://claude.ai/oauth/mcp-oauth-client-metadata',
    name: 'Claude',
    publisher: 'claude.ai',
    stale: false,
    createdAt: '2026-10-29T09:00:00Z',
  },
  {
    clientId: 'https://claude.ai/oauth/claude-code-client-metadata',
    name: 'Claude Code',
    publisher: 'claude.ai',
    stale: false,
    createdAt: '2026-10-20T09:00:00Z',
  },
  {
    clientId: 'https://chatgpt.com/oauth/codex/MZ-2hK1JE6a8/client.json',
    name: 'Codex',
    publisher: 'chatgpt.com',
    stale: false,
    createdAt: '2026-10-18T09:00:00Z',
  },
  {
    clientId: 'https://chatgpt.com/oauth/jZFXMdgqmRMp/client.json',
    name: 'ChatGPT',
    publisher: 'chatgpt.com',
    stale: false,
    createdAt: '2026-10-16T09:00:00Z',
  },
  {
    clientId: 'e9ee87eb-f91d-4053-b31a-41b43a47af8e',
    name: 'Codex',
    publisher: null,
    stale: true,
    createdAt: '2026-10-03T09:00:00Z',
  },
  {
    clientId: 'a1aeeb96-4f6f-4497-b764-8c3f7a8ace26',
    name: 'Codex',
    publisher: null,
    stale: true,
    createdAt: '2026-10-03T09:00:00Z',
  },
  {
    clientId: 'https://chatgpt.com/oauth/c7hoSZ6l1glr/client.json',
    name: 'ChatGPT',
    publisher: 'chatgpt.com',
    stale: true,
    createdAt: '2026-08-26T09:00:00Z',
  },
];

const monitorDraft: OAuthSignInAppDraft = {
  name: 'rawsector monitor',
  clientId: 'rawsector-monitor',
  signInAccess: 'admins',
  memberCriteriaIds: [],
  redirectUris: ['https://monitor.rawsector.com/login/generic_oauth'],
  postLogoutRedirectUris: [],
  scopes: ['email', 'profile'],
  authMethod: 'client_secret_basic',
  accessTokenLifespan: '15m',
  idTokenLifespan: '15m',
};

const emptyDraft: OAuthSignInAppDraft = {
  name: '',
  clientId: '',
  signInAccess: 'admins',
  memberCriteriaIds: [],
  redirectUris: [],
  postLogoutRedirectUris: [],
  scopes: ['email', 'profile'],
  authMethod: 'client_secret_basic',
  accessTokenLifespan: '15m',
  idTokenLifespan: '15m',
};

const staleConnection: OAuthConnectionDetail = {
  ...connections[6],
  redirectUris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
  resource: 'https://www.dsub.io/mcp',
  authMethod: 'private_key_jwt',
};

const issuedSecret: OAuthAppSecret = { clientId: 'grafana-staging', value: 'cs_7Qm2yVfK9pXr4LwT8nZs1HbD3cGe6JaU' };

type PreviewScreen =
  'list' | 'list-empty' | 'list-failed' | 'create' | 'edit' | 'edit-member-criteria' | 'secret' | 'connection';

/** Local state for the production views; no server, permission or Hydra call is made. */
export function OAuthAppsPreview({ screen = 'list' }: { screen?: PreviewScreen }) {
  const [draft, setDraft] = useState(
    screen === 'create'
      ? emptyDraft
      : screen === 'edit-member-criteria'
        ? {
            ...monitorDraft,
            name: 'Partner portal',
            clientId: apps[2].clientId,
            signInAccess: 'memberCriteria' as const,
            memberCriteriaIds: [memberCriteria[0].id, memberCriteria[1].id],
          }
        : monitorDraft,
  );
  const [secret, setSecret] = useState<OAuthAppSecret | null>(screen === 'secret' ? issuedSecret : null);
  const content = (() => {
    switch (screen) {
      case 'list':
      case 'list-empty':
      case 'list-failed':
        return (
          <OAuthAppListView
            siteName="Quiet Signal"
            apps={screen === 'list' ? apps : []}
            connections={screen === 'list' ? connections : []}
            loadFailed={screen === 'list-failed'}
            createHref="/admin/oauth-apps/new"
            getAppHref={(id) => `/admin/oauth-apps/${encodeURIComponent(id)}`}
            getConnectionHref={(id) => `/admin/oauth-apps/connections/${encodeURIComponent(id)}`}
            onOpen={navigatePreview}
            onDisconnect={() => undefined}
          />
        );
      case 'connection':
        return (
          <OAuthConnectionDetailView
            connection={staleConnection}
            backHref="/admin/oauth-apps"
            onDisconnect={async () => true}
          />
        );
      default:
        return (
          <OAuthAppEditorView
            mode={screen === 'create' ? 'create' : 'edit'}
            memberCriteria={memberCriteria}
            draft={
              screen === 'secret' ? { ...emptyDraft, name: 'Grafana staging', clientId: 'grafana-staging' } : draft
            }
            createdAt="2026-10-22T09:00:00Z"
            secret={secret}
            backHref="/admin/oauth-apps"
            onChange={setDraft}
            onSave={() => (screen === 'create' ? setSecret(issuedSecret) : undefined)}
            onRotateSecret={async () => {
              setSecret({ clientId: draft.clientId, value: issuedSecret.value });
              return true;
            }}
            onDelete={async () => true}
            onCopySecret={() => undefined}
            onCloseSecret={() => setSecret(null)}
          />
        );
    }
  })();
  return (
    <LayoutContainer size="wide">
      <LayoutInset block="lg">{content}</LayoutInset>
    </LayoutContainer>
  );
}

const meta = {
  title: 'Pages/Admin/OAuth Apps',
  excludeStories: ['OAuthAppsPreview'],
  component: OAuthAppsPreview,
  args: { screen: 'list' },
  render: (args) => <OAuthAppsPreview key={args.screen} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/admin/oauth-apps' } },
    docs: {
      description: {
        component:
          'Production OAuth app views for /admin/oauth-apps with fixtures taken from the live client list (secrets omitted). Sign-in app list, create/edit form, one-time secret dialog and the read-only connected AI tool detail. Saving, secret issuing, re-authentication, Admin permission and Hydra calls are outside the preview.',
      },
    },
  },
} satisfies Meta<typeof OAuthAppsPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const List: Story = {};
export const ListEmpty: Story = { args: { screen: 'list-empty' } };
export const ListLoadFailed: Story = { args: { screen: 'list-failed' } };
export const Create: Story = { args: { screen: 'create' } };
export const Edit: Story = { args: { screen: 'edit' } };
export const EditMemberCriteriaAccess: Story = { args: { screen: 'edit-member-criteria' } };
export const SecretIssued: Story = { args: { screen: 'secret' } };
export const StaleConnection: Story = { args: { screen: 'connection' } };
export const PhoneList: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/render';
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { DEFAULT_SITE_SETTINGS_VIEW } from '@/lib/types/site-setting/config';
import { rememberPasskeySecurityContinuation } from '@/features/auth/security-reauthentication';
import type { SettingsFlow } from '@/features/auth/settings-flow';
import { getPasskeyItems, PasskeySettingsSection } from './PasskeySettingsSection';
const navigation = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  searchParams: new URLSearchParams(),
  reauthenticate: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => navigation.router,
  useSearchParams: () => navigation.searchParams,
}));
vi.mock('@/features/auth/login-redirect', () => ({ startPrivilegedReauthentication: navigation.reauthenticate }));
vi.mock('@/lib/public-runtime-config', () => ({ getPublicAuthUrl: () => '/api/auth' }));
const creationOptions = {
  publicKey: {
    challenge: 'Y2hhbGxlbmdl',
    rp: { id: 'site.example', name: 'Old site name' },
    user: { id: 'dXNlcg', name: 'John Doe', displayName: 'John Doe' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    excludeCredentials: [{ type: 'public-key', id: 'ZXhpc3Rpbmc' }],
    extensions: { credProps: true },
    attestation: 'none',
    timeout: 60000,
  },
};
const flow: SettingsFlow = {
  id: 'settings-flow',
  ui: {
    nodes: [
      { type: 'input', group: 'default', attributes: { name: 'csrf_token', type: 'hidden', value: 'csrf-token' } },
      {
        type: 'input',
        group: 'passkey',
        attributes: {
          name: 'passkey_register_trigger',
          type: 'button',
          onclickTrigger: 'oryPasskeySettingsRegistration',
        },
      },
      { type: 'input', group: 'passkey', attributes: { name: 'passkey_settings_register', type: 'hidden', value: '' } },
      {
        type: 'input',
        group: 'passkey',
        attributes: { name: 'passkey_create_data', type: 'hidden', value: JSON.stringify(creationOptions) },
      },
      {
        type: 'script',
        group: 'passkey',
        attributes: { id: 'webauthn_script', src: '/api/auth/.well-known/ory/webauthn.js' },
      },
    ],
  },
};
const removalFlow: SettingsFlow = {
  id: 'settings-flow',
  ui: {
    nodes: [
      flow.ui!.nodes![0],
      {
        type: 'input',
        group: 'passkey',
        attributes: { name: 'passkey_remove', type: 'submit', value: 'key-one' },
        meta: {
          label: {
            text: 'MacBook Touch ID',
            context: { display_name: 'MacBook Touch ID', added_at: '2026-07-20T10:00:00Z' },
          },
        },
      },
      {
        type: 'input',
        group: 'passkey',
        attributes: { name: 'passkey_remove', type: 'submit', value: 'key-two', disabled: true },
        meta: { label: { context: { display_name: 'YubiKey 5 NFC' } } },
      },
    ],
  },
};
const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
let credentials: PropertyDescriptor | undefined;
beforeEach(() => {
  credentials = Object.getOwnPropertyDescriptor(navigator, 'credentials');
  navigation.searchParams = new URLSearchParams();
  vi.clearAllMocks();
  sessionStorage.clear();
});
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__oryWebAuthnInitialized;
  delete (window as unknown as Record<string, unknown>).oryPasskeySettingsRegistration;
  // External Kratos runtime script, outside the rendered React tree.
  // eslint-disable-next-line testing-library/no-node-access
  document.getElementById('webauthn_script')?.remove();
  if (credentials) {
    Object.defineProperty(navigator, 'credentials', credentials);
  } else {
    Reflect.deleteProperty(navigator, 'credentials');
  }
  vi.unstubAllGlobals();
});
function site(title: string, requestFlow?: React.ComponentProps<typeof PasskeySettingsSection>['requestFlow']) {
  return (
    <ManifestProvider
      manifest={{
        settings: {
          ...DEFAULT_SITE_SETTINGS_VIEW,
          site_title: title,
          favicon_asset_set: null,
          site_og_image_url: null,
        },
        menus: { $typeName: 'api.open.v1.Menus', header: [], secondary: [], footer: [], avatarDropdown: [] },
      }}
    >
      <PasskeySettingsSection subjectId="member-1" requestFlow={requestFlow} />
    </ManifestProvider>
  );
}
describe('PasskeySettingsSection', () => {
  it('preserves authoritative passkey labels, dates and disabled guards', () => {
    expect(getPasskeyItems(removalFlow)).toEqual([
      { id: 'key-one', displayName: 'MacBook Touch ID', addedAt: '2026-07-20T10:00:00Z', disabled: false },
      { id: 'key-two', displayName: 'YubiKey 5 NFC', addedAt: null, disabled: true },
    ]);
  });
  it('uses the current site name and keeps a cancelled ceremony retryable', async () => {
    let cancel!: (reason: unknown) => void;
    const createCredential = vi.fn(
      (_options?: CredentialCreationOptions) =>
        new Promise<Credential | null>((_resolve, reject) => {
          cancel = reject;
        }),
    );
    vi.stubGlobal('PublicKeyCredential', class {});
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: { create: createCredential } });
    (window as unknown as Record<string, unknown>).__oryWebAuthnInitialized = true;
    (window as unknown as Record<string, unknown>).oryPasskeySettingsRegistration = () => {
      const button = screen.getByRole('button', { name: 'Add passkey' }) as HTMLButtonElement;
      const data = new FormData(button.form!);
      void navigator.credentials.create(JSON.parse(String(data.get('passkey_create_data')))).catch(() => {});
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce({ flow })
      .mockResolvedValue({ flow: { ...flow, id: 'fresh-flow' } });
    const { user, rerender } = render(site('rawsector', request));
    const add = await screen.findByRole('button', { name: 'Add passkey' });
    await waitFor(() => expect(add).toBeEnabled());
    expect(
      JSON.parse(String(new FormData((add as HTMLButtonElement).form!).get('passkey_create_data'))).publicKey.rp,
    ).toEqual({ id: 'site.example', name: 'rawsector' });
    rerender(site('Example Studio', request));
    await user.click(add);
    await waitFor(() => expect(createCredential).toHaveBeenCalledOnce());
    expect(createCredential.mock.calls[0][0]).toEqual({
      publicKey: { ...creationOptions.publicKey, rp: { id: 'site.example', name: 'Example Studio' } },
    });
    expect(add).toHaveAttribute('aria-busy', 'true');
    await act(async () => cancel(new DOMException('Cancelled', 'NotAllowedError')));
    expect(await screen.findByText('Passkeys are not available in this browser.')).toBeVisible();
    await waitFor(() => expect(add).toBeEnabled());
    expect(add).not.toHaveAttribute('aria-busy', 'true');
  });
  it('resumes removal of the exact passkey after reauthentication', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    const request = vi
      .fn()
      .mockResolvedValueOnce({ flow: removalFlow })
      .mockResolvedValue({ flow: { id: 'after-removal', ui: { nodes: [flow.ui!.nodes![0]] } } });
    rememberPasskeySecurityContinuation({ action: 'remove_passkey', id: 'key-one' }, 'member-1');
    navigation.searchParams = new URLSearchParams('resume_passkey_security_action=1');
    render(site('Site', request));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      method: 'passkey',
      passkey_remove: 'key-one',
      csrf_token: 'csrf-token',
    });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });
  it('separates initial loading, failed load and empty results', async () => {
    let reject!: (reason: unknown) => void;
    const request = vi.fn(
      () =>
        new Promise<{ flowId: string; csrfToken: string; flow: SettingsFlow }>((_resolve, fail) => {
          reject = fail;
        }),
    );
    render(site('Site', request));
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    await act(async () => reject(new Error('offline')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load passkeys.');
    expect(screen.queryByText('No passkeys registered.')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

it('ends runtime preparation with an unavailable error instead of an indefinite add spinner', async () => {
  const request = vi.fn().mockResolvedValue({ flow });
  render(site('Site', request));
  expect(await screen.findByText('Passkeys are not available in this browser.')).toBeVisible();
  const add = screen.getByRole('button', { name: 'Add passkey' });
  expect(add).toBeDisabled();
  expect(add).not.toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByText('No passkeys registered.')).not.toBeInTheDocument();
});

// @vitest-environment jsdom

import { act, createElement, type ComponentType, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import type { SettingsFlow } from '@/features/auth/settings-flow';
import { rememberPasskeySecurityContinuation } from '@/features/auth/security-reauthentication';
import enMessages from '@/messages/en.json';
import { getPasskeyItems, PasskeySettingsSection } from './PasskeySettingsSection';

const navigationMock = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  searchParams: new URLSearchParams(),
}));

const reauthenticationMock = vi.hoisted(() => ({
  startPrivilegedReauthentication: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigationMock.router,
  useSearchParams: () => navigationMock.searchParams,
}));

vi.mock('@/features/auth/login-redirect', () => ({
  startPrivilegedReauthentication: reauthenticationMock.startPrivilegedReauthentication,
}));

const TestIntlProvider = NextIntlClientProvider as ComponentType<{
  children?: ReactNode;
  locale: string;
  messages: typeof enMessages;
}>;

vi.mock('@/lib/public-runtime-config', () => ({
  getPublicAuthUrl: () => '/api/auth',
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

let container: HTMLDivElement;
let root: Root;
let credentialsDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  credentialsDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'credentials');
  navigationMock.router.replace.mockReset();
  navigationMock.searchParams = new URLSearchParams();
  reauthenticationMock.startPrivilegedReauthentication.mockReset();
  window.sessionStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete (window as unknown as Record<string, unknown>).__oryWebAuthnInitialized;
  delete (window as unknown as Record<string, unknown>).oryPasskeySettingsRegistration;
  document.getElementById('webauthn_script')?.remove();
  if (credentialsDescriptor) {
    Object.defineProperty(window.navigator, 'credentials', credentialsDescriptor);
  } else {
    Reflect.deleteProperty(window.navigator, 'credentials');
  }
  vi.unstubAllGlobals();
});

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getPasskeyItems', () => {
  it('projects every Kratos removal node and preserves its authoritative disabled guard', () => {
    const flow: SettingsFlow = {
      id: 'settings-flow',
      ui: {
        nodes: [
          {
            type: 'input',
            group: 'passkey',
            attributes: {
              name: 'passkey_remove',
              value: 'key-one',
              type: 'submit',
              disabled: false,
            },
            meta: {
              label: {
                text: 'Remove passkey "MacBook Touch ID"',
                context: {
                  display_name: 'MacBook Touch ID',
                  added_at: '2026-07-20T10:00:00Z',
                },
              },
            },
          },
          {
            type: 'input',
            group: 'passkey',
            attributes: {
              name: 'passkey_remove',
              value: 'key-two',
              type: 'submit',
              disabled: true,
            },
            meta: {
              label: {
                context: {
                  display_name: 'YubiKey 5 NFC',
                },
              },
            },
          },
        ],
      },
    };

    expect(getPasskeyItems(flow)).toEqual([
      {
        id: 'key-one',
        displayName: 'MacBook Touch ID',
        addedAt: '2026-07-20T10:00:00Z',
        disabled: false,
      },
      {
        id: 'key-two',
        displayName: 'YubiKey 5 NFC',
        addedAt: null,
        disabled: true,
      },
    ]);
  });

  it('surfaces a cancelled settings add ceremony and leaves passkey registration retryable', async () => {
    const settingsFlow: SettingsFlow = {
      id: 'settings-flow',
      ui: {
        nodes: [
          {
            type: 'input',
            group: 'default',
            attributes: { name: 'csrf_token', type: 'hidden', value: 'csrf-token' },
          },
          {
            type: 'input',
            group: 'passkey',
            attributes: {
              name: 'passkey_register_trigger',
              type: 'button',
              onclickTrigger: 'oryPasskeySettingsRegistration',
            },
          },
          {
            type: 'input',
            group: 'passkey',
            attributes: { name: 'passkey_settings_register', type: 'hidden', value: '' },
          },
          {
            type: 'input',
            group: 'passkey',
            attributes: { name: 'passkey_create_data', type: 'hidden', value: '{}' },
          },
          {
            type: 'script',
            group: 'passkey',
            attributes: {
              id: 'webauthn_script',
              src: '/api/auth/.well-known/ory/webauthn.js',
            },
          },
        ],
      },
    };
    const cancellation = new DOMException('The operation was cancelled.', 'NotAllowedError');
    const credentialCreate = vi.fn(() => Promise.reject(cancellation));
    vi.stubGlobal('PublicKeyCredential', class PublicKeyCredentialMock {});
    Object.defineProperty(window.navigator, 'credentials', {
      configurable: true,
      value: { create: credentialCreate },
    });
    (window as unknown as Record<string, unknown>).__oryWebAuthnInitialized = true;
    (window as unknown as Record<string, unknown>).oryPasskeySettingsRegistration = () => {
      window.navigator.credentials
        .create({
          publicKey: {
            challenge: new Uint8Array(),
            rp: { name: 'Geul' },
            user: { id: new Uint8Array(), name: 'John Doe', displayName: 'John Doe' },
            pubKeyCredParams: [],
          },
        })
        .catch(() => undefined);
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(settingsFlow))
        .mockResolvedValueOnce(jsonResponse({ ...settingsFlow, id: 'fresh-settings-flow' })),
    );

    await act(async () => {
      root.render(
        createElement(
          TestIntlProvider,
          { locale: 'en', messages: enMessages },
          createElement(MantineProvider, null, createElement(PasskeySettingsSection, { subjectId: 'member-1' })),
        ),
      );
    });
    await flush();

    const addButton = document.querySelector<HTMLButtonElement>('[data-testid="security-add-passkey"]');
    expect(addButton?.disabled).toBe(false);
    await act(async () => {
      addButton?.click();
      await Promise.resolve();
    });
    await flush();

    expect(credentialCreate).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain(enMessages.security.passkeys.errors.unsupported);
    expect(addButton?.disabled).toBe(false);
  });

  it('automatically resumes removal of the exact passkey after reauthentication', async () => {
    const flowWithPasskey: SettingsFlow = {
      id: 'settings-flow',
      ui: {
        nodes: [
          {
            type: 'input',
            group: 'default',
            attributes: { name: 'csrf_token', type: 'hidden', value: 'csrf-token' },
          },
          {
            type: 'input',
            group: 'passkey',
            attributes: {
              name: 'passkey_remove',
              type: 'submit',
              value: 'passkey-to-remove',
            },
            meta: { label: { text: 'MacBook Touch ID' } },
          },
        ],
      },
    };
    const flowWithoutPasskey: SettingsFlow = {
      id: 'settings-flow-after-remove',
      ui: {
        nodes: [
          {
            type: 'input',
            group: 'default',
            attributes: { name: 'csrf_token', type: 'hidden', value: 'next-csrf-token' },
          },
        ],
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(flowWithPasskey))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse(flowWithoutPasskey));
    vi.stubGlobal('fetch', fetchMock);
    rememberPasskeySecurityContinuation({ action: 'remove_passkey', id: 'passkey-to-remove' }, 'member-1');
    navigationMock.searchParams = new URLSearchParams('resume_passkey_security_action=1');

    await act(async () => {
      root.render(
        createElement(
          TestIntlProvider,
          { locale: 'en', messages: enMessages },
          createElement(MantineProvider, null, createElement(PasskeySettingsSection, { subjectId: 'member-1' })),
        ),
      );
    });
    await flush();
    await flush();

    const removeRequest = fetchMock.mock.calls.find((call) => (call[1] as RequestInit | undefined)?.method === 'POST');
    expect(removeRequest?.[0]).toContain('/self-service/settings?flow=settings-flow');
    expect(JSON.parse(String((removeRequest?.[1] as RequestInit).body))).toMatchObject({
      method: 'passkey',
      passkey_remove: 'passkey-to-remove',
      csrf_token: 'csrf-token',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  findKratosNodes,
  getKratosFlowErrors,
  getKratosNodeStringValue,
  getSecureAccountLinkingContext,
  invokeKratosBrowserCeremony,
  invokeKratosBrowserTrigger,
  type KratosBrowserFlow,
} from './kratos-flow';

const flow: KratosBrowserFlow = {
  id: 'flow-1',
  ui: {
    messages: [{ type: 'error', text: 'global error' }],
    nodes: [
      {
        type: 'input',
        group: 'default',
        attributes: { name: 'csrf_token', value: 'csrf', type: 'hidden' },
      },
      {
        type: 'input',
        group: 'passkey',
        attributes: { name: 'passkey_remove', value: 'key-1', type: 'submit' },
        messages: [{ type: 'error', text: 'node error' }],
      },
      {
        type: 'input',
        group: 'passkey',
        attributes: { name: 'passkey_remove', value: 'key-2', type: 'submit' },
      },
      {
        type: 'input',
        group: 'code',
        attributes: { name: 'resend', value: 'node-provided-resend', type: 'submit' },
      },
    ],
  },
};

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).fixturePasskeyTrigger;
  delete (window as unknown as Record<string, unknown>).__oryWebAuthnInitialized;
  vi.unstubAllGlobals();
});

function installCeremonyRuntime(operation: 'create' | 'get', credentialPromise: Promise<Credential | null>) {
  vi.stubGlobal('PublicKeyCredential', class PublicKeyCredentialMock {});
  const operationMock = vi.fn(() => credentialPromise);
  const credentials = {
    create: vi.fn(),
    get: vi.fn(),
    [operation]: operationMock,
  };
  vi.stubGlobal('navigator', { credentials });
  (window as unknown as Record<string, unknown>).__oryWebAuthnInitialized = true;
  return operationMock;
}

function installOfficialStyleTrigger(operation: 'create' | 'get', resultFieldName: string) {
  (window as unknown as Record<string, unknown>).fixturePasskeyTrigger = () => {
    window.navigator.credentials[operation]({}).then(
      (credential) => {
        if (credential) {
          const resultElement = document.getElementsByName(resultFieldName)[0] as HTMLElement;
          resultElement.closest('form')?.submit();
        }
      },
      () => undefined,
    );
  };
}

describe('Kratos browser flow helpers', () => {
  it('preserves repeated credential nodes and string values', () => {
    expect(findKratosNodes(flow, 'passkey_remove')).toHaveLength(2);
    expect(getKratosNodeStringValue(flow, 'csrf_token')).toBe('csrf');
    expect(getKratosNodeStringValue(flow, 'resend')).toBe('node-provided-resend');
    expect(getKratosFlowErrors(flow).map((message) => message.text)).toEqual(['global error', 'node error']);
  });

  it('invokes only the exact node-provided browser trigger', () => {
    const trigger = vi.fn();
    (window as unknown as Record<string, unknown>).fixturePasskeyTrigger = trigger;

    expect(invokeKratosBrowserTrigger('fixturePasskeyTrigger')).toBe(true);
    expect(invokeKratosBrowserTrigger('missingTrigger')).toBe(false);
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('observes a successful credential ceremony without replacing Kratos form submission', async () => {
    const operation = installCeremonyRuntime('get', Promise.resolve({ id: 'credential-1' } as Credential));
    const form = document.createElement('form');
    const result = document.createElement('input');
    result.name = 'passkey_login';
    form.appendChild(result);
    document.body.appendChild(form);
    const submit = vi.fn();
    Object.defineProperty(form, 'submit', { configurable: true, value: submit });
    installOfficialStyleTrigger('get', 'passkey_login');

    await expect(
      invokeKratosBrowserCeremony('fixturePasskeyTrigger', {
        operation: 'get',
        resultFieldName: 'passkey_login',
      }),
    ).resolves.toBe(true);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
    form.remove();
  });

  it('exposes an internally caught credential rejection to the product UI caller', async () => {
    const cancellation = new DOMException('The operation was cancelled.', 'NotAllowedError');
    installCeremonyRuntime('get', Promise.reject(cancellation));
    const form = document.createElement('form');
    const result = document.createElement('input');
    result.name = 'passkey_login';
    form.appendChild(result);
    document.body.appendChild(form);
    const submit = vi.fn();
    Object.defineProperty(form, 'submit', { configurable: true, value: submit });
    installOfficialStyleTrigger('get', 'passkey_login');

    await expect(
      invokeKratosBrowserCeremony('fixturePasskeyTrigger', {
        operation: 'get',
        resultFieldName: 'passkey_login',
      }),
    ).rejects.toBe(cancellation);

    expect(submit).not.toHaveBeenCalled();
    form.remove();
  });

  it('aborts a still-pending ceremony after its browser window closes and focus returns', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('PublicKeyCredential', class PublicKeyCredentialMock {});
      const operation = vi.fn((options: CredentialRequestOptions) => {
        return new Promise<Credential | null>((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
        });
      });
      vi.stubGlobal('navigator', { credentials: { create: vi.fn(), get: operation } });
      (window as unknown as Record<string, unknown>).__oryWebAuthnInitialized = true;
      const form = document.createElement('form');
      const result = document.createElement('input');
      result.name = 'passkey_login';
      form.appendChild(result);
      document.body.appendChild(form);
      const submit = vi.fn();
      Object.defineProperty(form, 'submit', { configurable: true, value: submit });
      installOfficialStyleTrigger('get', 'passkey_login');

      const ceremony = invokeKratosBrowserCeremony('fixturePasskeyTrigger', {
        operation: 'get',
        resultFieldName: 'passkey_login',
        cancelAfterWindowRefocusMs: 1000,
      });
      const rejection = expect(ceremony).rejects.toMatchObject({ name: 'AbortError' });
      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(1000);

      await rejection;
      expect(operation).toHaveBeenCalledTimes(1);
      expect(submit).not.toHaveBeenCalled();
      form.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  it('recognizes the official secure-linking message on the same login flow', () => {
    const linkingFlow: KratosBrowserFlow = {
      id: 'same-login-flow',
      ui: {
        messages: [
          {
            id: 1010016,
            type: 'info',
            text: 'Sign in to confirm this account.',
            context: {
              duplicate_identifier: 'johndoe@example.com',
              provider: 'GitHub',
            },
          },
        ],
        nodes: [],
      },
    };

    expect(getSecureAccountLinkingContext(linkingFlow)).toEqual({
      identifier: 'johndoe@example.com',
      provider: 'GitHub',
    });
    expect(getKratosFlowErrors(linkingFlow)).toEqual([]);
    expect(getSecureAccountLinkingContext({ ...linkingFlow, ui: { nodes: [] } })).toBeNull();
  });
});

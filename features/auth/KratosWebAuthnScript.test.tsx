// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KratosWebAuthnScript } from './KratosWebAuthnScript';
import type { KratosUiNode } from './kratos-flow';

const scriptNodes: KratosUiNode[] = [
  {
    type: 'script',
    group: 'webauthn',
    attributes: {
      id: 'webauthn_script',
      src: '/api/auth/.well-known/ory/webauthn.js',
      integrity: 'sha512-fixture',
      crossorigin: 'anonymous',
      referrerpolicy: 'no-referrer',
      async: true,
    },
  },
];

let container: HTMLDivElement;
let root: Root;
let publicKeyCredentialDescriptor: PropertyDescriptor | undefined;
let credentialsDescriptor: PropertyDescriptor | undefined;

function installCredentialCapability() {
  Object.defineProperty(window, 'PublicKeyCredential', {
    configurable: true,
    value: class PublicKeyCredentialMock {},
  });
  Object.defineProperty(window.navigator, 'credentials', {
    configurable: true,
    value: {
      create: vi.fn(),
      get: vi.fn(),
    },
  });
}

function installInitializedTrigger(trigger = 'oryPasskeyLogin') {
  (window as unknown as Record<string, unknown>).__oryWebAuthnInitialized = true;
  (window as unknown as Record<string, unknown>)[trigger] = vi.fn();
}

function restoreProperty(target: object, key: PropertyKey, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
  } else {
    Reflect.deleteProperty(target, key);
  }
}

beforeEach(() => {
  publicKeyCredentialDescriptor = Object.getOwnPropertyDescriptor(window, 'PublicKeyCredential');
  credentialsDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'credentials');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete (window as unknown as Record<string, unknown>).__oryWebAuthnInitialized;
  delete (window as unknown as Record<string, unknown>).oryPasskeyLogin;
  restoreProperty(window, 'PublicKeyCredential', publicKeyCredentialDescriptor);
  restoreProperty(window.navigator, 'credentials', credentialsDescriptor);
  document.getElementById('webauthn_script')?.remove();
});

describe('KratosWebAuthnScript', () => {
  it('runs the onload trigger once per flow key across state rerenders', () => {
    const onReady = vi.fn();
    installCredentialCapability();
    installInitializedTrigger();

    act(() => {
      root.render(
        <KratosWebAuthnScript
          nodes={[...scriptNodes]}
          readyKey="flow-1:oryPasskeyLoginAutocompleteInit"
          credentialOperation="get"
          requiredTriggers={['oryPasskeyLogin']}
          onReady={onReady}
        />,
      );
    });
    act(() => {
      root.render(
        <KratosWebAuthnScript
          nodes={[...scriptNodes]}
          readyKey="flow-1:oryPasskeyLoginAutocompleteInit"
          credentialOperation="get"
          requiredTriggers={['oryPasskeyLogin']}
          onReady={() => onReady()}
        />,
      );
    });
    expect(onReady).toHaveBeenCalledTimes(1);

    act(() => {
      root.render(
        <KratosWebAuthnScript
          nodes={[...scriptNodes]}
          readyKey="flow-2:oryPasskeyLoginAutocompleteInit"
          credentialOperation="get"
          requiredTriggers={['oryPasskeyLogin']}
          onReady={onReady}
        />,
      );
    });
    expect(onReady).toHaveBeenCalledTimes(2);
  });

  it('does not report readiness until the delayed script finishes loading', () => {
    const onReady = vi.fn();
    installCredentialCapability();

    act(() => {
      root.render(
        <KratosWebAuthnScript
          nodes={scriptNodes}
          readyKey="delayed-flow"
          credentialOperation="get"
          requiredTriggers={['oryPasskeyLogin']}
          onReady={onReady}
        />,
      );
    });

    expect(onReady).not.toHaveBeenCalled();
    const script = document.getElementById('webauthn_script');
    expect(script).toBeInstanceOf(HTMLScriptElement);

    installInitializedTrigger();
    act(() => {
      script?.dispatchEvent(new Event('load'));
    });
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('reports unsupported capability without loading a script', () => {
    const onReady = vi.fn();
    const onError = vi.fn();

    act(() => {
      root.render(
        <KratosWebAuthnScript
          nodes={scriptNodes}
          readyKey="unsupported-flow"
          credentialOperation="get"
          requiredTriggers={['oryPasskeyLogin']}
          onReady={onReady}
          onError={onError}
        />,
      );
    });

    expect(onReady).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(document.getElementById('webauthn_script')).toBeNull();
  });

  it('does not treat script load as readiness when Kratos exited before initialization', () => {
    const onReady = vi.fn();
    const onError = vi.fn();
    installCredentialCapability();

    act(() => {
      root.render(
        <KratosWebAuthnScript
          nodes={scriptNodes}
          readyKey="loaded-without-init"
          credentialOperation="get"
          requiredTriggers={['oryPasskeyLogin']}
          onReady={onReady}
          onError={onError}
        />,
      );
    });

    const script = document.getElementById('webauthn_script');
    act(() => {
      script?.dispatchEvent(new Event('load'));
    });

    expect(onReady).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('reports a script load failure without claiming readiness', () => {
    const onReady = vi.fn();
    const onError = vi.fn();
    installCredentialCapability();

    act(() => {
      root.render(
        <KratosWebAuthnScript
          nodes={scriptNodes}
          readyKey="failed-flow"
          credentialOperation="get"
          requiredTriggers={['oryPasskeyLogin']}
          onReady={onReady}
          onError={onError}
        />,
      );
    });

    const script = document.getElementById('webauthn_script');
    act(() => {
      script?.dispatchEvent(new Event('error'));
    });

    expect(onReady).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

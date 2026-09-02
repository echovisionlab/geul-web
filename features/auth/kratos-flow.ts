export interface KratosUiMessage {
  id?: number;
  type?: string;
  text?: string;
  context?: Record<string, unknown>;
}

export interface KratosUiNodeAttributes {
  name?: string;
  value?: unknown;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  autocomplete?: string;
  src?: string;
  id?: string;
  integrity?: string;
  crossorigin?: string;
  referrerpolicy?: string;
  async?: boolean;
  onloadTrigger?: string;
  onclickTrigger?: string;
}

export interface KratosUiNode {
  attributes: KratosUiNodeAttributes;
  group: string;
  type: string;
  messages?: KratosUiMessage[];
  meta?: {
    label?: {
      text?: string;
      context?: Record<string, unknown>;
    };
  };
}

export interface KratosBrowserFlow {
  id: string;
  active?: string;
  expires_at?: string;
  issued_at?: string;
  updated_at?: string;
  refresh?: boolean;
  return_to?: string;
  state?: string;
  ui: {
    action?: string;
    method?: string;
    nodes: KratosUiNode[];
    messages?: KratosUiMessage[];
  };
}

export function asKratosBrowserFlow(value: unknown): KratosBrowserFlow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Partial<KratosBrowserFlow>;
  return typeof candidate.id === 'string' &&
    candidate.id.trim().length > 0 &&
    candidate.ui !== undefined &&
    Array.isArray(candidate.ui.nodes)
    ? (candidate as KratosBrowserFlow)
    : null;
}

export type KratosCredentialOperation = 'create' | 'get';

type OryWebAuthnWindow = Window & {
  __oryWebAuthnInitialized?: boolean;
};

export const SECURE_ACCOUNT_LINKING_MESSAGE_ID = 1010016;

export interface SecureAccountLinkingContext {
  identifier: string;
  provider: string;
}

function getMessageContextString(context: Record<string, unknown> | undefined, ...keys: string[]): string {
  for (const key of keys) {
    const value = context?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return '';
}

export function getSecureAccountLinkingContext(flow: KratosBrowserFlow | null): SecureAccountLinkingContext | null {
  const message = flow?.ui.messages?.find((candidate) => candidate.id === SECURE_ACCOUNT_LINKING_MESSAGE_ID);
  if (!message) {
    return null;
  }

  return {
    identifier: getMessageContextString(message.context, 'duplicate_identifier', 'duplicateIdentifier'),
    provider: getMessageContextString(message.context, 'provider'),
  };
}

export function findKratosNode(flow: KratosBrowserFlow | null, name: string): KratosUiNode | null {
  return flow?.ui.nodes.find((node) => node.attributes.name === name) ?? null;
}

export function findKratosNodes(flow: KratosBrowserFlow | null, name: string): KratosUiNode[] {
  return flow?.ui.nodes.filter((node) => node.attributes.name === name) ?? [];
}

export function getKratosNodeStringValue(flow: KratosBrowserFlow | null, name: string): string {
  const value = findKratosNode(flow, name)?.attributes.value;
  return typeof value === 'string' ? value : '';
}

export function getKratosCsrfToken(flow: KratosBrowserFlow | null): string {
  return getKratosNodeStringValue(flow, 'csrf_token');
}

export function getKratosFlowErrors(flow: KratosBrowserFlow | null): KratosUiMessage[] {
  if (!flow) {
    return [];
  }

  return [...(flow.ui.messages ?? []), ...flow.ui.nodes.flatMap((node) => node.messages ?? [])].filter(
    (message) => message.type === 'error',
  );
}

export function hasKratosNode(flow: KratosBrowserFlow | null, name: string): boolean {
  return Boolean(findKratosNode(flow, name));
}

export function getKratosTraitValue(flow: KratosBrowserFlow | null, traitName: string): string {
  return getKratosNodeStringValue(flow, `traits.${traitName}`);
}

export function getKratosScriptNodes(flow: KratosBrowserFlow | null): KratosUiNode[] {
  return flow?.ui.nodes.filter((node) => node.type === 'script' && typeof node.attributes.src === 'string') ?? [];
}

export function invokeKratosBrowserTrigger(trigger: unknown): boolean {
  if (typeof trigger !== 'string' || !trigger.trim() || typeof window === 'undefined') {
    return false;
  }

  const candidate = (window as unknown as Record<string, unknown>)[trigger];
  if (typeof candidate !== 'function') {
    return false;
  }

  candidate();
  return true;
}

export function isKratosWebAuthnRuntimeReady(
  operation: KratosCredentialOperation,
  triggers: readonly unknown[],
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const oryWindow = window as OryWebAuthnWindow;
  const credentials = window.navigator?.credentials;
  if (
    oryWindow.__oryWebAuthnInitialized !== true ||
    !window.PublicKeyCredential ||
    !credentials ||
    typeof credentials[operation] !== 'function' ||
    triggers.length === 0
  ) {
    return false;
  }

  const windowRecord = window as unknown as Record<string, unknown>;
  return triggers.every(
    (trigger) => typeof trigger === 'string' && Boolean(trigger.trim()) && typeof windowRecord[trigger] === 'function',
  );
}

function restoreOwnProperty(target: object, property: PropertyKey, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
  } else {
    Reflect.deleteProperty(target, property);
  }
}

export async function invokeKratosBrowserCeremony(
  trigger: unknown,
  options: {
    operation: KratosCredentialOperation;
    resultFieldName: string;
    cancelAfterWindowRefocusMs?: number;
  },
): Promise<boolean> {
  if (!isKratosWebAuthnRuntimeReady(options.operation, [trigger])) {
    return false;
  }

  const resultElement = document.getElementsByName(options.resultFieldName)[0];
  const form = resultElement instanceof HTMLElement ? resultElement.closest('form') : null;
  if (!form) {
    return false;
  }

  const credentials = window.navigator.credentials;
  const originalOperation = credentials[options.operation] as unknown as (
    ...args: unknown[]
  ) => Promise<Credential | null>;
  const operationDescriptor = Object.getOwnPropertyDescriptor(credentials, options.operation);
  const submitDescriptor = Object.getOwnPropertyDescriptor(form, 'submit');
  const originalSubmit = form.submit;
  let pendingCredential: Promise<Credential | null> | null = null;
  let submitted = false;
  let credentialSettled = false;
  let refocusAbortTimer: number | null = null;
  let windowBlurred = false;
  const forwardedAbortListener = { remove: undefined as (() => void) | undefined };
  const refocusAbortController = typeof options.cancelAfterWindowRefocusMs === 'number' ? new AbortController() : null;
  const handleWindowBlur = () => {
    windowBlurred = true;
  };
  const handleWindowFocus = () => {
    if (
      !windowBlurred ||
      credentialSettled ||
      !refocusAbortController ||
      typeof options.cancelAfterWindowRefocusMs !== 'number'
    ) {
      return;
    }
    if (refocusAbortTimer !== null) {
      window.clearTimeout(refocusAbortTimer);
    }
    refocusAbortTimer = window.setTimeout(() => {
      if (!credentialSettled) {
        refocusAbortController.abort(
          new DOMException('The passkey window was closed before authentication completed.', 'AbortError'),
        );
      }
    }, options.cancelAfterWindowRefocusMs);
  };

  if (refocusAbortController) {
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
  }

  try {
    Object.defineProperty(form, 'submit', {
      configurable: true,
      value: function observedKratosSubmit(this: HTMLFormElement) {
        const result = originalSubmit.call(this);
        submitted = true;
        return result;
      },
    });

    try {
      Object.defineProperty(credentials, options.operation, {
        configurable: true,
        value: (...args: unknown[]) => {
          let operationArgs = args;
          const requestOptions = args[0];
          if (refocusAbortController && requestOptions && typeof requestOptions === 'object') {
            const originalSignal = (requestOptions as { signal?: AbortSignal }).signal;
            if (originalSignal) {
              const forwardAbort = () => refocusAbortController.abort(originalSignal.reason);
              if (originalSignal.aborted) {
                forwardAbort();
              } else {
                originalSignal.addEventListener('abort', forwardAbort, { once: true });
                forwardedAbortListener.remove = () => originalSignal.removeEventListener('abort', forwardAbort);
              }
            }
            operationArgs = [
              {
                ...requestOptions,
                signal: refocusAbortController.signal,
              },
              ...args.slice(1),
            ];
          }
          const result = originalOperation.apply(credentials, operationArgs);
          pendingCredential = Promise.resolve(result).then(
            (credential) => {
              credentialSettled = true;
              return credential;
            },
            (error: unknown) => {
              credentialSettled = true;
              throw error;
            },
          );
          return result;
        },
      });

      const candidate = (window as unknown as Record<string, unknown>)[trigger as string];
      if (typeof candidate !== 'function') {
        return false;
      }
      candidate();
    } finally {
      restoreOwnProperty(credentials, options.operation, operationDescriptor);
    }

    const credentialPromise = pendingCredential as Promise<Credential | null> | null;
    if (!credentialPromise) {
      return false;
    }

    const credential = await credentialPromise;
    if (!credential) {
      return false;
    }

    // Kratos registers its promise reaction before this observer. Once the
    // credential resolves, its synchronous payload/form submission has run.
    return submitted;
  } finally {
    if (refocusAbortTimer !== null) {
      window.clearTimeout(refocusAbortTimer);
    }
    window.removeEventListener('blur', handleWindowBlur);
    window.removeEventListener('focus', handleWindowFocus);
    forwardedAbortListener.remove?.();
    restoreOwnProperty(form, 'submit', submitDescriptor);
  }
}

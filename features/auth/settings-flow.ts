import { getPublicAuthUrl } from '@/lib/public-runtime-config';
import { isValidUuid } from '@/lib/utils/validation';

interface SettingsFlowNode {
  attributes?: {
    name?: string;
    value?: unknown;
    type?: string;
    disabled?: boolean;
    src?: string;
    id?: string;
    integrity?: string;
    crossorigin?: string;
    referrerpolicy?: string;
    async?: boolean;
    onclickTrigger?: string;
  };
  group?: string;
  type?: string;
  messages?: SettingsFlowMessage[];
  meta?: {
    label?: {
      text?: string;
      context?: Record<string, unknown>;
    };
  };
}

interface SettingsFlowMessage {
  id?: number | string;
  type?: string;
  text?: string;
}

export interface SettingsFlow {
  id?: string;
  state?: string;
  identity?: {
    traits?: Record<string, unknown>;
  };
  continue_with?: Array<{
    action?: string;
    flow?: {
      id?: string;
      verifiable_address?: string;
      url?: string;
    };
    redirect_browser_to?: string;
  }>;
  ui?: {
    action?: string;
    messages?: SettingsFlowMessage[];
    nodes?: SettingsFlowNode[];
  };
}

export function hasSettingsFlowError(flow: SettingsFlow | null): boolean {
  if (!flow?.ui) {
    return false;
  }
  return [...(flow.ui.messages ?? []), ...(flow.ui.nodes?.flatMap((node) => node.messages ?? []) ?? [])].some(
    (message) => message.type === 'error',
  );
}

interface FlowErrorPayload {
  error?: {
    message?: string;
  };
  ui?: {
    messages?: SettingsFlowMessage[];
  };
}

class SettingsFlowError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SettingsFlowError';
    this.status = status;
  }
}

export function getSettingsFlowCsrfToken(flow: SettingsFlow): string | null {
  const value = flow.ui?.nodes
    ?.map((node) => node.attributes)
    .find((attributes) => attributes?.name === 'csrf_token')?.value;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

type SettingsEmailVerificationTrait = 'pending_email';

function getSettingsEmailVerificationContinuation(
  flow: SettingsFlow | null,
  requestedEmail: string,
  canonicalEmail: string,
  pendingTrait: SettingsEmailVerificationTrait,
): { flowId: string; verifiableAddress: string } | null {
  const normalizedRequestedEmail = requestedEmail.trim().toLowerCase();
  const normalizedCanonicalEmail = canonicalEmail.trim().toLowerCase();
  const canonicalIdentityEmail = flow?.identity?.traits?.email;
  const pendingIdentityEmail = flow?.identity?.traits?.[pendingTrait];
  if (
    !normalizedRequestedEmail ||
    !normalizedCanonicalEmail ||
    typeof canonicalIdentityEmail !== 'string' ||
    canonicalIdentityEmail.trim().toLowerCase() !== normalizedCanonicalEmail ||
    typeof pendingIdentityEmail !== 'string' ||
    pendingIdentityEmail.trim().toLowerCase() !== normalizedRequestedEmail
  ) {
    return null;
  }

  const continuation = flow?.continue_with?.find(
    (item) =>
      item.action === 'show_verification_ui' &&
      typeof item.flow?.id === 'string' &&
      isValidUuid(item.flow.id) &&
      typeof item.flow.verifiable_address === 'string' &&
      item.flow.verifiable_address.trim().toLowerCase() === normalizedRequestedEmail,
  );
  if (!continuation?.flow?.id || !continuation.flow.verifiable_address) {
    return null;
  }

  return {
    flowId: continuation.flow.id,
    verifiableAddress: continuation.flow.verifiable_address,
  };
}

export function getSettingsVerificationContinuation(
  flow: SettingsFlow | null,
  requestedEmail: string,
  canonicalEmail: string,
): { flowId: string; verifiableAddress: string } | null {
  return getSettingsEmailVerificationContinuation(flow, requestedEmail, canonicalEmail, 'pending_email');
}

function asFlowErrorPayload(value: unknown): FlowErrorPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as FlowErrorPayload;
}

function getSettingsErrorMessage(payload: FlowErrorPayload | null): string | null {
  const explicit = payload?.error?.message;
  if (typeof explicit === 'string' && explicit.trim()) {
    return explicit.trim();
  }

  const firstMessage = payload?.ui?.messages?.find((message) => typeof message.text === 'string')?.text;
  return typeof firstMessage === 'string' && firstMessage.trim() ? firstMessage.trim() : null;
}

export async function readSettingsFlowError(response: Response, fallbackMessage: string): Promise<Error> {
  const body = await response.json().catch(() => null);
  const payload = asFlowErrorPayload(body);
  const message = getSettingsErrorMessage(payload) ?? fallbackMessage;

  return new SettingsFlowError(message, response.status);
}

export function isSettingsFlowFreshnessError(error: unknown): boolean {
  return error instanceof SettingsFlowError && (error.status === 401 || error.status === 403);
}

type PendingEmailTrait = SettingsEmailVerificationTrait;

interface SettingsProfileContext {
  flowId: string;
  csrfToken: string;
  currentTraits: Record<string, unknown>;
  canonicalEmail: string;
}

function getSettingsProfileContext(flow: SettingsFlow): SettingsProfileContext {
  const flowId = typeof flow.id === 'string' && flow.id ? flow.id : null;
  const csrfToken = getSettingsFlowCsrfToken(flow);
  const currentTraits = flow.identity?.traits;
  const canonicalEmail = currentTraits?.email;
  if (!flowId || !csrfToken || !currentTraits || typeof canonicalEmail !== 'string' || !canonicalEmail.trim()) {
    throw new Error('Invalid settings flow response');
  }
  return { flowId, csrfToken, currentTraits, canonicalEmail };
}

async function submitSettingsProfileTraits({
  fetchFn,
  flow,
  traits,
  locale,
  errorMessage,
}: {
  fetchFn: typeof fetch;
  flow: SettingsFlow;
  traits: Record<string, unknown>;
  locale?: string;
  errorMessage: string;
}): Promise<SettingsFlow> {
  const { flowId, csrfToken } = getSettingsProfileContext(flow);
  const response = await fetchFn(`${getPublicAuthUrl()}/self-service/settings?flow=${encodeURIComponent(flowId)}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method: 'profile',
      csrf_token: csrfToken,
      ...(locale?.trim() ? { transient_payload: { locale: locale.trim() } } : {}),
      traits,
    }),
  });
  const payload = (await response.json().catch(() => null)) as SettingsFlow | null;

  if (payload?.ui && (response.status === 400 || response.status === 422)) {
    return payload;
  }
  if (!response.ok || !payload) {
    const errorPayload = asFlowErrorPayload(payload);
    throw new SettingsFlowError(getSettingsErrorMessage(errorPayload) ?? errorMessage, response.status);
  }
  return payload;
}

async function clearSettingsPendingEmailTrait({
  fetchFn,
  flow,
  trait,
  errorMessage,
}: {
  fetchFn: typeof fetch;
  flow: SettingsFlow;
  trait: PendingEmailTrait;
  errorMessage: string;
}): Promise<SettingsFlow> {
  const { currentTraits, canonicalEmail } = getSettingsProfileContext(flow);
  const { [trait]: _pendingEmail, ...traitsWithoutPendingEmail } = currentTraits;
  return submitSettingsProfileTraits({
    fetchFn,
    flow,
    traits: {
      ...traitsWithoutPendingEmail,
      email: canonicalEmail,
    },
    errorMessage,
  });
}

export async function requestSettingsFlow({
  fetchFn = fetch,
  returnTo,
}: {
  fetchFn?: typeof fetch;
  returnTo?: string;
} = {}): Promise<{ flowId: string; csrfToken: string; flow: SettingsFlow }> {
  const url = new URL(`${getPublicAuthUrl()}/self-service/settings/browser`, 'https://app.local');
  if (returnTo?.trim()) {
    url.searchParams.set('return_to', returnTo);
  }
  const response = await fetchFn(`${url.pathname}${url.search}${url.hash}`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw await readSettingsFlowError(response, 'Failed to start settings flow');
  }

  const flow = (await response.json()) as SettingsFlow;
  const flowId = typeof flow.id === 'string' && flow.id.length > 0 ? flow.id : null;
  const csrfToken = getSettingsFlowCsrfToken(flow);

  if (!flowId || !csrfToken) {
    throw new Error('Invalid settings flow response');
  }

  return { flowId, csrfToken, flow };
}

export async function submitSettingsPendingEmail({
  fetchFn = fetch,
  flow,
  newEmail,
  locale,
}: {
  fetchFn?: typeof fetch;
  flow: SettingsFlow;
  newEmail: string;
  locale?: string;
}): Promise<SettingsFlow> {
  const pendingEmail = newEmail.trim();
  if (!pendingEmail) {
    throw new Error('Invalid settings flow response');
  }
  const { currentTraits, canonicalEmail } = getSettingsProfileContext(flow);
  return submitSettingsProfileTraits({
    fetchFn,
    flow,
    locale,
    traits: { ...currentTraits, email: canonicalEmail, pending_email: pendingEmail },
    errorMessage: 'Failed to update email',
  });
}

export async function clearSettingsPendingEmail({
  fetchFn = fetch,
  flow,
}: {
  fetchFn?: typeof fetch;
  flow: SettingsFlow;
}): Promise<SettingsFlow> {
  return clearSettingsPendingEmailTrait({
    fetchFn,
    flow,
    trait: 'pending_email',
    errorMessage: 'Failed to clear pending email',
  });
}

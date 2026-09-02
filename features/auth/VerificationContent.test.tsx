// @vitest-environment jsdom

import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import koMessages from '@/messages/ko.json';
import { rememberEmailVerificationContinuation } from './security-reauthentication';
import { VerificationContent } from './VerificationContent';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const navigationMock = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
  searchParams: new URLSearchParams('flow=flow-1'),
}));

const emailActionMock = vi.hoisted(() => ({
  requestEmailChangeAction: vi.fn(),
}));

const sessionMock = vi.hoisted(() => ({
  refetch: vi.fn(),
}));

const reauthenticationMock = vi.hoisted(() => ({
  startPrivilegedReauthentication: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigationMock.router,
  useSearchParams: () => navigationMock.searchParams,
}));

vi.mock('@/lib/public-runtime-config', () => ({
  getPublicAuthUrl: () => '/api/auth',
  getPublicAuthCodeLifespanSeconds: () => 900,
  getPublicAuthCodeResendCooldownSeconds: () => 60,
}));

vi.mock('@/lib/actions/email', () => ({
  requestEmailChangeAction: emailActionMock.requestEmailChangeAction,
}));

vi.mock('@/lib/auth/client', () => ({
  useSession: () => ({
    data: { user: { id: 'member-1' } },
    error: null,
    isPending: false,
    refetch: sessionMock.refetch,
  }),
}));

vi.mock('./login-redirect', () => ({
  startPrivilegedReauthentication: reauthenticationMock.startPrivilegedReauthentication,
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
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

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  navigationMock.router.push.mockReset();
  navigationMock.router.replace.mockReset();
  navigationMock.searchParams = new URLSearchParams('flow=flow-1');
  emailActionMock.requestEmailChangeAction.mockReset();
  emailActionMock.requestEmailChangeAction.mockResolvedValue({ success: true, message: 'ok' });
  sessionMock.refetch.mockReset();
  sessionMock.refetch.mockResolvedValue(undefined);
  reauthenticationMock.startPrivilegedReauthentication.mockReset();
  window.sessionStorage.clear();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function verificationDigitInputs(): HTMLInputElement[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>('[data-testid="verification-code-pin"] input[inputmode="numeric"]'),
  );
}

async function enterVerificationCode(value: string) {
  const inputs = verificationDigitInputs();
  expect(inputs).toHaveLength(6);
  await act(async () => {
    for (const [index, digit] of Array.from(value).entries()) {
      setInputValue(inputs[index] as HTMLInputElement, digit);
      await Promise.resolve();
    }
    await Promise.resolve();
  });
}

async function renderVerificationContent() {
  await act(async () => {
    root?.render(
      <NextIntlClientProvider locale="ko" messages={koMessages}>
        <MantineProvider>
          <VerificationContent />
        </MantineProvider>
      </NextIntlClientProvider>,
    );
  });
  await flush();
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('VerificationContent', () => {
  it('starts email change through settings/profile and follows only its verification continuation', async () => {
    navigationMock.searchParams = new URLSearchParams();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'settings-flow',
          identity: {
            traits: {
              email: 'old@example.test',
              name: 'John Doe',
            },
          },
          ui: {
            nodes: [
              {
                attributes: {
                  name: 'csrf_token',
                  value: 'settings-csrf',
                },
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'settings-flow',
          state: 'success',
          identity: {
            traits: {
              email: 'old@example.test',
              pending_email: 'new@example.test',
              name: 'John Doe',
            },
          },
          continue_with: [
            {
              action: 'redirect_browser_to',
              redirect_browser_to: 'https://untrusted.example/ignored',
            },
            {
              action: 'show_verification_ui',
              flow: {
                id: '019f9b65-c856-7fb8-a66a-84d915a0303a',
                verifiable_address: 'new@example.test',
                url: 'https://untrusted.example/ignored',
              },
            },
          ],
          ui: { nodes: [] },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await renderVerificationContent();

    const emailInput = document.querySelector<HTMLInputElement>('input[type="email"]');
    expect(emailInput).not.toBeNull();
    await act(async () => {
      setInputValue(emailInput as HTMLInputElement, 'new@example.test');
      emailInput?.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(emailActionMock.requestEmailChangeAction).toHaveBeenCalledWith('new@example.test');
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/auth/self-service/settings/browser?return_to=%2Fmy%2Fsecurity', {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/self-service/settings?flow=settings-flow', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'profile',
        csrf_token: 'settings-csrf',
        transient_payload: { locale: 'ko' },
        traits: {
          email: 'old@example.test',
          name: 'John Doe',
          pending_email: 'new@example.test',
        },
      }),
    });
    expect(navigationMock.router.replace).toHaveBeenCalledWith('/verify?flow=019f9b65-c856-7fb8-a66a-84d915a0303a');
    expect(
      window.sessionStorage.getItem('geul.auth-code-delivery:verification:019f9b65-c856-7fb8-a66a-84d915a0303a'),
    ).not.toBeNull();
  });

  it('requests privileged reauthentication and preserves the email action for automatic continuation', async () => {
    navigationMock.searchParams = new URLSearchParams();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'settings-flow',
          identity: {
            traits: {
              email: 'old@example.test',
              name: 'John Doe',
            },
          },
          ui: {
            nodes: [
              {
                attributes: {
                  name: 'csrf_token',
                  value: 'settings-csrf',
                },
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: { message: 'provider freshness text' },
          },
          { status: 403 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await renderVerificationContent();
    const emailInput = document.querySelector<HTMLInputElement>('input[type="email"]');
    await act(async () => {
      setInputValue(emailInput as HTMLInputElement, 'new@example.test');
      emailInput?.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(reauthenticationMock.startPrivilegedReauthentication).toHaveBeenCalledWith(
      '/verify?resume_email_verification=1',
    );
    expect(document.body.textContent).not.toContain('provider freshness text');
  });

  it('automatically resumes the exact email request after privileged reauthentication', async () => {
    navigationMock.searchParams = new URLSearchParams('resume_email_verification=1');
    rememberEmailVerificationContinuation(
      {
        mode: 'change',
        email: 'resumed@example.test',
        operation: 'start',
      },
      'member-1',
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'resumed-settings-flow',
          identity: {
            traits: {
              email: 'old@example.test',
              name: 'John Doe',
            },
          },
          ui: {
            nodes: [
              {
                attributes: {
                  name: 'csrf_token',
                  value: 'resumed-settings-csrf',
                },
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'resumed-settings-flow',
          identity: {
            traits: {
              email: 'old@example.test',
              pending_email: 'resumed@example.test',
              name: 'John Doe',
            },
          },
          continue_with: [
            {
              action: 'show_verification_ui',
              flow: {
                id: '019f9b65-c856-7fb8-a66a-84d915a0303b',
                verifiable_address: 'resumed@example.test',
              },
            },
          ],
          ui: { nodes: [] },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await renderVerificationContent();
    await flush();

    expect(emailActionMock.requestEmailChangeAction).toHaveBeenCalledTimes(1);
    expect(emailActionMock.requestEmailChangeAction).toHaveBeenCalledWith('resumed@example.test');
    expect(navigationMock.router.replace).toHaveBeenCalledWith('/verify?flow=019f9b65-c856-7fb8-a66a-84d915a0303b');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops on a preflight conflict before creating a settings flow', async () => {
    navigationMock.searchParams = new URLSearchParams();
    emailActionMock.requestEmailChangeAction.mockResolvedValue({
      success: false,
      message: 'This email already exists',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await renderVerificationContent();
    const emailInput = document.querySelector<HTMLInputElement>('input[type="email"]');
    await act(async () => {
      setInputValue(emailInput as HTMLInputElement, 'taken@example.test');
      emailInput?.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(document.body.textContent).toContain('이미 등록된 이메일입니다');
    expect(document.body.textContent).not.toContain('This email already exists');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigationMock.router.replace).not.toHaveBeenCalled();
  });

  it('rejects an initial verification payload whose id does not match the requested flow', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'different-flow',
        state: 'sent_email',
        ui: {
          nodes: [
            {
              group: 'code',
              type: 'input',
              attributes: {
                name: 'email',
                type: 'hidden',
                value: 'new@example.test',
              },
            },
          ],
          messages: [],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await renderVerificationContent();
    await flush();

    expect(document.body.textContent).toContain('인증 플로우를 찾을 수 없거나 만료되었습니다');
    expect(verificationDigitInputs()).toHaveLength(0);
    expect(navigationMock.router.replace).not.toHaveBeenCalled();
  });

  it('submits automatically when the verification pin is complete', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'flow-1',
          state: 'sent_email',
          ui: {
            nodes: [
              {
                group: 'default',
                type: 'input',
                attributes: {
                  name: 'csrf_token',
                  type: 'hidden',
                  value: 'csrf-token',
                },
              },
              {
                group: 'code',
                type: 'input',
                attributes: {
                  name: 'email',
                  type: 'hidden',
                  value: 'new@example.test',
                },
              },
            ],
            messages: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'flow-1',
          state: 'passed_challenge',
          ui: {
            nodes: [],
            messages: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          identity: {
            traits: {
              email: 'new@example.test',
            },
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await renderVerificationContent();

    expect(document.querySelector('[data-testid="verification-code-submit"]')).toBeNull();
    expect(document.querySelector('[data-testid="verification-code-resend"]')).toBeNull();
    expect(verificationDigitInputs()).toHaveLength(6);

    await enterVerificationCode('12345');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await enterVerificationCode('123456');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await flush();
    expect(sessionMock.refetch).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/auth/self-service/verification?flow=flow-1',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      method: 'code',
      csrf_token: 'csrf-token',
      code: '123456',
      transient_payload: { locale: 'ko' },
    });
  });

  it('clears the pin and keeps the verification error visible when the code fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'flow-1',
          state: 'sent_email',
          ui: {
            nodes: [
              {
                group: 'default',
                type: 'input',
                attributes: {
                  name: 'csrf_token',
                  type: 'hidden',
                  value: 'csrf-token',
                },
              },
              {
                group: 'code',
                type: 'input',
                attributes: {
                  name: 'email',
                  type: 'hidden',
                  value: 'new@example.test',
                },
              },
            ],
            messages: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            id: 'flow-1',
            state: 'sent_email',
            ui: {
              nodes: [
                {
                  group: 'code',
                  type: 'input',
                  attributes: {
                    name: 'code',
                    type: 'text',
                  },
                  messages: [
                    {
                      id: 4070006,
                      type: 'error',
                      text: 'The verification code is invalid or has already been used.',
                    },
                  ],
                },
              ],
              messages: [],
            },
          },
          { status: 422 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await renderVerificationContent();
    await enterVerificationCode('123456');

    expect(document.body.textContent).toContain('이메일 인증에 실패했습니다');
    expect(document.body.textContent).not.toContain('The verification code is invalid or has already been used.');
    expect(verificationDigitInputs().map((input) => input.value)).toEqual(['', '', '', '', '', '']);
  });

  it('requests JSON when submitting a verification code to prevent browser redirects', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'flow-1',
          state: 'sent_email',
          ui: {
            nodes: [
              {
                group: 'default',
                type: 'input',
                attributes: {
                  name: 'csrf_token',
                  type: 'hidden',
                  value: 'csrf-token',
                },
              },
              {
                group: 'code',
                type: 'input',
                attributes: {
                  name: 'email',
                  type: 'hidden',
                  value: 'new@example.test',
                },
              },
            ],
            messages: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'flow-1',
          state: 'passed_challenge',
          ui: {
            nodes: [],
            messages: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          identity: {
            traits: {
              email: 'new@example.test',
            },
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await renderVerificationContent();
    await enterVerificationCode('123456');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/auth/self-service/verification/flows?id=flow-1', {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/auth/self-service/verification?flow=flow-1',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }),
    );
  });

  it('treats a failed verification response as complete when the canonical identity is already applied', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'flow-1',
          state: 'sent_email',
          ui: {
            nodes: [
              {
                group: 'default',
                type: 'input',
                attributes: {
                  name: 'csrf_token',
                  type: 'hidden',
                  value: 'csrf-token',
                },
              },
              {
                group: 'code',
                type: 'input',
                attributes: {
                  name: 'email',
                  type: 'hidden',
                  value: 'new@example.test',
                },
              },
            ],
            messages: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            use_flow_id: '019f9b65-c856-7fb8-a66a-84d915a0303b',
          },
          { status: 410 },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: '019f9b65-c856-7fb8-a66a-84d915a0303b',
          state: 'choose_method',
          ui: {
            nodes: [
              {
                group: 'link',
                type: 'a',
                attributes: {},
                messages: [
                  {
                    id: 4900001,
                    type: 'error',
                    text: 'provider notification failure text',
                  },
                ],
              },
            ],
            messages: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          identity: {
            traits: {
              email: 'new@example.test',
            },
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await renderVerificationContent();
    await enterVerificationCode('123456');
    await flush();

    expect(document.body.textContent).toContain('이메일 인증 완료');
    expect(document.body.textContent).not.toContain('provider notification failure text');
    expect(sessionMock.refetch).toHaveBeenCalledTimes(1);
    expect(navigationMock.router.replace).toHaveBeenCalledWith('/verify?flow=019f9b65-c856-7fb8-a66a-84d915a0303b');
  });

  it('rejects a replacement payload whose id does not match use_flow_id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'flow-1',
          state: 'sent_email',
          ui: {
            nodes: [
              {
                group: 'default',
                type: 'input',
                attributes: {
                  name: 'csrf_token',
                  type: 'hidden',
                  value: 'csrf-token',
                },
              },
              {
                group: 'code',
                type: 'input',
                attributes: {
                  name: 'email',
                  type: 'hidden',
                  value: 'new@example.test',
                },
              },
            ],
            messages: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            use_flow_id: '019f9b65-c856-7fb8-a66a-84d915a0303f',
          },
          { status: 410 },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: '019f9b65-c856-7fb8-a66a-84d915a9999',
          state: 'choose_method',
          ui: {
            nodes: [
              {
                group: 'link',
                type: 'a',
                attributes: {},
                messages: [
                  {
                    id: 4900001,
                    type: 'error',
                    text: 'provider mismatch text',
                  },
                ],
              },
            ],
            messages: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          identity: {
            traits: { email: 'old@example.test' },
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await renderVerificationContent();
    await enterVerificationCode('123456');
    await flush();

    expect(document.body.textContent).toContain('이미 등록된 이메일입니다');
    expect(document.body.textContent).not.toContain('provider mismatch text');
    expect(navigationMock.router.replace).toHaveBeenCalledWith('/verify');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('shows applying from the verified pending identity and completes after a manual authority reread', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'flow-1',
          state: 'sent_email',
          ui: {
            nodes: [
              {
                group: 'default',
                type: 'input',
                attributes: {
                  name: 'csrf_token',
                  type: 'hidden',
                  value: 'csrf-token',
                },
              },
              {
                group: 'code',
                type: 'input',
                attributes: {
                  name: 'email',
                  type: 'hidden',
                  value: 'taken@example.test',
                },
              },
            ],
            messages: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            use_flow_id: '019f9b65-c856-7fb8-a66a-84d915a0303c',
          },
          { status: 410 },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: '019f9b65-c856-7fb8-a66a-84d915a0303c',
          state: 'choose_method',
          ui: {
            nodes: [
              {
                group: 'link',
                type: 'a',
                attributes: {},
                messages: [
                  {
                    id: 4900001,
                    type: 'error',
                    text: 'provider uniqueness text',
                  },
                ],
              },
            ],
            messages: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          identity: {
            traits: {
              email: 'old@example.test',
              pending_email: 'taken@example.test',
            },
            verifiable_addresses: [{ via: 'email', value: 'taken@example.test', verified: true }],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          identity: {
            traits: {
              email: 'taken@example.test',
            },
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await renderVerificationContent();
    await enterVerificationCode('123456');
    await flush();

    expect(document.body.textContent).toContain('이메일 변경이 완료되지 않았습니다');
    expect(document.body.textContent).not.toContain('provider uniqueness text');
    expect(document.body.textContent).not.toContain('처음부터 다시 시작');
    const retryButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('다시 확인'),
    );
    expect(retryButton).toBeDefined();
    expect(sessionMock.refetch).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/self-service/settings'))).toBe(false);

    await act(async () => {
      retryButton?.click();
    });
    await flush();

    expect(document.body.textContent).toContain('이메일 인증 완료');
    expect(sessionMock.refetch).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock).toHaveBeenNthCalledWith(5, '/api/auth/sessions/whoami', {
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('resends with the canonical email carried by the active verification flow', async () => {
    const sentEmailFlow = {
      id: 'flow-1',
      state: 'sent_email',
      ui: {
        nodes: [
          {
            group: 'default',
            type: 'input',
            attributes: {
              name: 'csrf_token',
              type: 'hidden',
              value: 'csrf-token',
            },
          },
          {
            group: 'code',
            type: 'input',
            attributes: {
              name: 'email',
              type: 'hidden',
              value: 'canonical@example.test',
            },
          },
          {
            group: 'code',
            type: 'input',
            attributes: {
              name: 'resend',
              type: 'submit',
              value: 'code',
            },
          },
        ],
        messages: [],
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(sentEmailFlow))
      .mockResolvedValueOnce(jsonResponse(sentEmailFlow));
    vi.stubGlobal('fetch', fetchMock);

    await renderVerificationContent();
    const resend = document.querySelector<HTMLButtonElement>('[data-testid="auth-code-resend"]');
    expect(resend).not.toBeNull();
    await act(async () => {
      resend?.click();
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      method: 'code',
      csrf_token: 'csrf-token',
      email: 'canonical@example.test',
      resend: 'code',
      transient_payload: { locale: 'ko' },
    });
  });
});

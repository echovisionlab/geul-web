// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { act, render, screen, waitFor } from '@/test/render';
import { SessionProvider } from '@/lib/providers/SessionProvider';
import type { SessionData } from '@/lib/session-data';
import koMessages from '@/messages/ko.json';
import { recordAcceptedAuthCodeDelivery } from './auth-code-timing';
import { rememberEmailVerificationContinuation } from './security-reauthentication';
import { VerificationContent } from './VerificationContent';

type User = ReturnType<typeof render>['user'];

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
  realProvider: false,
}));

const reauthenticationMock = vi.hoisted(() => ({
  startPrivilegedReauthentication: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/verify',
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

vi.mock('@/lib/auth/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/client')>();
  return {
    ...actual,
    useSession: () => {
      const real = actual.useSession();
      return sessionMock.realProvider
        ? real
        : {
            data: { user: { id: 'member-1' } },
            error: null,
            isPending: false,
            refetch: sessionMock.refetch,
            refetchWithOutcome: async () =>
              (await sessionMock.refetch()) ?? {
                kind: 'refreshed',
                data: { user: { id: 'member-1', email: 'new@example.test' } },
              },
          };
    },
  };
});

vi.mock('./login-redirect', () => ({
  startPrivilegedReauthentication: reauthenticationMock.startPrivilegedReauthentication,
}));

beforeEach(() => {
  navigationMock.router.push.mockReset();
  navigationMock.router.replace.mockReset();
  navigationMock.searchParams = new URLSearchParams('flow=flow-1');
  emailActionMock.requestEmailChangeAction.mockReset();
  emailActionMock.requestEmailChangeAction.mockResolvedValue({ success: true, message: 'ok' });
  sessionMock.realProvider = false;
  sessionMock.refetch.mockReset();
  sessionMock.refetch.mockResolvedValue(undefined);
  reauthenticationMock.startPrivilegedReauthentication.mockReset();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function verificationDigitInputs() {
  return screen.queryAllByRole<HTMLInputElement>('textbox', { name: /^인증 코드 [1-6]$/ });
}

async function enterVerificationCode(user: User, value: string) {
  await user.click(await screen.findByRole('textbox', { name: '인증 코드 1' }));
  await user.paste(value);
}

async function renderVerificationContent() {
  const view = render(
    <SessionProvider initialData={sessionFixture}>
      <VerificationContent />
    </SessionProvider>,
    { locale: 'ko', messages: koMessages },
  );
  await waitFor(() => expect(screen.queryByText(koMessages.auth.verification.loading)).not.toBeInTheDocument());
  return view;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function verificationFlow({
  id = 'flow-1',
  email = 'new@example.test',
  state = 'sent_email',
  error = false,
}: {
  id?: string;
  email?: string;
  state?: 'sent_email' | 'choose_method' | 'passed_challenge';
  error?: boolean;
} = {}) {
  return {
    id,
    state,
    ui: {
      nodes: [
        { group: 'default', type: 'input', attributes: { name: 'csrf_token', type: 'hidden', value: 'csrf-token' } },
        { group: 'code', type: 'input', attributes: { name: 'email', type: 'hidden', value: email } },
      ],
      messages: error ? [{ id: 4070006, type: 'error', text: 'provider verification error' }] : [],
    },
  };
}

const sessionFixture: SessionData = {
  user: {
    id: 'member-1',
    nickname: 'Member',
    email: 'old@example.test',
    image: null,
    preferred_locale: 'ko',
    role: 'user',
    status: 'active',
  },
  onboarded: true,
  nickname_suggestion: null,
};

const verificationMessages = koMessages.auth.verification;

function expectCheckingWithoutResult() {
  expect(screen.getByText(verificationMessages.checking)).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent(verificationMessages.checking);
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(verificationMessages.applying.title)).not.toBeInTheDocument();
  expect(screen.queryByText(verificationMessages.applying.description)).not.toBeInTheDocument();
  expect(screen.queryByText(verificationMessages.passedChallenge.title)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: verificationMessages.applying.checkAgain })).not.toBeInTheDocument();
}

describe('VerificationContent', () => {
  it.each([
    { name: '503 retaining stale data', status: 503, data: {} },
    { name: '200 with a stale email', status: 200, data: sessionFixture },
    { name: '401 ending the session', status: 401, data: null },
  ])('does not complete when the real session provider returns $name', async ({ status, data }) => {
    sessionMock.realProvider = true;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(verificationFlow({ state: 'passed_challenge' })))
      .mockResolvedValueOnce(jsonResponse({ identity: { traits: { email: 'new@example.test' } } }))
      .mockResolvedValueOnce(jsonResponse(data, { status }))
      .mockResolvedValueOnce(jsonResponse({ identity: { traits: { email: 'new@example.test' } } }))
      .mockResolvedValueOnce(
        jsonResponse({ ...sessionFixture, user: { ...sessionFixture.user, email: 'new@example.test' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { user } = await renderVerificationContent();
    expect(await screen.findByRole('heading', { name: verificationMessages.unavailable })).toBeVisible();
    expect(screen.queryByText(verificationMessages.passedChallenge.title)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: verificationMessages.applying.checkAgain }));
    expect(await screen.findByRole('heading', { name: verificationMessages.passedChallenge.title })).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/auth/session', expect.objectContaining({ cache: 'no-store' }));
  });

  it.each([
    { phase: 'authority', current: 'checking', old: 'proof_pending' },
    { phase: 'authority', current: 'checking', old: 'conflict' },
    { phase: 'session', current: 'checking', old: 'applied' },
    { phase: 'session', current: 'checking', old: 'failure' },
    { phase: 'authority', current: 'complete', old: 'proof_pending' },
    { phase: 'session', current: 'complete', old: 'applied' },
  ])('ignores an older flow $phase $old result while the current flow is $current', async ({ phase, current, old }) => {
    const oldAuthority = deferred<Response>();
    const oldSession = deferred<void>();
    const currentAuthority = deferred<Response>();
    if (phase === 'session') {
      sessionMock.refetch.mockReturnValueOnce(oldSession.promise);
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(verificationFlow({ state: 'passed_challenge' })))
      .mockReturnValueOnce(
        phase === 'authority'
          ? oldAuthority.promise
          : Promise.resolve(jsonResponse({ identity: { traits: { email: 'new@example.test' } } })),
      )
      .mockResolvedValueOnce(jsonResponse(verificationFlow({ id: 'flow-2', state: 'passed_challenge' })))
      .mockReturnValueOnce(currentAuthority.promise);
    vi.stubGlobal('fetch', fetchMock);
    const view = await renderVerificationContent();
    await screen.findByRole('status');
    if (phase === 'session') {
      await waitFor(() => expect(sessionMock.refetch).toHaveBeenCalledOnce());
    }
    navigationMock.searchParams = new URLSearchParams('flow=flow-2');
    view.rerender(
      <SessionProvider initialData={sessionFixture}>
        <VerificationContent />
      </SessionProvider>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    if (current === 'complete') {
      await act(async () =>
        currentAuthority.resolve(jsonResponse({ identity: { traits: { email: 'new@example.test' } } })),
      );
      await screen.findByRole('heading', { name: verificationMessages.passedChallenge.title });
    }
    await act(async () => {
      if (phase === 'authority') {
        oldAuthority.resolve(
          jsonResponse({
            identity: {
              traits:
                old === 'conflict'
                  ? { email: 'another@example.test' }
                  : { email: 'old@example.test', pending_email: 'new@example.test' },
            },
          }),
        );
      } else if (old === 'failure') {
        oldSession.reject(new Error('old session unavailable'));
      } else {
        oldSession.resolve();
      }
    });
    if (current === 'checking') {
      expectCheckingWithoutResult();
      await act(async () =>
        currentAuthority.resolve(jsonResponse({ identity: { traits: { email: 'new@example.test' } } })),
      );
    }
    expect(await screen.findByRole('heading', { name: verificationMessages.passedChallenge.title })).toBeVisible();
    expect(navigationMock.router.replace).not.toHaveBeenCalled();
    expect(sessionMock.refetch).toHaveBeenCalledTimes(phase === 'session' ? 2 : 1);
  });

  it.each([200, 404])(
    'ignores a superseded HTTP %s flow load and its finally while the current load is pending',
    async (status) => {
      const oldLoad = deferred<Response>();
      const currentLoad = deferred<Response>();
      vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(oldLoad.promise).mockReturnValueOnce(currentLoad.promise));
      const view = render(
        <SessionProvider initialData={sessionFixture}>
          <VerificationContent />
        </SessionProvider>,
        { locale: 'ko', messages: koMessages },
      );
      navigationMock.searchParams = new URLSearchParams('flow=flow-2');
      view.rerender(
        <SessionProvider initialData={sessionFixture}>
          <VerificationContent />
        </SessionProvider>,
      );
      await act(async () => oldLoad.resolve(jsonResponse(verificationFlow({ state: 'passed_challenge' }), { status })));
      expect(screen.getByRole('status')).toBeVisible();
      expect(sessionMock.refetch).not.toHaveBeenCalled();
      await act(async () => currentLoad.resolve(jsonResponse(verificationFlow({ id: 'flow-2' }))));
      expect(await screen.findByRole('textbox', { name: '인증 코드 1' })).toBeVisible();
    },
  );

  it('does not refresh the session or navigate when authority resolves after unmount', async () => {
    const authority = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(verificationFlow({ state: 'passed_challenge' })))
        .mockReturnValueOnce(authority.promise),
    );
    const view = await renderVerificationContent();
    view.unmount();
    await act(async () => authority.resolve(jsonResponse({ identity: { traits: { email: 'new@example.test' } } })));
    expect(sessionMock.refetch).not.toHaveBeenCalled();
    expect(navigationMock.router.replace).not.toHaveBeenCalled();
  });

  it('keeps a current authority conflict visible after navigating to a fresh verification form', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(verificationFlow({ state: 'passed_challenge' })))
        .mockResolvedValueOnce(jsonResponse({ identity: { traits: { email: 'another@example.test' } } })),
    );
    const view = await renderVerificationContent();
    await screen.findByText(verificationMessages.errors.alreadyExists);
    expect(navigationMock.router.replace).toHaveBeenCalledWith('/verify');
    navigationMock.searchParams = new URLSearchParams();
    view.rerender(
      <SessionProvider initialData={sessionFixture}>
        <VerificationContent />
      </SessionProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(verificationMessages.errors.alreadyExists);
    expect(screen.getByRole('textbox', { name: '이메일' })).toHaveValue('new@example.test');
    expect(sessionMock.refetch).not.toHaveBeenCalled();
  });

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

    const { user } = await renderVerificationContent();

    const emailInput = screen.getByRole('textbox', { name: '이메일' });
    await user.type(emailInput, 'new@example.test');
    await user.click(screen.getByRole('button', { name: '인증 코드 보내기' }));

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

    const { user } = await renderVerificationContent();
    const emailInput = screen.getByRole('textbox', { name: '이메일' });
    await user.type(emailInput, 'new@example.test');
    await user.click(screen.getByRole('button', { name: '인증 코드 보내기' }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(reauthenticationMock.startPrivilegedReauthentication).toHaveBeenCalledWith(
      '/verify?resume_email_verification=1',
    );
    expect(screen.queryByText('provider freshness text', { exact: false })).not.toBeInTheDocument();
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

    await waitFor(() =>
      expect(navigationMock.router.replace).toHaveBeenCalledWith('/verify?flow=019f9b65-c856-7fb8-a66a-84d915a0303b'),
    );
    expect(emailActionMock.requestEmailChangeAction).toHaveBeenCalledTimes(1);
    expect(emailActionMock.requestEmailChangeAction).toHaveBeenCalledWith('resumed@example.test');
    expect(navigationMock.router.replace).toHaveBeenCalledWith('/verify?flow=019f9b65-c856-7fb8-a66a-84d915a0303b');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('explains that the requested address is already the account email', async () => {
    navigationMock.searchParams = new URLSearchParams();
    emailActionMock.requestEmailChangeAction.mockResolvedValue({
      success: false,
      message: 'This is already the current email for this account.',
    });
    vi.stubGlobal('fetch', vi.fn());

    const { user } = await renderVerificationContent();
    const emailInput = screen.getByRole('textbox', { name: '이메일' });
    await user.type(emailInput, 'current@example.test');
    await user.click(screen.getByRole('button', { name: '인증 코드 보내기' }));

    expect(await screen.findByText('이미 이 계정에서 인증된 이메일입니다', { exact: false })).toBeVisible();
    expect(screen.queryByText('인증 메일을 보내지 못했습니다', { exact: false })).not.toBeInTheDocument();
  });

  it('stops on a preflight conflict before creating a settings flow', async () => {
    navigationMock.searchParams = new URLSearchParams();
    emailActionMock.requestEmailChangeAction.mockResolvedValue({
      success: false,
      message: 'This email already exists',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { user } = await renderVerificationContent();
    const emailInput = screen.getByRole('textbox', { name: '이메일' });
    await user.type(emailInput, 'taken@example.test');
    await user.click(screen.getByRole('button', { name: '인증 코드 보내기' }));

    expect(await screen.findByText('이미 등록된 이메일입니다', { exact: false })).toBeVisible();
    expect(screen.queryByText('This email already exists', { exact: false })).not.toBeInTheDocument();
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

    expect(await screen.findByText('인증 플로우를 찾을 수 없거나 만료되었습니다', { exact: false })).toBeVisible();
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

    const { user } = await renderVerificationContent();

    expect(screen.queryByRole('button', { name: '코드를 확인하는 중입니다...' })).not.toBeInTheDocument();
    expect(verificationDigitInputs()).toHaveLength(6);

    await enterVerificationCode(user, '12345');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const inputs = verificationDigitInputs();
    await user.click(inputs[5]);
    await user.keyboard('{Backspace}');
    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '', '']);
    expect(inputs[4]).toHaveFocus();
    await user.click(inputs[1]);
    await user.keyboard('9');
    expect(inputs.map((input) => input.value)).toEqual(['1', '9', '3', '4', '', '']);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await enterVerificationCode(user, '123456');
    expect(await screen.findByRole('heading', { name: '이메일 인증 완료' })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);
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

  it.each([200, 422])(
    'keeps the code and site loader through a deferred HTTP %s POST, then permits an invalid-code retry',
    async (status) => {
      const submission = deferred<Response>();
      const authority = deferred<Response>();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(verificationFlow()))
        .mockReturnValueOnce(submission.promise)
        .mockReturnValueOnce(authority.promise)
        .mockResolvedValueOnce(jsonResponse(verificationFlow({ state: 'passed_challenge' })))
        .mockResolvedValueOnce(jsonResponse({ identity: { traits: { email: 'new@example.test' } } }));
      vi.stubGlobal('fetch', fetchMock);

      const { user } = await renderVerificationContent();
      await enterVerificationCode(user, '654321');
      const loader = screen.getByRole('status', { name: koMessages.common.states.loading });
      expect(loader).toHaveTextContent(verificationMessages.sentEmail.submitting);
      expect(loader).toHaveAttribute('data-placement', 'flow');
      expect(
        verificationDigitInputs()
          .map((input) => input.value)
          .join(''),
      ).toBe('654321');
      for (const input of verificationDigitInputs()) {
        expect(input).toBeDisabled();
      }
      expect(screen.getByRole('button', { name: verificationMessages.sentEmail.resend })).toBeDisabled();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await act(async () => submission.resolve(jsonResponse(verificationFlow({ error: true }), { status })));
      await screen.findByText(verificationMessages.checking);
      expectCheckingWithoutResult();
      expect(sessionMock.refetch).not.toHaveBeenCalled();

      await act(async () => {
        authority.resolve(
          jsonResponse({
            identity: {
              traits: { email: 'old@example.test', pending_email: 'new@example.test' },
              verifiable_addresses: [{ via: 'email', value: 'new@example.test', verified: false }],
            },
          }),
        );
      });

      expect(await screen.findByRole('alert')).toHaveTextContent(verificationMessages.errors.submit);
      expect(screen.queryByText('provider verification error')).not.toBeInTheDocument();
      expect(verificationDigitInputs().map((input) => input.value)).toEqual(['', '', '', '', '', '']);
      expect(verificationDigitInputs()[0]).toHaveFocus();
      expect(screen.getByRole('button', { name: verificationMessages.sentEmail.resend })).toBeEnabled();
      expect(sessionMock.refetch).not.toHaveBeenCalled();
      expect(screen.queryByText(verificationMessages.applying.title)).not.toBeInTheDocument();
      expect(screen.queryByText(verificationMessages.passedChallenge.title)).not.toBeInTheDocument();
      await enterVerificationCode(user, '123456');
      expect(await screen.findByRole('heading', { name: verificationMessages.passedChallenge.title })).toBeVisible();
      expect(fetchMock).toHaveBeenCalledTimes(5);
    },
  );

  it('keeps failed POST retries editable without resetting the accepted delivery countdown', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T00:00:00Z'));
    recordAcceptedAuthCodeDelivery('verification', 'flow-1', Date.now() - 30_000);
    const first = deferred<Response>();
    const retry = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(verificationFlow()))
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(retry.promise),
    );
    const { user } = await renderVerificationContent();

    for (const submission of [first, retry]) {
      await enterVerificationCode(user, '654321');
      expect(screen.getByRole('status', { name: koMessages.common.states.loading })).toHaveTextContent(
        verificationMessages.sentEmail.submitting,
      );
      await act(async () => submission.reject(new TypeError('network unavailable')));

      expect(await screen.findByRole('alert')).toHaveTextContent(verificationMessages.errors.submitRetry);
      expect(verificationDigitInputs()[5]).toHaveFocus();
      expect(
        verificationDigitInputs()
          .map((input) => input.value)
          .join(''),
      ).toBe('');
      expect(screen.getByRole('timer')).toHaveTextContent('코드 만료까지 14:30');
      expect(screen.getByRole('button', { name: '0:30 후 새 코드 보내기' })).toBeDisabled();
    }
    expect(sessionMock.refetch).not.toHaveBeenCalled();
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

    const { user } = await renderVerificationContent();
    await enterVerificationCode(user, '123456');

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

  it('hides replacement flow errors until authority reconciliation and session synchronization finish', async () => {
    const replacementId = '019f9b65-c856-7fb8-a66a-84d915a0303b';
    const replacement = deferred<Response>();
    const authority = deferred<Response>();
    const session = deferred<void>();
    sessionMock.refetch.mockReturnValueOnce(session.promise);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(verificationFlow()))
        .mockResolvedValueOnce(jsonResponse({ use_flow_id: replacementId }, { status: 410 }))
        .mockReturnValueOnce(replacement.promise)
        .mockReturnValueOnce(authority.promise),
    );

    const view = await renderVerificationContent();
    const { user } = view;
    await enterVerificationCode(user, '123456');
    await screen.findByText(verificationMessages.checking);
    expectCheckingWithoutResult();

    await act(async () => {
      replacement.resolve(jsonResponse(verificationFlow({ id: replacementId, state: 'choose_method', error: true })));
    });
    navigationMock.searchParams = new URLSearchParams(`flow=${replacementId}`);
    view.rerender(
      <SessionProvider initialData={sessionFixture}>
        <VerificationContent />
      </SessionProvider>,
    );
    expectCheckingWithoutResult();
    expect(sessionMock.refetch).not.toHaveBeenCalled();

    await act(async () => {
      authority.resolve(jsonResponse({ identity: { traits: { email: 'new@example.test' } } }));
    });
    expectCheckingWithoutResult();
    expect(sessionMock.refetch).toHaveBeenCalledTimes(1);

    await act(async () => session.resolve());
    expect(await screen.findByRole('heading', { name: verificationMessages.passedChallenge.title })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(navigationMock.router.replace).toHaveBeenCalledWith(`/verify?flow=${replacementId}`);
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

    const { user } = await renderVerificationContent();
    await enterVerificationCode(user, '123456');

    expect(await screen.findByText('이미 등록된 이메일입니다', { exact: false })).toBeVisible();
    expect(screen.queryByText('provider mismatch text', { exact: false })).not.toBeInTheDocument();
    expect(navigationMock.router.replace).toHaveBeenCalledWith('/verify');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('shows applying from the verified pending identity and completes after a manual authority reread', async () => {
    const retryAuthority = deferred<Response>();
    const retrySession = deferred<import('@/lib/providers/SessionProvider').SessionRefreshOutcome>();
    sessionMock.refetch.mockReturnValueOnce(retrySession.promise);
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
      .mockReturnValueOnce(retryAuthority.promise);
    vi.stubGlobal('fetch', fetchMock);

    const { user } = await renderVerificationContent();
    await enterVerificationCode(user, '123456');

    expect(await screen.findByText('이메일 변경이 완료되지 않았습니다', { exact: false })).toBeVisible();
    expect(screen.queryByText('provider uniqueness text', { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText('처음부터 다시 시작', { exact: false })).not.toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: '다시 확인' });
    expect(sessionMock.refetch).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/self-service/settings'))).toBe(false);

    const resultHeading = screen.getByRole('heading', { name: verificationMessages.applying.title });
    expect(resultHeading).toHaveFocus();
    await user.click(retryButton);
    expect(screen.getByRole('heading', { name: verificationMessages.applying.title })).toBe(resultHeading);
    expect(retryButton).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent(verificationMessages.checking);
    await act(async () => {
      retryAuthority.resolve(jsonResponse({ identity: { traits: { email: 'taken@example.test' } } }));
    });
    expect(screen.getByRole('heading', { name: verificationMessages.applying.title })).toBe(resultHeading);
    expect(retryButton).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent(verificationMessages.checking);
    await act(async () =>
      retrySession.resolve({
        kind: 'refreshed',
        data: { ...sessionFixture, user: { ...sessionFixture.user, email: 'taken@example.test' } },
      }),
    );

    expect(await screen.findByRole('heading', { name: verificationMessages.passedChallenge.title })).toHaveFocus();
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
    const resend = deferred<Response>();
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
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(sentEmailFlow)).mockReturnValueOnce(resend.promise);
    vi.stubGlobal('fetch', fetchMock);

    const { user } = await renderVerificationContent();
    await enterVerificationCode(user, '123');
    const resendButton = screen.getByRole('button', { name: '새 코드 보내기' });
    await user.click(resendButton);

    expect(resendButton).toHaveAttribute('aria-busy', 'true');
    expect(resendButton).toBeDisabled();
    expect(
      verificationDigitInputs()
        .map((input) => input.value)
        .join(''),
    ).toBe('123');
    for (const input of verificationDigitInputs()) {
      expect(input).toBeDisabled();
    }
    expect(screen.queryByText(verificationMessages.sentEmail.submitting)).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      method: 'code',
      csrf_token: 'csrf-token',
      email: 'canonical@example.test',
      resend: 'code',
      transient_payload: { locale: 'ko' },
    });
    await act(async () => resend.resolve(jsonResponse(sentEmailFlow)));
    expect(
      verificationDigitInputs()
        .map((input) => input.value)
        .join(''),
    ).toBe('');
    expect(screen.getByRole('button', { name: /후 새 코드 보내기/ })).toBeDisabled();
    expect(resendButton).not.toHaveAttribute('aria-busy');
    expect(screen.getByRole('timer')).toBeVisible();
  });

  it.each(['submission', 'initial flow'] as const)(
    'keeps checking after passed_challenge from %s until whoami and session synchronization finish',
    async (source) => {
      const authority = deferred<Response>();
      const session = deferred<void>();
      sessionMock.refetch.mockReturnValueOnce(session.promise);
      const fetchMock = vi.fn();
      if (source === 'submission') {
        fetchMock.mockResolvedValueOnce(jsonResponse(verificationFlow()));
      }
      fetchMock
        .mockResolvedValueOnce(jsonResponse(verificationFlow({ state: 'passed_challenge' })))
        .mockReturnValueOnce(authority.promise);
      vi.stubGlobal('fetch', fetchMock);

      const { user } = await renderVerificationContent();
      if (source === 'submission') {
        await enterVerificationCode(user, '123456');
      }
      await screen.findByText(verificationMessages.checking);
      expectCheckingWithoutResult();
      expect(sessionMock.refetch).not.toHaveBeenCalled();

      await act(async () => {
        authority.resolve(jsonResponse({ identity: { traits: { email: 'new@example.test' } } }));
      });
      expectCheckingWithoutResult();
      expect(sessionMock.refetch).toHaveBeenCalledTimes(1);

      await act(async () => session.resolve());
      expect(await screen.findByRole('heading', { name: verificationMessages.passedChallenge.title })).toBeVisible();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it.each([200, 422])('does not infer proof from a passed_challenge HTTP %s response', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(verificationFlow()))
        .mockResolvedValueOnce(jsonResponse(verificationFlow({ state: 'passed_challenge' }), { status }))
        .mockResolvedValueOnce(
          jsonResponse({
            identity: {
              traits: { email: 'old@example.test', pending_email: 'new@example.test' },
              verifiable_addresses: [{ via: 'email', value: 'old@example.test', verified: true }],
            },
          }),
        ),
    );

    const { user } = await renderVerificationContent();
    await enterVerificationCode(user, '123456');

    expect(await screen.findByRole('alert')).toHaveTextContent(verificationMessages.errors.submit);
    expect(screen.queryByText(verificationMessages.applying.title)).not.toBeInTheDocument();
    expect(screen.queryByText(verificationMessages.passedChallenge.title)).not.toBeInTheDocument();
    expect(sessionMock.refetch).not.toHaveBeenCalled();
    expect(verificationDigitInputs()).toHaveLength(6);
  });

  it.each([
    {
      name: 'already applied canonical email',
      status: 200,
      identity: { traits: { email: 'new@example.test' } },
      title: verificationMessages.passedChallenge.title,
    },
    {
      name: 'verified pending target',
      status: 422,
      identity: {
        traits: { email: 'old@example.test', pending_email: 'new@example.test' },
        verifiable_addresses: [{ via: 'email', value: 'new@example.test', verified: true }],
      },
      title: verificationMessages.applying.title,
    },
  ])('reconciles a same-flow error with the $name', async ({ identity, title, status }) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(verificationFlow()))
        .mockResolvedValueOnce(jsonResponse(verificationFlow({ error: true }), { status }))
        .mockResolvedValueOnce(jsonResponse({ identity })),
    );

    const { user } = await renderVerificationContent();
    await enterVerificationCode(user, '123456');

    expect(await screen.findByRole('heading', { name: title })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['authority unavailable', 'session synchronization failed'] as const)(
    'offers a truthful manual retry when %s without claiming verification or applying',
    async (failure) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(verificationFlow()))
        .mockResolvedValueOnce(jsonResponse(verificationFlow({ error: true }), { status: 422 }))
        .mockResolvedValueOnce(
          failure === 'authority unavailable'
            ? jsonResponse({}, { status: 503 })
            : jsonResponse({ identity: { traits: { email: 'new@example.test' } } }),
        )
        .mockResolvedValueOnce(jsonResponse({ identity: { traits: { email: 'new@example.test' } } }));
      vi.stubGlobal('fetch', fetchMock);
      if (failure === 'session synchronization failed') {
        sessionMock.refetch.mockRejectedValueOnce(new Error('session unavailable'));
      }

      const { user } = await renderVerificationContent();
      await enterVerificationCode(user, '123456');
      expect(await screen.findByRole('heading', { name: verificationMessages.unavailable })).toBeVisible();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText(verificationMessages.applying.description)).not.toBeInTheDocument();
      expect(screen.queryByText(verificationMessages.passedChallenge.title)).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: verificationMessages.applying.checkAgain }));
      expect(await screen.findByRole('heading', { name: verificationMessages.passedChallenge.title })).toBeVisible();
    },
  );
  it.each(['applying', 'unavailable'] as const)(
    'preserves the %s result and retry focus during an authority recheck',
    async (state) => {
      const retry = deferred<Response>();
      const response =
        state === 'applying'
          ? {
              identity: {
                traits: { email: 'old@example.test', pending_email: 'new@example.test' },
                verifiable_addresses: [{ via: 'email', value: 'new@example.test', verified: true }],
              },
            }
          : {};
      const status = state === 'applying' ? 200 : 503;
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(jsonResponse(verificationFlow({ state: 'passed_challenge' })))
          .mockResolvedValueOnce(jsonResponse(response, { status }))
          .mockReturnValueOnce(retry.promise),
      );
      const { user } = await renderVerificationContent();
      const title = state === 'applying' ? verificationMessages.applying.title : verificationMessages.unavailable;
      const heading = await screen.findByRole('heading', { name: title });
      const button = screen.getByRole('button', { name: verificationMessages.applying.checkAgain });
      await user.click(button);
      expect(screen.getByRole('heading', { name: title })).toBe(heading);
      expect(button).toHaveFocus();
      const region = screen.getByRole('region', { name: title });
      expect(region).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('status')).toHaveTextContent(verificationMessages.checking);
      await act(async () => retry.resolve(jsonResponse(response, { status })));
      expect(screen.getByRole('heading', { name: title })).toBe(heading);
      expect(button).toHaveFocus();
      expect(button).toBeEnabled();
      expect(region).toHaveAttribute('aria-busy', 'false');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    },
  );
});

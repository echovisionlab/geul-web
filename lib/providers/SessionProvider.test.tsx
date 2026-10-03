// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_INVALIDATED_EVENT } from '@/lib/auth/session-events';
import type { SessionData } from '@/lib/session-data';
import { SessionProvider, useSessionContext } from './SessionProvider';

const cookieMocks = vi.hoisted(() => ({
  clear: vi.fn(),
  write: vi.fn(),
}));

vi.mock('@/lib/auth/user-display-cookie', () => ({
  clearUserDisplaySnapshotCookie: cookieMocks.clear,
  writeUserDisplaySnapshotCookie: cookieMocks.write,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sessionFixture: SessionData = {
  user: {
    id: 'user-1',
    nickname: 'Session User',
    email: 'session@example.com',
    image: null,
    preferred_locale: 'ko',
    role: 'user',
    status: 'active',
  },
  onboarded: true,
  nickname_suggestion: null,
};

let container: HTMLDivElement;
let root: Root;
let observedSession: ReturnType<typeof useSessionContext>;
let sessionRenders: number;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function successfulResponse(data: SessionData | null) {
  return { ok: true, status: 200, json: async () => data };
}

function SessionState() {
  const session = useSessionContext();
  observedSession = session;
  sessionRenders += 1;
  return (
    <output data-email={session?.data?.user.email ?? ''} data-image={session?.data?.user.image ?? ''}>
      {session?.data?.user.nickname ?? 'signed-out'}:{session?.isPending ? 'pending' : 'settled'}:
      {session?.error?.message ?? 'ok'}
    </output>
  );
}

function SessionMemberMutation() {
  const session = useSessionContext();
  return (
    <button
      type="button"
      onClick={() =>
        session?.updateMemberSummary({
          id: 'user-1',
          nickname: 'Updated Member',
          avatarUrl: 'https://cdn.example/member.webp',
          deleted: false,
        })
      }
    >
      update member
    </button>
  );
}

async function renderProvider(initialData: SessionData | null | undefined = sessionFixture, omitInitialData = false) {
  await act(async () => {
    root.render(
      <SessionProvider initialData={omitInitialData ? undefined : initialData}>
        <SessionState />
        <SessionMemberMutation />
      </SessionProvider>,
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  cookieMocks.clear.mockReset();
  cookieMocks.write.mockReset();
  sessionRenders = 0;
  observedSession = null;
  window.history.replaceState({}, '', '/onboarding/nickname');
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('SessionProvider', () => {
  it.each([sessionFixture, null])(
    'joins automatic focus and visibility refreshes without pending hydrated UI (%j)',
    async (initial) => {
      const response = deferred<ReturnType<typeof successfulResponse>>();
      const fetchMock = vi.fn().mockReturnValue(response.promise);
      vi.stubGlobal('fetch', fetchMock);
      await renderProvider(initial);
      const originalContext = observedSession;
      const originalRenders = sessionRenders;
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(observedSession?.isPending).toBe(false);
      expect(observedSession).toBe(originalContext);

      await act(async () => response.resolve(successfulResponse(initial ? structuredClone(initial) : null)));
      expect(observedSession).toBe(originalContext);
      expect(sessionRenders).toBe(originalRenders);

      await act(async () => window.dispatchEvent(new Event('focus')));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it('joins interval refreshes in flight and rechecks again at the next interval', async () => {
    vi.useFakeTimers();
    const response = deferred<ReturnType<typeof successfulResponse>>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(response.promise)
      .mockResolvedValue(successfulResponse(sessionFixture));
    vi.stubGlobal('fetch', fetchMock);
    await renderProvider();
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      vi.advanceTimersByTime(60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(observedSession?.isPending).toBe(false);
    await act(async () => response.resolve(successfulResponse(sessionFixture)));
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps initial unknown sessions pending and joins automatic revalidation into the initial fetch', async () => {
    const response = deferred<ReturnType<typeof successfulResponse>>();
    const fetchMock = vi.fn().mockReturnValue(response.promise);
    vi.stubGlobal('fetch', fetchMock);
    await renderProvider(undefined, true);
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(observedSession?.isPending).toBe(true);
    await act(async () => response.resolve(successfulResponse(sessionFixture)));
    expect(observedSession?.isPending).toBe(false);
    expect(observedSession?.data).toEqual(sessionFixture);
  });

  it('makes explicit refresh pending, aborts automatic work and keeps its newer result', async () => {
    const oldBody = deferred<SessionData>();
    const newResponse = deferred<ReturnType<typeof successfulResponse>>();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => oldBody.promise })
      .mockReturnValueOnce(newResponse.promise);
    vi.stubGlobal('fetch', fetchMock);
    await renderProvider();
    await act(async () => window.dispatchEvent(new Event('focus')));
    await act(async () => void observedSession?.refetch());
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(observedSession?.isPending).toBe(true);
    const newer = { ...sessionFixture, user: { ...sessionFixture.user, role: 'admin' as const } };
    await act(async () => newResponse.resolve(successfulResponse(newer)));
    await act(async () => oldBody.resolve(sessionFixture));
    expect(observedSession?.data).toEqual(newer);
    expect(observedSession?.isPending).toBe(false);
  });

  it.each([
    { ...sessionFixture, onboarded: false },
    { ...sessionFixture, nickname_suggestion: 'Suggested' },
    ...Object.entries({
      id: 'other',
      nickname: 'Other',
      email: null,
      image: '/avatar',
      preferred_locale: 'en',
      role: 'admin',
      status: 'banned',
    }).map(([field, value]) => ({ ...sessionFixture, user: { ...sessionFixture.user, [field]: value } })),
    { ...sessionFixture, additionalAuthState: { scopes: ['changed'] } },
  ])('publishes every changed server session field immediately (%j)', async (updated) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(successfulResponse(updated as SessionData)));
    await renderProvider();
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(observedSession?.data).toEqual(updated);
    expect(observedSession?.isPending).toBe(false);
  });

  it('aborts on unmount and ignores a late accepted response body', async () => {
    const body = deferred<SessionData>();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => body.promise });
    vi.stubGlobal('fetch', fetchMock);
    await renderProvider();
    await act(async () => window.dispatchEvent(new Event('focus')));
    act(() => root.unmount());
    const cookieWrites = cookieMocks.write.mock.calls.length;
    await act(async () => body.resolve({ ...sessionFixture, user: { ...sessionFixture.user, nickname: 'Late' } }));
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(cookieMocks.write).toHaveBeenCalledTimes(cookieWrites);
  });

  it('releases in-flight work after a synchronous fetch failure so focus retries', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('offline');
      })
      .mockResolvedValueOnce(successfulResponse(sessionFixture));
    vi.stubGlobal('fetch', fetchMock);
    await renderProvider();
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(observedSession?.error?.message).toBe('offline');
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(observedSession?.error).toBeNull();
  });

  it('preserves explicit onboarding completion and display cookie updates', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await renderProvider({ ...sessionFixture, onboarded: false, nickname_suggestion: 'Suggested' });
    act(() =>
      observedSession?.completeOnboarding({
        id: sessionFixture.user.id,
        nickname: 'Complete',
        avatarUrl: '/avatar',
        deleted: false,
      }),
    );
    expect(observedSession?.data).toEqual({
      ...sessionFixture,
      onboarded: true,
      nickname_suggestion: null,
      user: { ...sessionFixture.user, nickname: 'Complete', image: '/avatar' },
    });
    expect(cookieMocks.write).toHaveBeenLastCalledWith({ name: 'Complete', image: '/avatar' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses hydrated viewer data without an initial duplicate session request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await renderProvider();
    await act(async () => Promise.resolve());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Session User:settled');
  });

  it('does not persist the UUID placeholder as display state before onboarding', async () => {
    window.history.replaceState({}, '', '/onboarding/nickname');
    await renderProvider({
      ...sessionFixture,
      user: {
        ...sessionFixture.user,
        id: '646b433a-e294-47cf-9b40-5e368c0b0f64',
        nickname: '646b433a-e294-47cf-9b40-5e368c0b0f64',
      },
      onboarded: false,
      nickname_suggestion: 'SuggestedName',
    });

    expect(cookieMocks.write).not.toHaveBeenCalled();
    expect(cookieMocks.clear).toHaveBeenCalled();
  });

  it('applies a bounded Member summary mutation without refetching Account or profile data', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await renderProvider();

    await act(async () => {
      container.querySelector('button')?.click();
    });

    const output = container.querySelector('output');
    expect(output?.textContent).toContain('Updated Member:settled');
    expect(output?.dataset.image).toBe('https://cdn.example/member.webp');
    expect(output?.dataset.email).toBe('session@example.com');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears authenticated UI state immediately when a secure RPC invalidates the session', async () => {
    await renderProvider();
    expect(container.textContent).toContain('Session User:settled');

    act(() => window.dispatchEvent(new Event(SESSION_INVALIDATED_EVENT)));

    expect(container.textContent).toContain('signed-out:settled');
    expect(cookieMocks.clear).toHaveBeenCalled();
  });

  it('revalidates on focus and clears a session confirmed expired by the server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await renderProvider();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    });
    expect(container.textContent).toContain('signed-out:settled');
  });

  it('keeps the current user visible when session revalidation has a transient server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await renderProvider();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Session User:settled');
    expect(container.textContent).toContain('Session refresh failed with status 503');
  });

  it('does not restore an invalidated session when an accepted response body finishes late', async () => {
    let finishBody!: (data: SessionData) => void;
    const json = vi.fn(
      () =>
        new Promise<SessionData>((resolve) => {
          finishBody = resolve;
        }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json }));
    await renderProvider();
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(json).toHaveBeenCalledOnce();

    act(() => window.dispatchEvent(new Event(SESSION_INVALIDATED_EVENT)));
    await act(async () => finishBody(sessionFixture));

    expect(container.textContent).toContain('signed-out:settled');
  });

  it('keeps the newest refresh when an older response body finishes last', async () => {
    let finishBody!: (data: SessionData) => void;
    const newer = { ...sessionFixture, user: { ...sessionFixture.user, nickname: 'New session' } };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            new Promise<SessionData>((resolve) => {
              finishBody = resolve;
            }),
        })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => newer }),
    );
    await renderProvider();
    await act(async () => void observedSession?.refetch());
    await act(async () => void observedSession?.refetch());
    await act(async () => finishBody(sessionFixture));

    expect(container.textContent).toContain('New session:settled');
  });
});

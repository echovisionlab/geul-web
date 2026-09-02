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

function SessionState() {
  const session = useSessionContext();
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

async function renderProvider(initialData: SessionData | null = sessionFixture) {
  await act(async () => {
    root.render(
      <SessionProvider initialData={initialData}>
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
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('SessionProvider', () => {
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
});

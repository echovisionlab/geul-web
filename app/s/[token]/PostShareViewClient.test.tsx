// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  accessPostShareAction: vi.fn(),
  lastPostViewProps: null as Record<string, unknown> | null,
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/lib/actions/post-share', () => ({
  accessPostShareAction: mocks.accessPostShareAction,
}));
vi.mock('@/features/post/post-view-model', () => ({
  toPostViewModel: (post: unknown) => post,
}));
vi.mock('@/features/share/SharePasswordView', () => ({
  SharePasswordView: ({
    password,
    onPasswordChange,
  }: {
    password: string;
    onPasswordChange: (value: string) => void;
  }) => (
    <>
      <input
        name="password"
        aria-label="password"
        value={password}
        onChange={(event) => onPasswordChange(event.currentTarget.value)}
      />
      <button type="submit">Open post</button>
    </>
  ),
}));
vi.mock('@/features/post/PostViewContent', () => ({
  PostViewContent: (props: Record<string, unknown>) => {
    mocks.lastPostViewProps = props;
    return (
      <button
        type="button"
        onClick={() => (props.onRequestedLocaleChange as ((locale: string) => void) | undefined)?.('ko')}
      >
        View Korean
      </button>
    );
  },
}));

import { PostShareViewClient } from './PostShareViewClient';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  mocks.accessPostShareAction.mockReset();
  mocks.lastPostViewProps = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('PostShareViewClient', () => {
  it('reuses the in-memory password for locale changes without adding it to the URL', async () => {
    mocks.accessPostShareAction.mockImplementation(async (_state: unknown, formData: FormData) => {
      const requestedLocale = String(formData.get('requestedLocale'));
      return {
        post: { id: 'post-1', slug: 'shared-post', title: requestedLocale === 'ko' ? '한국어' : 'English' },
        allowedActions: [],
        requestedLocale,
      };
    });

    act(() => {
      root?.render(
        <PostShareViewClient
          token="share-token"
          idOrSlug="shared-post"
          requestedLocale="en"
          initialState={{}}
          passwordRequired
        />,
      );
    });

    const passwordInput = container?.querySelector<HTMLInputElement>('input[name="password"]');
    expect(passwordInput).not.toBeNull();
    act(() => {
      if (passwordInput) {
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setValue?.call(passwordInput, 'one-time-secret');
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    act(() => container?.querySelector<HTMLFormElement>('form')?.requestSubmit());
    await flushUpdates();

    expect(mocks.accessPostShareAction).toHaveBeenCalledTimes(1);
    expect((mocks.accessPostShareAction.mock.calls[0]?.[1] as FormData).get('password')).toBe('one-time-secret');
    expect(mocks.lastPostViewProps?.requestedLocale).toBe('en');

    act(() => container?.querySelector<HTMLButtonElement>('button')?.click());
    await flushUpdates();

    expect(mocks.accessPostShareAction).toHaveBeenCalledTimes(2);
    const localeFormData = mocks.accessPostShareAction.mock.calls[1]?.[1] as FormData;
    expect(localeFormData.get('requestedLocale')).toBe('ko');
    expect(localeFormData.get('password')).toBe('one-time-secret');
    expect(mocks.lastPostViewProps).toMatchObject({
      requestedLocale: 'ko',
      sharePassword: 'one-time-secret',
    });
    expect(window.location.href).not.toContain('one-time-secret');
  });
});

// @vitest-environment jsdom

import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { PublicFormView } from './PublicFormView';

const pushMock = vi.fn();
const submitFormActionMock = vi.fn();
const buildFormMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const map: Record<string, string> = {
      'publicForm.logoLinkAria': 'Go home',
      'publicForm.previewMode.title': 'Preview',
      'publicForm.previewMode.description': 'Preview description',
      'common.states.loading': 'Loading...',
    };
    return map[`${namespace}.${key}`] ?? `${namespace}.${key}`;
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('@/features/site/SiteLogo', () => ({
  SiteLogo: ({ height }: { height?: number }) => (
    <div data-testid="site-logo" data-height={height}>
      Logo
    </div>
  ),
}));

vi.mock('@/features/site/PageLoader', () => ({
  PageLoader: ({ message }: { message?: string }) => <div data-testid="page-loader">{message}</div>,
}));

vi.mock('@/features/form/FormAccessBoundary', () => ({
  FormAccessBoundary: ({ reason }: { reason: string }) => <div data-testid="access-boundary">{reason}</div>,
}));

vi.mock('@/features/form/FormRenderer', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    FormRenderer: ({
      form,
      onSubmit,
    }: {
      form: { id: string };
      onSubmit?: (values: Record<string, unknown>) => Promise<void>;
    }) => {
      const [email, setEmail] = React.useState('hello@example.com');

      return (
        <div data-testid="form-renderer">
          {form.id}
          <div data-testid="form-email-value">{email}</div>
          <button type="button" onClick={() => setEmail('persisted@example.com')}>
            Use persisted email
          </button>
          <input data-testid="form-email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
          <button type="button" onClick={() => onSubmit?.({ email })}>
            Submit form
          </button>
        </div>
      );
    },
  };
});

vi.mock('@/lib/contexts/ManifestContext', () => ({
  useSiteSettings: () => ({
    settings: {
      site_origin: 'https://studio.example.com',
      loader_urls: [],
    },
  }),
}));

vi.mock('@/lib/actions/form', () => ({
  checkFormAccessAction: vi.fn(),
  submitFormAction: (...args: unknown[]) => submitFormActionMock(...args),
  verifyFormPasswordAction: vi.fn(),
}));

vi.mock('@/lib/form/build', () => ({
  buildForm: (schema: { id: string }) => buildFormMock(schema),
}));

vi.mock('@/lib/utils/site-url', () => ({
  resolveSiteHref: () => 'https://studio.example.com',
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <MantineProvider>{node}</MantineProvider>
      </QueryClientProvider>,
    );
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function waitForAssertion(assertion: () => void, attempts = 6) {
  let lastError: unknown;

  for (let index = 0; index < attempts; index += 1) {
    await flush();
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

beforeEach(() => {
  pushMock.mockReset();
  submitFormActionMock.mockReset();
  buildFormMock.mockReset();
  vi.mocked(notifications.show).mockReset();
  buildFormMock.mockImplementation((schema: { id: string }) => ({ id: schema.id }));
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('PublicFormView', () => {
  it('uses the shared shell logo size', async () => {
    render(
      <PublicFormView
        slug="contact"
        form={{
          id: 'form-1',
          title: '문의하기',
          slug: 'contact',
          schema: { id: 'schema-1', steps: [] },
          status: 'published',
          isPublic: true,
          requireAuth: false,
          allowedRoles: [],
          allowDuplicateSubmission: true,
          hasPassword: false,
        }}
        accessData={null}
        requestedLocale="ko"
        viewerCountryCode="KR"
      />,
    );

    await waitForAssertion(() => {
      expect(document.querySelector('[data-testid="site-logo"]')?.getAttribute('data-height')).toBe('16');
    });
  });

  it('shows the shared pending loader while submitting before routing to success', async () => {
    let resolveSubmit: ((value: { success: true }) => void) | undefined;
    submitFormActionMock.mockImplementation(
      () =>
        new Promise<{ success: true }>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(
      <PublicFormView
        slug="contact"
        form={{
          id: 'form-1',
          title: '문의하기',
          slug: 'contact',
          schema: { id: 'schema-1', steps: [] },
          status: 'published',
          isPublic: true,
          requireAuth: false,
          allowedRoles: [],
          allowDuplicateSubmission: true,
          hasPassword: false,
        }}
        accessData={null}
        requestedLocale="ko"
        viewerCountryCode="KR"
      />,
    );

    await waitForAssertion(() => {
      expect(document.querySelector('[data-testid="form-renderer"]')).not.toBeNull();
    });

    const submitButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Submit form',
    );
    expect(submitButton).not.toBeNull();

    await act(async () => {
      submitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    await waitForAssertion(() => {
      expect(document.querySelector('[data-testid="page-loader"]')?.textContent).toContain('Loading...');
    });
    expect(document.querySelector('[data-testid="form-renderer"]')).not.toBeNull();

    await act(async () => {
      resolveSubmit?.({ success: true });
      await Promise.resolve();
    });

    await waitForAssertion(() => {
      expect(pushMock).toHaveBeenCalledWith('/forms/contact/success?lang=ko');
    });
  });

  it('keeps typed values mounted when a handled submit error returns after pending', async () => {
    let resolveSubmit: ((value: { error: string }) => void) | undefined;
    submitFormActionMock.mockImplementation(
      () =>
        new Promise<{ error: string }>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(
      <PublicFormView
        slug="contact"
        form={{
          id: 'form-1',
          title: '문의하기',
          slug: 'contact',
          schema: { id: 'schema-1', steps: [] },
          status: 'published',
          isPublic: true,
          requireAuth: false,
          allowedRoles: [],
          allowDuplicateSubmission: true,
          hasPassword: false,
        }}
        accessData={null}
        requestedLocale="ko"
        viewerCountryCode="KR"
      />,
    );

    await waitForAssertion(() => {
      expect(document.querySelector('[data-testid="form-renderer"]')).not.toBeNull();
    });

    const usePersistedEmailButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Use persisted email',
    );
    const submitButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Submit form',
    );
    expect(usePersistedEmailButton).not.toBeNull();
    expect(submitButton).not.toBeNull();

    await act(async () => {
      usePersistedEmailButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    await act(async () => {
      submitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    await waitForAssertion(() => {
      expect(document.querySelector('[data-testid="page-loader"]')).not.toBeNull();
    });
    expect(document.querySelector('[data-testid="form-renderer"]')).not.toBeNull();

    await act(async () => {
      resolveSubmit?.({ error: 'Submission failed' });
      await Promise.resolve();
    });

    await waitForAssertion(() => {
      expect(vi.mocked(notifications.show)).toHaveBeenCalledWith({
        message: 'Submission failed',
        color: 'red',
      });
    });

    expect(document.querySelector('[data-testid="form-email-value"]')?.textContent).toBe('persisted@example.com');
    expect(document.querySelector('[data-testid="form-renderer"]')).not.toBeNull();
  });
});

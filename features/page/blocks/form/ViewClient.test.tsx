// @vitest-environment jsdom

import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { FormViewClient } from './ViewClient';

const checkFormAccessActionMock = vi.fn();
const submitFormActionMock = vi.fn();
const buildFormMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const map: Record<string, string> = {
      'publicForm.logoLinkAria': 'Go home',
      'embeddedForm.password.description': 'Password required',
      'embeddedForm.password.requiredTitle': 'Password required',
      'embeddedForm.password.requiredMessage': 'Enter a password',
      'embeddedForm.password.incorrect': 'Incorrect password',
      'common.actions.continue': 'Continue',
      'common.placeholders.password': 'Password',
      'common.messages.formSubmittedSuccessfully': 'Submitted successfully',
      'formSuccessPage.title': 'Thanks',
      'embeddedForm.states.noFormSelected': 'No form selected',
      'embeddedForm.submission.failedTitle': 'Submit failed',
      'embeddedForm.submission.unknownError': 'Unknown error',
    };
    return map[`${namespace}.${key}`] ?? `${namespace}.${key}`;
  },
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('@/components/core/Input', () => ({
  PasswordInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <button
        type="button"
        onClick={() =>
          props.onChange?.({
            currentTarget: { value: '  secret  ' },
          } as React.ChangeEvent<HTMLInputElement>)
        }
      >
        Fill password
      </button>
      <input value={props.value} readOnly />
    </div>
  ),
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
      onSubmit: (values: Record<string, unknown>) => Promise<void>;
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
          <button type="button" onClick={() => onSubmit({ email })}>
            Submit form
          </button>
        </div>
      );
    },
  };
});

vi.mock('@/features/form/FormSubmissionState', () => ({
  FormSubmissionPendingState: () => <div data-testid="submission-pending">Loading...</div>,
  FormSubmissionSuccessState: () => <div data-testid="submission-success">Thanks Submitted successfully</div>,
}));

vi.mock('@/lib/contexts/ManifestContext', () => ({
  useSiteSettings: () => ({
    settings: {
      site_origin: 'https://studio.example.com',
    },
  }),
}));

vi.mock('@/lib/actions/form', () => ({
  checkFormAccessAction: (...args: unknown[]) => checkFormAccessActionMock(...args),
  submitFormAction: (...args: unknown[]) => submitFormActionMock(...args),
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
  checkFormAccessActionMock.mockReset();
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

describe('FormViewClient', () => {
  it('passes requestedLocale through the embed access query', async () => {
    checkFormAccessActionMock.mockResolvedValue({
      accessible: true,
      form: {
        id: 'form-1',
        title: '문의하기',
        schema: { id: 'schema-1' },
      },
    });

    render(<FormViewClient props={{ formId: 'contact', showTitle: 'true' }} requestedLocale="ko" />);
    await flush();

    expect(checkFormAccessActionMock).toHaveBeenCalledWith({
      slug: 'contact',
      context: 'embed',
      password: undefined,
      requestedLocale: 'ko',
    });
    await waitForAssertion(() => {
      expect(document.body.textContent).toContain('문의하기');
      expect(document.querySelector('[data-testid="form-renderer"]')?.textContent).toContain('schema-1');
    });
  });

  it('does not render the standalone form page logo in embedded block views', async () => {
    checkFormAccessActionMock.mockResolvedValue({
      accessible: true,
      form: {
        id: 'form-1',
        title: '문의하기',
        schema: { id: 'schema-1' },
      },
    });

    render(<FormViewClient props={{ formId: 'contact', showTitle: 'true' }} requestedLocale="ko" />);

    await waitForAssertion(() => {
      expect(document.querySelector('[data-testid="form-renderer"]')).not.toBeNull();
    });
    expect(document.querySelector('[data-testid="site-logo"]')).toBeNull();
  });

  it('renders an empty-state message when no form is selected', () => {
    render(<FormViewClient props={{ formId: '', showTitle: 'true' }} requestedLocale="ko" />);

    expect(checkFormAccessActionMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('No form selected');
  });

  it('renders the access boundary for non-password access failures', async () => {
    checkFormAccessActionMock.mockResolvedValue({
      accessible: false,
      reason: 'form_not_found',
      form: null,
    });

    render(<FormViewClient props={{ formId: 'contact', showTitle: 'true' }} requestedLocale="ko" />);

    await waitForAssertion(() => {
      expect(document.querySelector('[data-testid="access-boundary"]')?.textContent).toBe('form_not_found');
    });
  });

  it('preserves requestedLocale when retrying password-protected access and trims the password', async () => {
    checkFormAccessActionMock
      .mockResolvedValueOnce({
        accessible: false,
        reason: 'password_required',
        form: null,
      })
      .mockResolvedValueOnce({
        accessible: false,
        reason: 'password_required',
        form: null,
      });

    render(<FormViewClient props={{ formId: 'contact', showTitle: 'false' }} requestedLocale="ko" />);
    await flush();
    await flush();

    const fillPasswordButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Fill password',
    );
    expect(fillPasswordButton).not.toBeNull();

    act(() => {
      fillPasswordButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const form = document.querySelector('form');
    expect(form).not.toBeNull();

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await flush();

    expect(checkFormAccessActionMock).toHaveBeenNthCalledWith(2, {
      slug: 'contact',
      context: 'embed',
      password: 'secret',
      requestedLocale: 'ko',
    });
  });

  it('falls back to server_error when localized schema cannot be built', async () => {
    buildFormMock.mockImplementation(() => {
      throw new Error('bad schema');
    });
    checkFormAccessActionMock.mockResolvedValue({
      accessible: true,
      form: {
        id: 'form-1',
        title: '문의하기',
        schema: { id: 'schema-1' },
      },
    });

    render(<FormViewClient props={{ formId: 'contact', showTitle: 'true' }} requestedLocale="ko" />);
    await flush();

    await waitForAssertion(() => {
      expect(document.querySelector('[data-testid="access-boundary"]')?.textContent).toBe('server_error');
    });
  });

  it('shows the success state after a successful submission', async () => {
    checkFormAccessActionMock.mockResolvedValue({
      accessible: true,
      form: {
        id: 'form-1',
        title: '문의하기',
        schema: { id: 'schema-1' },
      },
    });
    submitFormActionMock.mockResolvedValue({ success: true });

    render(<FormViewClient props={{ formId: 'contact', showTitle: 'true' }} requestedLocale="ko" />);
    await waitForAssertion(() => {
      expect(document.querySelector('[data-testid="form-renderer"]')).not.toBeNull();
    });

    const getSubmitButton = () =>
      Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Submit form');

    await waitForAssertion(() => {
      expect(getSubmitButton()).not.toBeNull();
    });

    await act(async () => {
      getSubmitButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    await waitForAssertion(() => {
      expect(submitFormActionMock).toHaveBeenCalledWith('form-1', { email: 'hello@example.com' }, undefined, 'ko');
    });
    expect(document.body.textContent).toContain('Thanks');
    expect(document.body.textContent).toContain('Submitted successfully');
  });

  it('keeps embedded form submissions local in preview mode', async () => {
    checkFormAccessActionMock.mockResolvedValue({
      accessible: true,
      form: {
        id: 'form-1',
        title: '문의하기',
        schema: { id: 'schema-1' },
      },
    });
    submitFormActionMock.mockResolvedValue({ success: true });

    render(<FormViewClient props={{ formId: 'contact', showTitle: 'true' }} requestedLocale="ko" preview />);
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

    expect(submitFormActionMock).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('Submitted successfully');
    expect(document.querySelector('[data-testid="form-renderer"]')).not.toBeNull();
  });

  it('shows the shared pending state while a submission is in flight', async () => {
    checkFormAccessActionMock.mockResolvedValue({
      accessible: true,
      form: {
        id: 'form-1',
        title: '문의하기',
        schema: { id: 'schema-1' },
      },
    });

    let resolveSubmit: ((value: { success: true }) => void) | undefined;
    submitFormActionMock.mockImplementation(
      () =>
        new Promise<{ success: true }>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(<FormViewClient props={{ formId: 'contact', showTitle: 'true' }} requestedLocale="ko" />);
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
      expect(document.querySelector('[data-testid="submission-pending"]')?.textContent).toContain('Loading...');
    });
    expect(document.querySelector('[data-testid="form-renderer"]')).not.toBeNull();

    await act(async () => {
      resolveSubmit?.({ success: true });
      await Promise.resolve();
    });

    await waitForAssertion(() => {
      expect(document.querySelector('[data-testid="submission-success"]')?.textContent).toContain('Thanks');
    });
  });

  it('surfaces submission errors through notifications without entering the success state', async () => {
    checkFormAccessActionMock.mockResolvedValue({
      accessible: true,
      form: {
        id: 'form-1',
        title: '문의하기',
        schema: { id: 'schema-1' },
      },
    });
    submitFormActionMock.mockResolvedValue({ error: 'Submission failed' });

    render(<FormViewClient props={{ formId: 'contact', showTitle: 'true' }} requestedLocale="ko" />);
    await waitForAssertion(() => {
      expect(document.querySelector('[data-testid="form-renderer"]')).not.toBeNull();
    });

    const getSubmitButton = () =>
      Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Submit form');

    await waitForAssertion(() => {
      expect(getSubmitButton()).not.toBeNull();
    });

    await act(async () => {
      getSubmitButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    await waitForAssertion(() => {
      expect(submitFormActionMock).toHaveBeenCalledWith('form-1', { email: 'hello@example.com' }, undefined, 'ko');
    });
    await waitForAssertion(() => {
      expect(vi.mocked(notifications.show)).toHaveBeenCalledWith({
        title: 'Submit failed',
        message: 'Submission failed',
        color: 'red',
      });
    });
    expect(document.body.textContent).not.toContain('Submitted successfully');
  });

  it('keeps typed values mounted after a handled submit error', async () => {
    checkFormAccessActionMock.mockResolvedValue({
      accessible: true,
      form: {
        id: 'form-1',
        title: '문의하기',
        schema: { id: 'schema-1' },
      },
    });
    let resolveSubmit: ((value: { error: string }) => void) | undefined;
    submitFormActionMock.mockImplementation(
      () =>
        new Promise<{ error: string }>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    render(<FormViewClient props={{ formId: 'contact', showTitle: 'true' }} requestedLocale="ko" />);
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
      expect(document.querySelector('[data-testid="submission-pending"]')).not.toBeNull();
    });
    expect(document.querySelector('[data-testid="form-renderer"]')).not.toBeNull();

    await act(async () => {
      resolveSubmit?.({ error: 'Submission failed' });
      await Promise.resolve();
    });

    await waitForAssertion(() => {
      expect(vi.mocked(notifications.show)).toHaveBeenCalledWith({
        title: 'Submit failed',
        message: 'Submission failed',
        color: 'red',
      });
    });

    expect(document.querySelector('[data-testid="form-email-value"]')?.textContent).toBe('persisted@example.com');
    expect(document.querySelector('[data-testid="form-renderer"]')).not.toBeNull();
  });
});

// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import enMessages from '@/messages/en.json';
import { EmailLayoutPreview, type EmailLayoutPreviewBindings } from './EmailLayoutPreview';

const adapters = vi.hoisted(() => ({ content: vi.fn(), saved: vi.fn() }));
vi.mock('@/lib/actions/email-layout', () => ({ previewEmailLayoutContentAction: adapters.content }));
vi.mock('@/lib/queries/email-layout', () => ({ previewEmailLayout: adapters.saved }));
afterEach(() => vi.clearAllMocks());

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const contentResult = (html: string) => ({ html, valid: true, errors: [] });
const title = enMessages.adminList.emailLayouts.detail.preview.iframeTitle;
const loading = enMessages.common.states.loadingPreview;
const failed = enMessages.adminList.emailLayouts.detail.preview.validationErrors.UNKNOWN_ERROR;
function renderPreview(overrides: Partial<ComponentProps<typeof EmailLayoutPreview>> = {}) {
  const props = { htmlContent: '<html>A</html>', locale: 'ko', sourceLocale: 'ko', debounceMs: 0, ...overrides };
  const view = render(<EmailLayoutPreview {...props} />);
  return {
    ...view,
    rerender: (patch: Partial<ComponentProps<typeof EmailLayoutPreview>>) => {
      Object.assign(props, patch);
      view.rerender(<EmailLayoutPreview {...props} />);
    },
  };
}

it('shows the shared initial wait, retains a resolved preview while updating, and ignores a late older result', async () => {
  const previous = deferred<ReturnType<typeof contentResult>>();
  const current = deferred<ReturnType<typeof contentResult>>();
  const content = vi
    .fn<EmailLayoutPreviewBindings['content']>()
    .mockReturnValueOnce(previous.promise)
    .mockReturnValueOnce(current.promise)
    .mockResolvedValueOnce(contentResult('<html>C</html>'));
  const preview = renderPreview({ bindings: { content, saved: vi.fn() } });
  expect(screen.getByRole('status')).toHaveTextContent(loading);
  const firstSignal = content.mock.calls[0][3]!;
  preview.rerender({ htmlContent: '<html>B source</html>' });
  await waitFor(() => expect(content).toHaveBeenCalledTimes(2));
  expect(firstSignal.aborted).toBe(true);
  await act(async () => previous.resolve(contentResult('<html>stale A</html>')));
  expect(screen.getByRole('status')).toHaveTextContent(loading);
  await act(async () => current.resolve(contentResult('<html>B</html>')));
  expect(screen.getByTitle(title)).toHaveAttribute('srcdoc', '<html>B</html>');
  preview.rerender({ htmlContent: '<html>C source</html>' });
  expect(screen.getByTitle(title)).toHaveAttribute('srcdoc', '<html>B</html>');
  await waitFor(() => expect(screen.getByTitle(title)).toHaveAttribute('srcdoc', '<html>C</html>'));
});

it('does not clear the current wait when an obsolete request rejects', async () => {
  const previous = deferred<ReturnType<typeof contentResult>>();
  const current = deferred<ReturnType<typeof contentResult>>();
  const content = vi
    .fn<EmailLayoutPreviewBindings['content']>()
    .mockReturnValueOnce(previous.promise)
    .mockReturnValueOnce(current.promise);
  const preview = renderPreview({ bindings: { content, saved: vi.fn() } });
  preview.rerender({ htmlContent: '<html>B</html>' });
  await waitFor(() => expect(content).toHaveBeenCalledTimes(2));
  await act(async () => previous.reject(new Error('obsolete request failed')));
  expect(screen.getByRole('status')).toHaveTextContent(loading);
  await act(async () => current.resolve(contentResult('<html>B</html>')));
  expect(screen.getByTitle(title)).toHaveAttribute('srcdoc', '<html>B</html>');
});

it('distinguishes resolved blank input from a pending request and ignores its late success', async () => {
  const pending = deferred<ReturnType<typeof contentResult>>();
  const content = vi.fn<EmailLayoutPreviewBindings['content']>().mockReturnValueOnce(pending.promise);
  const preview = renderPreview({ bindings: { content, saved: vi.fn() } });
  const signal = content.mock.calls[0][3]!;
  preview.rerender({ htmlContent: '   ' });
  expect(await screen.findByText(enMessages.adminList.emailLayouts.detail.preview.empty)).toBeVisible();
  expect(signal.aborted).toBe(true);
  expect(content).toHaveBeenCalledOnce();
  await act(async () => pending.resolve(contentResult('<html>obsolete</html>')));
  expect(screen.queryByTitle(title)).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('preserves a failed new locale when an older locale completes later', async () => {
  const previous = deferred<{ html: string }>();
  const saved = vi
    .fn<EmailLayoutPreviewBindings['saved']>()
    .mockReturnValueOnce(previous.promise)
    .mockResolvedValueOnce(null);
  const preview = renderPreview({ layoutId: 'layout', locale: 'en', bindings: { content: vi.fn(), saved } });
  preview.rerender({ locale: 'ja' });
  expect(await screen.findByRole('alert')).toHaveTextContent(failed);
  expect(saved.mock.calls.map((call) => call[2])).toEqual(['en', 'ja']);
  expect(saved.mock.calls[0][3]!.aborted).toBe(true);
  await act(async () => previous.resolve({ html: '<html>obsolete English</html>' }));
  expect(screen.getByRole('alert')).toHaveTextContent(failed);
  expect(screen.queryByTitle(title)).not.toBeInTheDocument();
});

it('aborts on unmount even when the adapter cannot cancel work', async () => {
  const pending = deferred<ReturnType<typeof contentResult>>();
  const content = vi.fn<EmailLayoutPreviewBindings['content']>().mockReturnValueOnce(pending.promise);
  const preview = renderPreview({ bindings: { content, saved: vi.fn() } });
  const signal = content.mock.calls[0][3]!;
  expect(signal.aborted).toBe(false);
  preview.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => pending.reject(new Error('completed after unmount')));
  expect(content).toHaveBeenCalledOnce();
});

it('keeps AbortSignal out of production server-action arguments', async () => {
  adapters.content.mockResolvedValueOnce(contentResult('<html>source</html>'));
  adapters.saved.mockResolvedValueOnce({ html: '<html>localized</html>' });
  const preview = renderPreview();
  expect(await screen.findByTitle(title)).toHaveAttribute('srcdoc', '<html>source</html>');
  expect(adapters.content).toHaveBeenCalledExactlyOnceWith('<html>A</html>', expect.any(String), 'ko');
  preview.rerender({ layoutId: 'layout', locale: 'en' });
  await waitFor(() => expect(screen.getByTitle(title)).toHaveAttribute('srcdoc', '<html>localized</html>'));
  expect(adapters.saved).toHaveBeenCalledExactlyOnceWith('layout', expect.any(String), 'en');
});

// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi, type TestContext } from 'vitest';
import { EmailLayoutPreview, type EmailLayoutPreviewBindings } from './EmailLayoutPreview';
import type { EmailLayoutPreviewViewProps } from './EmailLayoutPreviewView';

const adapters = vi.hoisted(() => ({
  translate: (key: string) => key,
  content: vi.fn(),
  saved: vi.fn(),
}));
vi.mock('next-intl', () => ({ useTranslations: () => adapters.translate }));
// These tests own response ordering; Mantine owns the independent debounce delay.
vi.mock('@mantine/hooks', () => ({ useDebouncedValue: (value: unknown) => [value] }));
vi.mock('@/lib/actions/email-layout', () => ({ previewEmailLayoutContentAction: adapters.content }));
vi.mock('@/lib/queries/email-layout', () => ({ previewEmailLayout: adapters.saved }));
vi.mock('./EmailLayoutPreviewView', () => ({
  EmailLayoutPreviewView: (props: EmailLayoutPreviewViewProps) => <output>{JSON.stringify(props)}</output>,
}));

afterEach(() => vi.clearAllMocks());

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function contentResult(html: string) {
  return { html, valid: true, errors: [] };
}

function renderPreview(context: TestContext, overrides: Partial<ComponentProps<typeof EmailLayoutPreview>> = {}) {
  const container = document.createElement('div');
  const root = createRoot(container);
  let mounted = true;
  const unmount = () => {
    if (!mounted) return;
    act(() => root.unmount());
    mounted = false;
  };
  context.onTestFinished(unmount);
  const props: ComponentProps<typeof EmailLayoutPreview> = {
    htmlContent: '<html>A</html>',
    locale: 'ko',
    sourceLocale: 'ko',
    ...overrides,
  };
  const rerender = (patch: Partial<ComponentProps<typeof EmailLayoutPreview>> = {}) => {
    Object.assign(props, patch);
    act(() => root.render(<EmailLayoutPreview {...props} />));
  };
  rerender();
  return {
    rerender,
    unmount,
    state: () => JSON.parse(container.querySelector('output')!.textContent!) as EmailLayoutPreviewViewProps,
  };
}

describe('email layout preview request ownership', () => {
  it('keeps a newer content result when an older request completes last', async (context) => {
    const previous = deferred<ReturnType<typeof contentResult>>();
    const content = vi
      .fn<EmailLayoutPreviewBindings['content']>()
      .mockReturnValueOnce(previous.promise)
      .mockResolvedValueOnce(contentResult('<html>B</html>'));
    const preview = renderPreview(context, { bindings: { content, saved: vi.fn() } });
    const firstSignal = content.mock.calls[0][3]!;
    await act(async () => preview.rerender({ htmlContent: '<html>B source</html>' }));
    expect(firstSignal.aborted).toBe(true);
    expect(preview.state()).toMatchObject({ previewHtml: '<html>B</html>', errors: [], isLoading: false });
    await act(async () => previous.resolve(contentResult('<html>stale A</html>')));
    expect(preview.state()).toMatchObject({ previewHtml: '<html>B</html>', errors: [], isLoading: false });
  });

  it('does not clear the current loading state when an obsolete request rejects', async (context) => {
    const previous = deferred<ReturnType<typeof contentResult>>();
    const current = deferred<ReturnType<typeof contentResult>>();
    const content = vi
      .fn<EmailLayoutPreviewBindings['content']>()
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise);
    const preview = renderPreview(context, { bindings: { content, saved: vi.fn() } });
    preview.rerender({ htmlContent: '<html>B</html>' });
    await act(async () => previous.reject(new Error('obsolete request failed')));
    expect(preview.state()).toMatchObject({ previewHtml: '', errors: [], isLoading: true });
    await act(async () => current.resolve(contentResult('<html>B</html>')));
    expect(preview.state()).toMatchObject({ previewHtml: '<html>B</html>', errors: [], isLoading: false });
  });

  it('cancels a pending request before clearing blank content and ignores its late success', async (context) => {
    const pending = deferred<ReturnType<typeof contentResult>>();
    const content = vi.fn<EmailLayoutPreviewBindings['content']>().mockReturnValueOnce(pending.promise);
    const preview = renderPreview(context, { bindings: { content, saved: vi.fn() } });
    preview.rerender({ htmlContent: '   ' });
    expect(content.mock.calls[0][3]!.aborted).toBe(true);
    expect(content).toHaveBeenCalledOnce();
    expect(preview.state()).toMatchObject({ previewHtml: '', errors: [], isLoading: false });
    await act(async () => pending.resolve(contentResult('<html>obsolete</html>')));
    expect(preview.state()).toMatchObject({ previewHtml: '', errors: [], isLoading: false });
  });

  it('preserves the latest saved-locale error when a previous locale succeeds later', async (context) => {
    const previous = deferred<{ html: string }>();
    const saved = vi
      .fn<EmailLayoutPreviewBindings['saved']>()
      .mockReturnValueOnce(previous.promise)
      .mockResolvedValueOnce(null);
    const preview = renderPreview(context, { layoutId: 'layout', locale: 'en', bindings: { content: vi.fn(), saved } });
    await act(async () => preview.rerender({ locale: 'ja' }));
    expect(saved.mock.calls.map((call) => call[2])).toEqual(['en', 'ja']);
    expect(saved.mock.calls[0][3]!.aborted).toBe(true);
    expect(preview.state()).toMatchObject({ previewHtml: '', errors: [{ code: 'UNKNOWN_ERROR' }], isLoading: false });
    await act(async () => previous.resolve({ html: '<html>obsolete English</html>' }));
    expect(preview.state()).toMatchObject({ previewHtml: '', errors: [{ code: 'UNKNOWN_ERROR' }], isLoading: false });
  });

  it('aborts the owner signal on unmount even when its adapter cannot cancel work', async (context) => {
    const pending = deferred<ReturnType<typeof contentResult>>();
    const content = vi.fn<EmailLayoutPreviewBindings['content']>().mockReturnValueOnce(pending.promise);
    const preview = renderPreview(context, { bindings: { content, saved: vi.fn() } });
    const signal = content.mock.calls[0][3]!;
    expect(signal.aborted).toBe(false);
    preview.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.reject(new Error('completed after unmount')));
    expect(content).toHaveBeenCalledOnce();
  });

  it('keeps AbortSignal out of the serialized production action and query arguments', async (context) => {
    adapters.content.mockResolvedValueOnce(contentResult('<html>source</html>'));
    adapters.saved.mockResolvedValueOnce({ html: '<html>localized</html>' });
    const preview = renderPreview(context);
    await act(async () => {});
    expect(adapters.content).toHaveBeenCalledExactlyOnceWith('<html>A</html>', expect.any(String), 'ko');
    await act(async () => preview.rerender({ layoutId: 'layout', locale: 'en' }));
    expect(adapters.saved).toHaveBeenCalledExactlyOnceWith('layout', expect.any(String), 'en');
    expect(preview.state()).toMatchObject({ previewHtml: '<html>localized</html>', isLoading: false });
  });
});

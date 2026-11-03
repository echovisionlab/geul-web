// @vitest-environment jsdom
import { act, renderHook } from '@/test/render';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { previewCampaignAction } from '@/lib/actions/campaign';
import { useCampaignPreview } from './useCampaignPreview';

vi.mock('@/lib/actions/campaign', () => ({ previewCampaignAction: vi.fn() }));
let preview: ReturnType<typeof useCampaignPreview>;
let rerender: (options: { locale: string }) => void;
let unmount: () => void;
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  const hook = renderHook(
    ({ locale }) => {
      preview = useCampaignPreview({
        campaignId: 'campaign',
        campaignLoaded: true,
        locale,
        layoutId: null,
        subject: 'unsaved subject',
        editorSynced: false,
        blockRoomController: null,
      });
      return preview;
    },
    { initialProps: { locale: 'ko' } },
  );
  rerender = hook.rerender;
  unmount = hook.unmount;
});
afterEach(() => {
  unmount();
  vi.useRealTimers();
});

it('keeps the last preview while exposing a failed refresh and retrying the current draft', async () => {
  vi.mocked(previewCampaignAction).mockResolvedValueOnce({
    ok: true,
    value: { htmlContent: '<p>draft</p>', subject: 'draft', textContent: 'draft' },
  });
  await act(async () => {
    await preview.refresh();
  });
  vi.mocked(previewCampaignAction).mockResolvedValueOnce({
    ok: false,
    status: 503,
    error: 'Service temporarily unavailable',
  });
  await act(async () => {
    await preview.refresh();
  });
  expect(preview.previewSrcDoc).toBe('<p>draft</p>');
  expect(preview.query.isError).toBe(true);
  expect(preview.query.error).toMatchObject({ status: 503 });
  vi.mocked(previewCampaignAction).mockResolvedValueOnce({
    ok: true,
    value: { htmlContent: '<p>recovered</p>', subject: 'recovered', textContent: 'recovered' },
  });
  await act(async () => {
    await preview.query.refetch();
  });
  expect(preview.previewSrcDoc).toBe('<p>recovered</p>');
  expect(preview.query.isError).toBe(false);
  expect(previewCampaignAction).toHaveBeenLastCalledWith(
    'campaign',
    expect.objectContaining({ subject: 'unsaved subject' }),
  );
});

it('ignores a late failed response after a newer preview succeeds', async () => {
  let finish!: (value: Awaited<ReturnType<typeof previewCampaignAction>>) => void;
  vi.mocked(previewCampaignAction)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce({ ok: true, value: { htmlContent: '<p>new</p>', subject: 'new', textContent: 'new' } });
  let first!: Promise<void>;
  act(() => {
    first = preview.refresh();
  });
  await act(async () => {
    await preview.refresh();
  });
  await act(async () => {
    finish({ ok: false, status: 503, error: 'Service temporarily unavailable' });
    await first;
  });
  expect(preview.previewSrcDoc).toBe('<p>new</p>');
  expect(preview.query.isError).toBe(false);
  expect(preview.query.isFetching).toBe(false);
});

it.each([
  '<!doctype html><html lang="en" dir="ltr"><head><style>blockquote{border-left:2px solid}</style></head><body><blockquote>Quoted text</blockquote></body></html>',
  '  <p>Intentional whitespace</p>\n',
])('passes the renderer document unchanged to srcDoc despite a different editor locale', async (htmlContent) => {
  vi.mocked(previewCampaignAction).mockResolvedValueOnce({
    ok: true,
    value: { htmlContent, subject: 'draft', textContent: 'draft' },
  });
  await act(async () => {
    await preview.refresh();
  });
  expect(preview.previewSrcDoc).toBe(htmlContent);
  expect(previewCampaignAction).toHaveBeenLastCalledWith('campaign', expect.objectContaining({ locale: 'ko' }));
});

it('keeps the new locale waiting when an obsolete locale response arrives', async () => {
  let finish!: (value: Awaited<ReturnType<typeof previewCampaignAction>>) => void;
  vi.mocked(previewCampaignAction).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let first!: Promise<void>;
  act(() => {
    first = preview.refresh();
  });
  rerender({ locale: 'ja' });
  expect(preview.previewSrcDoc).toBe('');
  expect(preview.query.isFetching).toBe(true);
  await act(async () => {
    finish({ ok: true, value: { htmlContent: '<p>obsolete Korean</p>', subject: 'old', textContent: 'old' } });
    await first;
  });
  expect(preview.previewSrcDoc).toBe('');
  expect(preview.query.isFetching).toBe(true);
});

it('does not publish a response or flush a queued preview after unmount', async () => {
  let finish!: (value: Awaited<ReturnType<typeof previewCampaignAction>>) => void;
  vi.mocked(previewCampaignAction).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let first!: Promise<void>;
  act(() => {
    first = preview.refresh();
  });
  unmount();
  await act(async () => {
    finish({ ok: true, value: { htmlContent: '<p>late</p>', subject: 'late', textContent: 'late' } });
    await first;
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(previewCampaignAction).toHaveBeenCalledOnce();
});

it('invalidates the current preview as soon as a new edit is scheduled', async () => {
  let finish!: (value: Awaited<ReturnType<typeof previewCampaignAction>>) => void;
  vi.mocked(previewCampaignAction).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  let first!: Promise<void>;
  act(() => {
    first = preview.refresh();
  });
  act(() => {
    void preview.scheduleRefresh();
  });
  await act(async () => {
    finish({ ok: true, value: { htmlContent: '<p>obsolete before debounce</p>', subject: 'old', textContent: 'old' } });
    await first;
  });
  expect(preview.previewSrcDoc).toBe('');
  expect(preview.query.isFetching).toBe(true);
});

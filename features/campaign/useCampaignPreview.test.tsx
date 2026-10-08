// @vitest-environment jsdom
import { act, useCallback } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { previewCampaignAction } from '@/lib/actions/campaign';
import { useCampaignPreview } from './useCampaignPreview';

vi.mock('@/lib/actions/campaign', () => ({ previewCampaignAction: vi.fn() }));
vi.mock('@/lib/email/preview-document', () => ({ buildEmailPreviewSrcDoc: (html: string) => html }));
vi.mock('@mantine/hooks', () => ({
  useDebouncedCallback: () => useCallback(() => undefined, []),
}));
let root: Root;
let preview: ReturnType<typeof useCampaignPreview>;
function Editor() {
  preview = useCampaignPreview({
    campaignId: 'campaign',
    campaignLoaded: true,
    locale: 'ko',
    layoutId: null,
    subject: 'unsaved subject',
    editorSynced: false,
    blockRoomController: null,
  });
  return null;
}
beforeEach(() => {
  vi.resetAllMocks();
  root = createRoot(document.createElement('div'));
  act(() => root.render(<Editor />));
});
afterEach(() => {
  act(() => root.unmount());
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

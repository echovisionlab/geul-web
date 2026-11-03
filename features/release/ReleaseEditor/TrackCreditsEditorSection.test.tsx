// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationRegion, notifications } from '@/components/core/Notification';
import type { ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';
import { act, render as renderUI, screen, waitFor } from '@/test/render';
import { TrackCreditsEditorSection } from './TrackCreditsEditorSection';

const actions = vi.hoisted(() => ({ setTrackCredits: vi.fn(), listArtists: vi.fn(), listUsers: vi.fn() }));
vi.mock('@/lib/actions/track', () => ({ setTrackCreditsAction: actions.setTrackCredits }));
vi.mock('@/lib/actions/artist', () => ({ listArtistsAction: actions.listArtists }));
vi.mock('@/lib/actions/user', () => ({ listUsersAdminAction: actions.listUsers }));

let client: QueryClient;
function render(node: ReactElement) {
  return renderUI(
    <QueryClientProvider client={client}>
      {node}
      <NotificationRegion closeLabel="Close" />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  actions.setTrackCredits.mockResolvedValue({ success: true });
  actions.listArtists.mockResolvedValue({ ok: true, value: [] });
  actions.listUsers.mockResolvedValue({ ok: true, value: { data: [] } });
});
afterEach(() => {
  client.clear();
  act(() => notifications.clean());
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('TrackCreditsEditorSection', () => {
  it('sends the visible stable-credit snapshot when adding a credit', async () => {
    const credits: ReleaseTrackItem['credits'] = [
      {
        id: 'credit-1',
        credit_type: 'text',
        artist_id: null,
        artist_name: null,
        artist_slug: null,
        member_id: null,
        member_name: null,
        credited_name: 'Existing',
        credit_role: 'Writer',
        sort_order: 0,
      },
    ];
    const editorOrigin = '30000000-0000-4000-8000-000000000001';
    const onMutationStart = vi.fn(() => editorOrigin);
    const onCreditsChange = vi.fn();
    const { user } = render(
      <TrackCreditsEditorSection
        releaseId="release-1"
        idPrefix="track"
        trackId="track-1"
        credits={credits}
        onCreditsChange={onCreditsChange}
        onMutationStart={onMutationStart}
      />,
    );
    await user.click(screen.getByRole('radio', { name: 'Text' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'New credit');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(onCreditsChange).toHaveBeenCalled());

    expect(actions.setTrackCredits).toHaveBeenCalledWith(
      'track-1',
      expect.arrayContaining([expect.objectContaining({ credited_name: 'New credit' })]),
      [expect.objectContaining({ id: 'credit-1', credited_name: 'Existing', credit_role: 'Writer' })],
      editorOrigin,
    );
    expect(onMutationStart).toHaveBeenCalledOnce();
    expect(onCreditsChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'credit-1' }),
        expect.objectContaining({ credited_name: 'New credit' }),
      ]),
    );
  });
});

it('keeps removal pending on its own command and blocks repeated removal', async () => {
  let finish!: (result: { success: boolean }) => void;
  actions.setTrackCredits.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const credits: ReleaseTrackItem['credits'] = [
    {
      id: 'credit-1',
      credit_type: 'text',
      artist_id: null,
      artist_name: null,
      artist_slug: null,
      member_id: null,
      member_name: null,
      credited_name: 'Existing',
      credit_role: null,
      sort_order: 0,
    },
  ];
  const onCreditsChange = vi.fn();
  const { user } = render(
    <TrackCreditsEditorSection
      releaseId="release-1"
      trackId="track-1"
      credits={credits}
      onCreditsChange={onCreditsChange}
    />,
  );
  const remove = screen.getByRole('button', { name: 'Remove' });
  await user.click(remove);
  expect(remove).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('button', { name: 'Add' })).not.toHaveAttribute('aria-busy', 'true');
  await user.click(remove);
  expect(actions.setTrackCredits).toHaveBeenCalledOnce();
  expect(onCreditsChange).not.toHaveBeenCalled();
  await act(async () => finish({ success: true }));
  await waitFor(() => expect(onCreditsChange).toHaveBeenCalledWith([]));
  expect(remove).not.toHaveAttribute('aria-busy', 'true');
});

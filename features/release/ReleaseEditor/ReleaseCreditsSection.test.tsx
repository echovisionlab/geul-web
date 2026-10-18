// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationRegion, notifications } from '@/components/core/Notification';
import type { ReleaseCreditItem } from '@/lib/types/release/model';
import { act, render as renderUI, screen, within, waitFor } from '@/test/render';
import { ReleaseCreditsSection } from './ReleaseCreditsSection';

const actions = vi.hoisted(() => ({ setReleaseCredits: vi.fn(), listArtists: vi.fn(), listUsers: vi.fn() }));
vi.mock('@/lib/actions/release', () => ({ setReleaseCreditsAction: actions.setReleaseCredits }));
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
  actions.setReleaseCredits.mockResolvedValue({ success: true });
  actions.listArtists.mockResolvedValue({ ok: true, value: [] });
  actions.listUsers.mockResolvedValue({ ok: true, value: { data: [] } });
});
afterEach(() => {
  client.clear();
  act(() => notifications.clean());
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('ReleaseCreditsSection', () => {
  it('adds a text credit and writes its localized note separately', async () => {
    const onCreditsChange = vi.fn();
    const onCreditNoteChange = vi.fn();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('credit-new');

    const { user } = render(
      <ReleaseCreditsSection
        releaseId="release-1"
        idPrefix="release-credits"
        credits={[]}
        creditNotes={{}}
        canEdit
        canEditNotes
        onCreditsChange={onCreditsChange}
        onMutationStart={() => 'test-editor-origin'}
        onCreditNoteChange={onCreditNoteChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add Credit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add Credit' });
    await user.click(within(dialog).getByRole('radio', { name: 'Text' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Credited name' }), 'Sleeve notes');
    await user.type(within(dialog).getByRole('textbox', { name: 'Role (Optional)' }), 'Writer');
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Note (Optional)' }),
      'Refers to Blue Circuit and Midnight Radio',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(onCreditsChange).toHaveBeenCalledWith([
      {
        id: 'credit-new',
        credit_type: 'text',
        artist_id: null,
        artist_name: null,
        artist_slug: null,
        member_id: null,
        member_name: null,
        credited_name: 'Sleeve notes',
        credit_role: 'Writer',
        sort_order: 0,
      },
    ] satisfies ReleaseCreditItem[]);
    expect(actions.setReleaseCredits).toHaveBeenCalledWith(
      'release-1',
      [
        {
          id: 'credit-new',
          artistId: null,
          memberId: null,
          creditedName: 'Sleeve notes',
          creditRole: 'Writer',
          sortOrder: 0,
        },
      ],
      [],
      undefined,
      'test-editor-origin',
    );
    expect(onCreditNoteChange).toHaveBeenCalledWith('credit-new', 'Refers to Blue Circuit and Midnight Radio');
    expect(await screen.findByText('Credits updated')).toBeInTheDocument();
  });

  it('updates the note for an existing credit through the note modal', async () => {
    const onCreditsChange = vi.fn();
    const onCreditNoteChange = vi.fn();
    const credits: ReleaseCreditItem[] = [
      {
        id: 'credit-1',
        credit_type: 'artist',
        artist_id: 'artist-1',
        artist_name: 'Artist One',
        artist_slug: 'artist-one',
        member_id: null,
        member_name: null,
        credited_name: null,
        credit_role: 'Producer',
        sort_order: 0,
      },
    ];

    const { user } = render(
      <ReleaseCreditsSection
        releaseId="release-1"
        idPrefix="release-credits"
        credits={credits}
        creditNotes={{ 'credit-1': 'Initial note' }}
        canEdit
        canEditNotes
        onCreditsChange={onCreditsChange}
        onMutationStart={() => 'test-editor-origin'}
        onCreditNoteChange={onCreditNoteChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Note (Optional)' });
    const note = within(dialog).getByRole('textbox', { name: 'Note (Optional)' });
    await user.clear(note);
    await user.type(note, 'Updated note mentioning Blue Circuit');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(onCreditNoteChange).toHaveBeenCalledWith('credit-1', 'Updated note mentioning Blue Circuit');
    expect(onCreditsChange).not.toHaveBeenCalled();
  });

  it('clears note state when removing a credit', async () => {
    const onCreditsChange = vi.fn();
    const onCreditNoteChange = vi.fn();
    const credits: ReleaseCreditItem[] = [
      {
        id: 'credit-1',
        credit_type: 'artist',
        artist_id: 'artist-1',
        artist_name: 'Artist One',
        artist_slug: 'artist-one',
        member_id: null,
        member_name: null,
        credited_name: null,
        credit_role: 'Producer',
        sort_order: 0,
      },
    ];

    const { user } = render(
      <ReleaseCreditsSection
        releaseId="release-1"
        credits={credits}
        creditNotes={{ 'credit-1': 'Localized note' }}
        canEdit
        canEditNotes
        onCreditsChange={onCreditsChange}
        onMutationStart={() => 'test-editor-origin'}
        onCreditNoteChange={onCreditNoteChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onCreditsChange).toHaveBeenCalledWith([]);
    await waitFor(() =>
      expect(actions.setReleaseCredits).toHaveBeenCalledWith(
        'release-1',
        [],
        [
          {
            id: 'credit-1',
            artistId: 'artist-1',
            memberId: null,
            creditedName: null,
            creditRole: 'Producer',
            sortOrder: 0,
          },
        ],
        undefined,
        'test-editor-origin',
      ),
    );
    expect(onCreditNoteChange).toHaveBeenCalledWith('credit-1', '');
  });

  it('keeps credit mutations disabled while translation authoring is locked', async () => {
    const onCreditsChange = vi.fn();
    const onCreditNoteChange = vi.fn();
    const credits: ReleaseCreditItem[] = [
      {
        id: 'credit-1',
        credit_type: 'text',
        artist_id: null,
        artist_name: null,
        artist_slug: null,
        member_id: null,
        member_name: null,
        credited_name: 'Sleeve notes',
        credit_role: 'Writer',
        sort_order: 0,
      },
    ];

    const { user } = render(
      <ReleaseCreditsSection
        releaseId="release-1"
        idPrefix="release-credits"
        credits={credits}
        creditNotes={{ 'credit-1': 'Localized note' }}
        canEdit={false}
        canEditNotes={false}
        onCreditsChange={onCreditsChange}
        onMutationStart={() => 'test-editor-origin'}
        onCreditNoteChange={onCreditNoteChange}
      />,
    );

    const addButton = screen.getByRole('button', { name: 'Add Credit' });
    const removeButton = screen.getByRole('button', { name: 'Remove' });
    expect(addButton).toBeDisabled();
    expect(removeButton).toBeDisabled();
    await user.click(addButton);
    await user.click(removeButton);
    expect(onCreditsChange).not.toHaveBeenCalled();
    expect(onCreditNoteChange).not.toHaveBeenCalled();
    expect(actions.setReleaseCredits).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom

import { useEffect, type ComponentType, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@/test/render';
import { CategoryModals } from './category/CategoryModals';
import { CategoryModalProvider, useCategoryModal } from './category/CategoryModalContext';
import { GenreModals } from './genre/GenreModals';
import { GenreModalProvider, useGenreModal } from './genre/GenreModalContext';
import { StyleModals } from './style/StyleModals';
import { StyleModalProvider, useStyleModal } from './style/StyleModalContext';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/actions/category', () => ({
  createCategoryAction: vi.fn(),
  deleteCategoryAction: vi.fn(),
  updateCategoryAction: vi.fn(),
}));
vi.mock('@/lib/actions/genre', () => ({
  createGenreAction: vi.fn(),
  deleteGenreAction: vi.fn(),
  updateGenreAction: vi.fn(),
}));
vi.mock('@/lib/actions/style', () => ({
  createStyleAction: vi.fn(),
  deleteStyleAction: vi.fn(),
  updateStyleAction: vi.fn(),
}));

const original = {
  id: 'taxonomy-1',
  name: 'Original name',
  description: 'Original description',
  slug: 'original',
  postCount: 0,
  releaseCount: 0,
  createdAt: undefined,
};

const editors = [
  { kind: 'category', Provider: CategoryModalProvider, Modals: CategoryModals, useModal: useCategoryModal },
  { kind: 'genre', Provider: GenreModalProvider, Modals: GenreModals, useModal: useGenreModal },
  { kind: 'style', Provider: StyleModalProvider, Modals: StyleModals, useModal: useStyleModal },
];

function EditControls({
  useModal,
  refreshedEntity,
}: {
  useModal: () => { openEdit: (target: typeof original) => void };
  refreshedEntity?: typeof original;
}) {
  const { openEdit } = useModal();
  useEffect(() => {
    if (refreshedEntity) {
      openEdit(refreshedEntity);
    }
  }, [openEdit, refreshedEntity]);
  return (
    <>
      <button type="button" onClick={() => openEdit(original)}>
        Edit original
      </button>
    </>
  );
}

function Scenario({
  Provider,
  Modals,
  useModal,
  updateAction,
  refreshedEntity,
}: {
  refreshedEntity?: typeof original;
  Provider: ComponentType<{ children: ReactNode }>;
  Modals: ComponentType<{ updateAction: () => Promise<{ success: boolean }>; refresh: () => void }>;
  useModal: () => { openEdit: (target: typeof original) => void };
  updateAction: () => Promise<{ success: boolean }>;
}) {
  return (
    <Provider>
      <EditControls useModal={useModal} refreshedEntity={refreshedEntity} />
      <Modals updateAction={updateAction} refresh={() => {}} />
    </Provider>
  );
}

describe('taxonomy edit drafts', () => {
  it.each(editors)('sends an explicit description clear from the $kind editor', async (editor) => {
    const update = vi.fn(async () => ({ success: true }));
    const { user } = render(<Scenario {...editor} updateAction={update} />);
    await user.click(screen.getByRole('button', { name: 'Edit original' }));
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByRole('textbox', { name: 'Description' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(update).toHaveBeenCalledWith('taxonomy-1', { description: null });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('preserves a dirty draft across a refresh and submits only the changed name', async () => {
    const update = vi.fn(async () => ({ success: true }));
    const { user, rerender } = render(<Scenario {...editors[0]} updateAction={update} />);
    await user.click(screen.getByRole('button', { name: 'Edit original' }));
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Local name');
    rerender(
      <Scenario
        {...editors[0]}
        updateAction={update}
        refreshedEntity={{ ...original, name: 'Remote name', description: 'Remote description' }}
      />,
    );
    expect(name).toHaveValue('Local name');
    expect(within(dialog).getByRole('textbox', { name: 'Description' })).toHaveValue('Original description');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(update).toHaveBeenCalledWith('taxonomy-1', { name: 'Local name' });
  });

  it('adopts a refresh while pristine and reloads the entity after cancelling a draft', async () => {
    const update = vi.fn(async () => ({ success: true }));
    const { user, rerender } = render(<Scenario {...editors[0]} updateAction={update} />);
    await user.click(screen.getByRole('button', { name: 'Edit original' }));
    let dialog = await screen.findByRole('dialog');
    rerender(
      <Scenario
        {...editors[0]}
        updateAction={update}
        refreshedEntity={{ ...original, name: 'Remote name', description: 'Remote description' }}
      />,
    );
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    expect(name).toHaveValue('Remote name');
    await user.clear(name);
    await user.type(name, 'Discarded draft');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit original' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Original name');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(update).not.toHaveBeenCalled();
  });
});

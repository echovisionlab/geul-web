// @vitest-environment jsdom

import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@/test/render';
import { SortableCreditRow } from './SortableCreditRow';
import { SortableCreditGroupHeader } from './SortableCreditGroupHeader';

function renderEditor(kind: 'credit' | 'group', onSave = vi.fn()) {
  const view = render(
    <DndContext>
      <SortableContext items={['credit-one', 'group-one']}>
        {kind === 'credit' ? (
          <SortableCreditRow
            credit={{
              id: 'one',
              name: 'Mina',
              creditRole: 'Composer',
              groupId: null,
              sortOrder: 0,
              artist: null,
              member: null,
            }}
            groupId={null}
            canEdit
            isRemoving={false}
            isUpdating={false}
            onRemove={vi.fn()}
            onEditRole={onSave}
          />
        ) : (
          <SortableCreditGroupHeader
            group={{ id: 'one', workId: 'work-one', name: 'Performers', sortOrder: 0 }}
            canEdit
            isDeleting={false}
            onEdit={onSave}
            onDelete={vi.fn()}
          />
        )}
      </SortableContext>
    </DndContext>,
  );
  return { ...view, onSave };
}

describe('credit editing keyboard and meaning', () => {
  it('identifies the role and its owner, then restores the edit trigger after save', async () => {
    const { user, onSave } = renderEditor('credit');
    const edit = screen.getByRole('button', { name: 'Edit role' });
    expect(edit).toHaveAccessibleDescription('Mina');
    await user.click(edit);
    const input = screen.getByRole('textbox', { name: 'Role' });
    expect(input).toHaveAccessibleDescription('Mina');
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.paste('Arranger');
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    expect(onSave).toHaveBeenCalledWith('one', 'Arranger');
    expect(screen.getByRole('button', { name: 'Edit role' })).toHaveFocus();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('does not save while composing and cancels edited role with Escape', async () => {
    const { user, onSave } = renderEditor('credit');
    await user.click(screen.getByRole('button', { name: 'Edit role' }));
    const input = screen.getByRole('textbox', { name: 'Role' });
    await user.clear(input);
    await user.paste('Changed draft');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onSave).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
    expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit role' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Edit role' }));
    expect(screen.getByRole('textbox', { name: 'Role' })).toHaveValue('Composer');
  });

  it('names group editing and returns focus after cancel without mutating the group', async () => {
    const { user, onSave } = renderEditor('group');
    const edit = screen.getByRole('button', { name: 'Edit group' });
    expect(edit).toHaveAccessibleDescription('Performers');
    await user.click(edit);
    const input = screen.getByRole('textbox', { name: 'Group' });
    await user.clear(input);
    await user.paste('Changed draft');
    await user.keyboard('{Escape}');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit group' })).toHaveFocus();
    expect(screen.getByText('Performers')).toBeVisible();
  });

  it('saves a group once with Enter, holds pending until acknowledgement, and leaves its trigger reachable', async () => {
    let finish!: (value: boolean) => void;
    const onSave = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const { user } = renderEditor('group', onSave);
    await user.click(screen.getByRole('button', { name: 'Edit group' }));
    const input = screen.getByRole('textbox', { name: 'Group' });
    await user.clear(input);
    await user.paste('Musicians');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onSave).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onSave).toHaveBeenCalledExactlyOnceWith('one', 'Musicians');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toHaveAttribute('aria-busy', 'true');
    await user.keyboard('{Enter}');
    expect(onSave).toHaveBeenCalledOnce();
    await act(async () => finish(true));
    expect(screen.getByRole('button', { name: 'Edit group' })).toHaveFocus();
  });
});

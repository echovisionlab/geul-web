// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { SortableCreditRow } from './SortableCreditRow';
import { SortableCreditGroupHeader } from './SortableCreditGroupHeader';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(kind: 'credit' | 'group') {
  const onSave = vi.fn();
  act(() => {
    root.render(
      <TestProviders>
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
        </DndContext>
      </TestProviders>,
    );
  });
  return onSave;
}

function namedButton(name: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
  if (!button) {
    throw new Error(`Missing command: ${name}`);
  }
  return button;
}
function changeInput(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function keyboard(input: HTMLInputElement, key: string, isComposing = false) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, isComposing });
  act(() => input.dispatchEvent(event));
  return event;
}

describe('credit editing keyboard and meaning', () => {
  it('identifies the role and its owner, then restores the edit trigger after save', () => {
    const onSave = render('credit');
    const edit = namedButton('Edit role');
    const owner = edit.getAttribute('aria-describedby');
    expect(document.getElementById(owner ?? '')?.textContent).toBe('Mina');
    act(() => edit.click());
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Role"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('aria-describedby')).toBe(owner);
    expect(document.activeElement).toBe(input);
    changeInput(input!, 'Arranger');
    expect(keyboard(input!, 'Enter').defaultPrevented).toBe(true);
    expect(onSave).toHaveBeenCalledWith('one', 'Arranger');
    expect(document.activeElement).toBe(namedButton('Edit role'));
    expect(container.querySelector('input')).toBeNull();
  });

  it('does not save while composing and cancels edited role with Escape', () => {
    const onSave = render('credit');
    act(() => namedButton('Edit role').click());
    const input = container.querySelector<HTMLInputElement>('input')!;
    changeInput(input, 'Changed draft');
    keyboard(input, 'Enter', true);
    expect(onSave).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
    expect(keyboard(input, 'Escape').defaultPrevented).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(namedButton('Edit role'));
    act(() => namedButton('Edit role').click());
    expect(container.querySelector<HTMLInputElement>('input')?.value).toBe('Composer');
  });

  it('names group editing and returns focus after cancel without mutating the group', () => {
    const onSave = render('group');
    const edit = namedButton('Edit group');
    expect(document.getElementById(edit.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Performers');
    act(() => edit.click());
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Group"]')!;
    expect(input).not.toBeNull();
    changeInput(input, 'Changed draft');
    keyboard(input, 'Escape');
    expect(onSave).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(namedButton('Edit group'));
    expect(container.textContent).toContain('Performers');
  });

  it('saves a group once with Enter and leaves its trigger reachable', () => {
    const onSave = render('group');
    act(() => namedButton('Edit group').click());
    const input = container.querySelector<HTMLInputElement>('input')!;
    changeInput(input, 'Musicians');
    keyboard(input, 'Enter', true);
    expect(onSave).not.toHaveBeenCalled();
    keyboard(input, 'Enter');
    expect(onSave).toHaveBeenCalledExactlyOnceWith('one', 'Musicians');
    expect(document.activeElement).toBe(namedButton('Edit group'));
  });
});

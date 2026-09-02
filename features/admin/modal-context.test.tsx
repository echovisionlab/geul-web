// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCreateDeleteModalContext, createCrudModalContext, createDeleteModalContext } from './modal-context';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function click(label: string) {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === label);
  expect(button).toBeDefined();
  act(() => button?.click());
}

describe('admin modal context factories', () => {
  it('owns one delete target and clears it', () => {
    const modal = createDeleteModalContext<{ id: string }>('Example');
    function Probe() {
      const state = modal.useModal();
      return (
        <>
          <output>{state.deleting?.id ?? 'none'}</output>
          <button type="button" onClick={() => state.openDelete({ id: 'one' })}>
            open
          </button>
          <button type="button" onClick={state.closeDelete}>
            close
          </button>
        </>
      );
    }

    act(() =>
      root.render(
        <modal.Provider>
          <Probe />
        </modal.Provider>,
      ),
    );
    expect(container.querySelector('output')?.textContent).toBe('none');
    click('open');
    expect(container.querySelector('output')?.textContent).toBe('one');
    click('close');
    expect(container.querySelector('output')?.textContent).toBe('none');
  });

  it('owns create visibility independently from the delete target', () => {
    const modal = createCreateDeleteModalContext<{ id: string }>('Example');
    function Probe() {
      const state = modal.useModal();
      return (
        <>
          <output>{`${state.isCreateOpen}:${state.deleting?.id ?? 'none'}`}</output>
          <button type="button" onClick={state.openCreate}>
            create
          </button>
          <button type="button" onClick={state.closeCreate}>
            close create
          </button>
          <button type="button" onClick={() => state.openDelete({ id: 'one' })}>
            delete
          </button>
          <button type="button" onClick={state.closeDelete}>
            close delete
          </button>
        </>
      );
    }

    act(() =>
      root.render(
        <modal.Provider>
          <Probe />
        </modal.Provider>,
      ),
    );
    click('create');
    click('delete');
    expect(container.querySelector('output')?.textContent).toBe('true:one');
    click('close create');
    click('close delete');
    expect(container.querySelector('output')?.textContent).toBe('false:none');
  });

  it('owns edit, delete, and create state independently', () => {
    const modal = createCrudModalContext<{ id: string }>('Example');
    function Probe() {
      const state = modal.useModal();
      return (
        <>
          <output>{`${state.editing?.id ?? 'none'}:${state.deleting?.id ?? 'none'}:${state.isCreateOpen}`}</output>
          <button type="button" onClick={() => state.openEdit({ id: 'edit' })}>
            edit
          </button>
          <button type="button" onClick={state.closeEdit}>
            close edit
          </button>
          <button type="button" onClick={() => state.openDelete({ id: 'delete' })}>
            delete
          </button>
          <button type="button" onClick={state.closeDelete}>
            close delete
          </button>
          <button type="button" onClick={state.openCreate}>
            create
          </button>
          <button type="button" onClick={state.closeCreate}>
            close create
          </button>
        </>
      );
    }

    act(() =>
      root.render(
        <modal.Provider>
          <Probe />
        </modal.Provider>,
      ),
    );
    click('edit');
    click('delete');
    click('create');
    expect(container.querySelector('output')?.textContent).toBe('edit:delete:true');
    click('close edit');
    click('close delete');
    click('close create');
    expect(container.querySelector('output')?.textContent).toBe('none:none:false');
  });

  it('fails clearly when a generated hook is used outside its provider', () => {
    const modal = createDeleteModalContext<{ id: string }>('Example');
    function Probe() {
      modal.useModal();
      return null;
    }

    expect(() => act(() => root.render(<Probe />))).toThrow('useExampleModal must be used within ExampleModalProvider');
  });
});

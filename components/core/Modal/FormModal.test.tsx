// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { TextInput } from '../Input';
import { FormModal } from './FormModal';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

function renderModal(node: ReactNode) {
  act(() => {
    root?.render(<MantineProvider env="test">{node}</MantineProvider>);
  });
}

function getDialog() {
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) {
    throw new Error('Expected a dialog to be rendered.');
  }
  return dialog;
}

describe('FormModal', () => {
  it('submits through native form semantics with supplied labels', () => {
    const onSubmit = vi.fn();
    renderModal(
      <FormModal
        opened
        onClose={vi.fn()}
        onSubmit={onSubmit}
        title="Edit release"
        submitLabel="Save"
        cancelLabel="Cancel"
        closeLabel="Close dialog"
        size="large"
      >
        <TextInput label="Release title" defaultValue="Night Drive" />
      </FormModal>,
    );

    const dialog = getDialog();
    const form = dialog.querySelector('form');
    expect(form).not.toBeNull();
    expect(dialog.querySelector('[aria-label="Close dialog"]')).not.toBeNull();
    expect(document.body.querySelector('[data-size="large"]')).not.toBeNull();

    act(() => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('does not submit while disabled or loading', () => {
    const onSubmit = vi.fn();
    const { rerender } = (() => {
      const render = (loading: boolean, submitDisabled: boolean) =>
        renderModal(
          <FormModal
            opened
            onClose={vi.fn()}
            onSubmit={onSubmit}
            title="Edit release"
            submitLabel="Save"
            cancelLabel="Cancel"
            closeLabel="Close dialog"
            loading={loading}
            submitDisabled={submitDisabled}
          >
            <TextInput label="Release title" />
          </FormModal>,
        );

      render(false, true);
      return { rerender: render };
    })();

    act(() => {
      getDialog()
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(true, false);
    act(() => {
      getDialog()
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

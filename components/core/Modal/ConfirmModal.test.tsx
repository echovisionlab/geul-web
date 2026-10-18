// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'react-aria-components';
import { ConfirmModal } from './ConfirmModal';

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
    root?.render(<I18nProvider locale="en-US">{node}</I18nProvider>);
  });
}

function getDialog() {
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) {
    throw new Error('Expected a dialog to be rendered.');
  }
  return dialog;
}

function getButtonByText(dialog: HTMLElement, label: string) {
  const button = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!button) {
    throw new Error(`Expected a button labeled "${label}".`);
  }
  return button;
}

describe('ConfirmModal', () => {
  it('renders supplied labels and invokes the destructive action', () => {
    const onConfirm = vi.fn();
    renderModal(
      <ConfirmModal
        opened
        onClose={vi.fn()}
        onConfirm={onConfirm}
        title="Delete release"
        message="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        closeLabel="Close dialog"
      />,
    );

    const dialog = getDialog();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(getButtonByText(dialog, 'Delete').getAttribute('data-emphasis')).toBe('strong');
    expect(dialog.textContent).toContain('Delete release');
    expect(dialog.textContent).toContain('This cannot be undone.');
    expect(dialog.querySelector('[aria-label="Close dialog"]')).not.toBeNull();

    act(() => {
      getButtonByText(dialog, 'Delete').click();
    });
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('locks every close path while loading', () => {
    renderModal(
      <ConfirmModal
        opened
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete release"
        message="Deleting release"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        closeLabel="Close dialog"
        loading
      />,
    );

    const dialog = getDialog();
    expect(dialog.querySelector('[aria-label="Close dialog"]')).toBeNull();
    expect(getButtonByText(dialog, 'Cancel').disabled).toBe(true);
    expect(getButtonByText(dialog, 'Delete').disabled).toBe(true);
  });

  it('disables confirmation without disabling cancellation', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    renderModal(
      <ConfirmModal
        opened
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete release"
        message="Choose an item first."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        closeLabel="Close dialog"
        confirmDisabled
      />,
    );

    const dialog = getDialog();
    expect(getButtonByText(dialog, 'Delete').disabled).toBe(true);
    expect(getButtonByText(dialog, 'Cancel').disabled).toBe(false);

    act(() => {
      getButtonByText(dialog, 'Cancel').click();
    });
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('describes a simple confirmation message without flattening structured message content', () => {
    const common = {
      opened: true,
      onClose: vi.fn(),
      onConfirm: vi.fn(),
      title: 'Delete release',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      closeLabel: 'Close',
    };
    renderModal(<ConfirmModal {...common} message="This cannot be undone." />);
    expect(getDialog()).toHaveAccessibleDescription('This cannot be undone.');
    renderModal(
      <ConfirmModal
        {...common}
        message={
          <ul>
            <li>Related links are removed.</li>
            <li>Files remain.</li>
          </ul>
        }
      />,
    );
    expect(getDialog().hasAttribute('aria-describedby')).toBe(false);
    expect(getDialog().querySelectorAll('li')).toHaveLength(2);
  });

  it.each([
    { tone: 'danger' as const, disabled: false, expected: 'Cancel' },
    { tone: 'neutral' as const, disabled: false, expected: 'Confirm' },
    { tone: 'neutral' as const, disabled: true, expected: 'Cancel' },
  ])('sets initial focus for $tone confirmation (disabled=$disabled)', async ({ tone, disabled, expected }) => {
    renderModal(
      <ConfirmModal
        opened
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Confirm operation"
        message="Proceed?"
        confirmTone={tone}
        confirmDisabled={disabled}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        closeLabel="Close"
      />,
    );
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(document.activeElement).toBe(getButtonByText(getDialog(), expected));
  });
});
